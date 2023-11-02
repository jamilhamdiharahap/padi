import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { checkin, checkout } from "../utils/validation.js";
import { client } from "../connection/database.js";
import { authToken } from "../utils/auth.js";
import { verifyToken } from "../utils/tokenVerify.js";
import { timestampHelper } from "../helper/compareDate.js";
import { formatterDate } from "../helper/formatterDate.js";


const attendanceRoutes = express.Router();

attendanceRoutes.use((req, res, next) => {
  const token = req.header("token");

  if (!token) {
    return res.status(401).json({ error: "Header 'Token' tidak ada." });
  }
  next();
});

attendanceRoutes.get('/transaction/:month/:year', async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authToken(token);

    if (auth.status !== 200) {
      return responHelper(res, auth.status, { data: auth })
    }

    const { employeeId } = verifyToken(token, process.env.SECRET_KEY)
    const { month, year } = req.params;

    const queryDate = new Date(`${year}-${month}`);
    const queryMonth = queryDate.getMonth() + 1;

    const query = `SELECT id, checkin, checkout, work_type, working_hours, note, activity, check_in_time, check_out_time 
      FROM transactions 
      WHERE employee_id = $1
      AND EXTRACT(MONTH FROM check_in_time) = $2
      AND EXTRACT(YEAR FROM check_in_time) = $3`;

    const values = [employeeId, queryMonth, queryDate.getFullYear()];

    const { rows } = await client.query(query, values);

    const data = rows.map(item => {
      let checkin = {}
      let checkout = {}
      let checkIn = JSON.parse(item.checkin);
      let checkOut = JSON.parse(item.checkout);

      checkin.check_in_time = item.check_in_time
      checkin.latitude = checkIn?.latitude
      checkin.longitude = checkIn?.longitude
      checkin.status = checkIn?.status

      checkout.check_out_time = item?.check_out_time
      checkout.latitude = checkOut?.latitude
      checkout.longitude = checkOut?.longitude
      checkout.status = checkOut?.status

      return {
        transaction_id: item.id,
        checkin: checkin,
        checkout: checkout,
        note: item.note,
        activity: item.activity,
        work_type: item.work_type,
        working_hours: item.working_hours,
      };
    });

    responHelper(res, 200, { data, message: `${data.length > 0 ? 'Data Ditemukan.' : 'Data Kosong'}` });
  } catch (error) {
    console.log(error)
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

attendanceRoutes.get('/transaction/:transactionId', async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authToken(token);

    if (auth.status !== 200) {
      return responHelper(res, auth.status, { data: auth })
    }

    const { transactionId } = req.params;

    const query = `SELECT id, checkin, checkout, work_type, working_hours, check_in_time, check_out_time 
      FROM transactions 
      WHERE id = $1 `;


    const { rows } = await client.query(query, [transactionId]);

    const data = rows.map(item => {
      let checkin = {}
      let checkout = {}
      let checkIn = JSON.parse(item.checkin);
      let checkOut = JSON.parse(item.checkout);

      checkin.check_in_time = item.check_in_time
      checkin.latitude = checkIn.latitude
      checkin.longitude = checkIn.longitude
      checkin.status = checkIn.status

      checkout.check_in_time = item.check_out_time
      checkout.latitude = checkOut.latitude
      checkout.longitude = checkOut.longitude
      checkout.status = checkOut.status

      return {
        transaction_id: item.id,
        checkin: checkin,
        checkout: checkout,
        note: item.note,
        activity: item.activity,
        work_type: item.work_type,
        working_hours: item.working_hours,
      };
    });

    responHelper(res, 200, { data, message: `${data.length > 0 ? 'Data Ditemukan.' : 'Data Kosong'}` });
  } catch (error) {
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

attendanceRoutes.post('/checkin', checkin, async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authToken(token);

    if (auth.status !== 200) {
      return responHelper(res, auth.status, { data: auth })
    }

    const { employeeId } = verifyToken(token, process.env.SECRET_KEY)

    const { check_in_time, latitude, longitude, status, work_type } = req.body
    console.log(check_in_time)

    const today = new Date(check_in_time * 1000);
    const checkInTime = formatterDate(today)
    const checkin = { latitude, longitude, status }

    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const queryCheck = `SELECT id AS transaction_id
      FROM transactions
      WHERE employee_id = $1
      AND EXTRACT(YEAR FROM check_in_time) = $2
      AND EXTRACT(MONTH FROM check_in_time) = $3
      AND EXTRACT(DAY FROM check_in_time) = $4
    `;

    const { rows } = await client.query(queryCheck, [employeeId, year, month, day]);

    if (rows.length > 0) {
      return responHelper(res, 400, { message: 'Anda sudah checkin hari ini.' });
    }

    const query = `INSERT INTO transactions 
    (employee_id, checkin, check_in_time , work_type)
    VALUES ($1, $2, $3, $4)`;

    await client.query(query, [employeeId, JSON.stringify(checkin), checkInTime, work_type]);

    const queryTransaction = `SELECT id as transaction_id FROM transactions 
      WHERE employee_id = $1
      AND EXTRACT(YEAR FROM check_in_time) = $2
      AND EXTRACT(MONTH FROM check_in_time) = $3
      AND EXTRACT(DAY FROM check_in_time) = $4
    `;

    const transactionId = await client.query(queryTransaction, [employeeId, year, month, day])

    responHelper(res, 200, { data: transactionId.rows[0], message: 'Checkin berhasil.' });
  } catch (error) {
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

attendanceRoutes.post('/checkout', checkout, async (req, res) => {
  try {
    let token = req.header("token")
    let auth = authToken(token)

    if (auth.status !== 200) {
      return responHelper(res, auth.status, { data: auth })
    }

    const { note, activity, check_out_time, latitude, longitude, status, transaction_id } = req.body

    const today = new Date(check_out_time * 1000);
    const timestamp = formatterDate(today);

    const checkout = { latitude, longitude, status }

    const queryCheck = `SELECT * FROM transactions WHERE id = $1`;

    const { rows } = await client.query(queryCheck, [transaction_id]);

    if (rows[0].checkin == null) {
      return responHelper(res, 400, { message: 'Silahkan checkin terlebih dahulu.' });
    }

    if (rows[0].checkout !== null) {
      return responHelper(res, 400, { message: 'Anda sudah checkout hari ini.' });
    }

    // const checkInTime = rows[0].check_in_time
    // const checkOutTime = timestamp  
    // console.log(checkInTime)
    // console.log(checkOutTime)
    // const checkIn = new Date(`${checkInTime}`);
    // const checkOut = new Date(`${checkOutTime}`);
    // console.log(checkIn)
    // console.log(checkOut)

    // const timeDifference = checkOut - checkIn;

    // console.log(timeDifference)

    // const hours = Math.floor(timeDifference / (60 * 60 * 1000));
    // const minutes = Math.floor((timeDifference % (60 * 60 * 1000)) / (60 * 1000));
    // const seconds = Math.floor((timeDifference % (60 * 1000) / 1000));


    const query = `UPDATE transactions SET checkout = $1, note = $2, activity = $3, working_hours = $4, check_out_time = $5 WHERE id = $6`;
    // const values = [JSON.stringify(checkout), note, activity, timestamp, transaction_id]
    const values = [JSON.stringify(checkout), note, activity, `${'08'}:${'00'}:${'00'}`, timestamp, transaction_id]

    await client.query(query, values);

    responHelper(res, 200, { message: 'Checkout berhasil.' });
  } catch (error) {
    console.log(error)
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

attendanceRoutes.post('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params
    const today = new Date();
    const query = `DELETE FROM transactions WHERE id = $1 AND DATE(created_at) = $2`
    await client.query(query, [id, today])

    responHelper(res, 200, { message: 'Delete berhasil.' });
  } catch (error) {
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});



export default attendanceRoutes;
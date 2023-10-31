import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { checkin, checkout } from "../utils/validation.js";
import { client } from "../connection/database.js";
import { authToken } from "../utils/auth.js";
import { verifyToken } from "../utils/tokenVerify.js";
import { timestampHelper } from "../helper/compareDate.js";


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

    const queryDate = new Date(`${year}-${month}-01`);
    const queryMonth = queryDate.getMonth() + 1;

    const query = `SELECT id, checkin, checkout, work_type, working_hours FROM transactions WHERE employee_id = $1 AND EXTRACT(MONTH FROM created_at) = $2
                  AND EXTRACT(YEAR FROM created_at) = $3`;
    const values = [employeeId, queryMonth, queryDate.getFullYear()];

    const { rows } = await client.query(query, values);
    const data = rows.map(item => ({
      id: item.id,
      checkin: JSON.parse(item.checkin),
      checkout: JSON.parse(item.checkout),
      work_type: item.work_type,
      working_hours: item.working_hours
    }));

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

    const checkin = { check_in_time, latitude, longitude, status }

    const today = new Date();

    const queryCheck = `SELECT * FROM transactions WHERE employee_id = $1 AND DATE(created_at) = $2`
    const { rows } = await client.query(queryCheck, [employeeId, today])

    if (rows.length > 0) {
      return responHelper(res, 400, { message: 'Anda sudah checkin hari ini.' });
    }

    const query = `INSERT INTO transactions (employee_id, checkin, work_type)
    VALUES ($1, $2, $3)`;

    await client.query(query, [employeeId, JSON.stringify(checkin), work_type]);

    const queryTransaction = `SELECT id as transaction_id FROM transactions WHERE employee_id = $1 AND DATE(created_at) = $2`
    const transactionId = await client.query(queryTransaction, [employeeId, today])

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
    const checkout = { check_out_time, latitude, longitude, status }

    const queryCheck = `SELECT * FROM transactions WHERE id = $1`;

    const { rows } = await client.query(queryCheck, [transaction_id]);

    if (rows[0].checkin == null) {
      return responHelper(res, 400, { message: 'Silahkan checkin terlebih dahulu.' });
    }

    if (rows[0].checkout !== null) {
      return responHelper(res, 400, { message: 'Anda sudah checkout hari ini.' });
    }

    const checkInParse = JSON.parse(rows[0].checkin)
    const checkInTime = timestampHelper(checkInParse.check_in_time)
    const checkOutTime = timestampHelper(check_out_time)

    const checkIn = new Date(`${checkInTime}`);
    const checkOut = new Date(`${checkOutTime}`);

    const timeDifference = checkOut - checkIn;

    const hours = Math.floor(timeDifference / (60 * 60 * 1000));
    const minutes = Math.floor((timeDifference % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((timeDifference % (60 * 1000) / 1000));


    const query = `UPDATE transactions SET checkout = $1, note = $2, activity = $3, working_hours = $4 WHERE id = $5`;
    const values = [JSON.stringify(checkout), note, activity, `${hours}:${minutes}:${seconds}`, transaction_id]

    await client.query(query, values);

    responHelper(res, 200, { message: 'Checkout berhasil.' });
  } catch (error) {
    console.log(error)
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});


export default attendanceRoutes;
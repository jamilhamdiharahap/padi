import express, { request } from "express";
import { responHelper } from "../helper/responHelper.js";
import axios from "axios";
import { checkin, checkout } from "../utils/validation.js";
import { client } from "../connection/database.js";
import { authToken } from "../utils/auth.js";
import { verifyToken } from "../utils/tokenVerify.js";


const attendanceRoutes = express.Router();

attendanceRoutes.use((req, res, next) => {
  const token = req.header("token");

  if (!token) {
    return res.status(401).json({ error: "Header 'token' tidak ada" });
  }
  next();
});

attendanceRoutes.get("/attendance", async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: 'Both month and year are required query parameters' });
    }

    const response = await axios.get(`https://api-harilibur.vercel.app/api?month=${month}&year=${year}`);

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const datesInMonth = [];

    for (let date = firstDay; date <= lastDay; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.toLocaleString('id-ID', { weekday: 'long' });
      const isDayOff = (dayOfWeek === 'Sabtu' || dayOfWeek === 'Minggu');
      datesInMonth.push({
        date_detail: new Date(date).toISOString().split('T')[0],
        date: dayOfWeek,
        month: new Date(date).toISOString().split('T')[0].slice(5, 7),
        year: new Date(date).toISOString().split('T')[0].slice(0, 4),
        day: new Date(date).toISOString().split('T')[0].slice(8, 10),
        day_off: isDayOff,
      })
    }

    datesInMonth.forEach(item => {
      response.data.forEach(day => {
        const holiday = day.holiday_date.slice(8, 10)
        if (item.day == holiday) {
          if (day.is_national_holiday) {
            item.holiday = day.holiday_name
            item.is_national_holiday = true
          } else {
            item.holiday = null
            item.is_national_holiday = false
          }
        } else {
          item.holiday = null
          item.is_national_holiday = false
        }
      })
    })

    responHelper(res, 200, { data: datesInMonth, message: "Success" })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error });
  }
});

attendanceRoutes.get('/transaction/:month/:year', async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authToken(token);

    if (auth.status !== 200) {
      return res.status(auth.status).send(auth);
    }

    const { employeeId } = verifyToken(token, process.env.SECRET_KEY)

    const { month, year } = req.params;

    const queryDate = new Date(`${year}-${month}-01`);
    const queryMonth = queryDate.getMonth() + 1;

    const query = `SELECT id, checkin, checkout, work_type FROM transactions WHERE employee_id = $1 AND EXTRACT(MONTH FROM created_at) = $2 AND EXTRACT(YEAR FROM created_at) = $3`;
    const values = [employeeId, queryMonth, queryDate.getFullYear()];

    const { rows } = await client.query(query, values);

    const data = rows.map(item => ({
      id: item.id,
      checkin: JSON.parse(item.checkin),
      checkout: JSON.parse(item.checkout),
      work_type: item.work_type
    }));

    responHelper(res, 200, { data, message: 'Data Ditemukan.' });
  } catch (error) {
    console.error(error);
    return responHelper(res, 500, { message: 'Internal server error.' });
  }
});


attendanceRoutes.post('/checkin', checkin, async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authToken(token);

    if (auth.status !== 200) {
      return res.status(auth.status).send(auth);
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

    responHelper(res, 200, { message: 'Checkin berhasil.' });
  } catch (error) {
    console.log(error)
    return responHelper(res, 500, { message: 'Internal server error.' });
  }
});

attendanceRoutes.post('/checkout', checkout, async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authToken(token);

    if (auth.status !== 200) {
      return res.status(auth.status).send(auth);
    }

    const { note, activity, check_out_time, latitude, longitude, status, transaction_id } = req.body
    const checkout = { check_out_time, latitude, longitude, status }

    const queryCheck = `SELECT * FROM transactions WHERE id = $1`;


    const { rows } = await client.query(queryCheck, [transaction_id]);
    if (rows[0].checkout !== null) {
      return responHelper(res, 400, { message: 'Anda sudah checkout hari ini.' });
    }
    const query = `UPDATE transactions SET checkout = $1, note = $2, activity = $3 WHERE id = $4`;
    const values = [JSON.stringify(checkout), note, activity, transaction_id]
    await client.query(query, values);
    responHelper(res, 200, { message: 'Checkout berhasil.' });
  } catch (error) {
    return responHelper(res, 500, { message: 'Internal server error.' });
  }
});


export default attendanceRoutes;
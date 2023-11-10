import express from "express";
import axios from "axios";
import { responHelper } from "../helper/responHelper.js";
import { checkin, checkout } from "../utils/validation.js";
import { client } from "../connection/database.js";
import { authToken } from "../utils/auth.js";
import { verifyToken } from "../utils/tokenVerify.js";
import { formatterDate } from "../helper/formatterDate.js";

const attendanceRoutes = express.Router();

attendanceRoutes.use((req, res, next) => {
  const token = req.header("token");

  if (!token) {
    return res.status(401).json({ error: "Header 'Token' tidak ada." });
  }
  next();
});

function parseTimeToMinutes(timeString) {
  if (timeString === null) return 0;
  const [hours, minutes] = timeString.split(":");
  return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
};

function calculateWorkingHours(startTimestamp, endTimestamp) {
  const selisihWaktu = endTimestamp - startTimestamp;
  const jam = Math.floor(selisihWaktu / 3600000);
  const sisaMilidetik = selisihWaktu % 3600000;
  const menit = Math.floor(sisaMilidetik / 60000);
  const detik = (sisaMilidetik % 60000) / 1000;

  const jamFormatted = jam.toString().padStart(2, '0');
  const menitFormatted = menit.toString().padStart(2, '0');
  const detikFormatted = detik.toString().padStart(2, '0');

  // return `${jamFormatted}:${menitFormatted}:${detikFormatted}`;
  return `${jamFormatted}:${menitFormatted}`;
};

attendanceRoutes.get('/monthly-activity/:month/:year', async (req, res) => {
  let token = req.header("token");
  let auth = authToken(token);

  if (auth.status !== 200) {
    return responHelper(res, auth.status, { data: auth })
  }
  try {
    const { month, year } = req.params;
    const { employeeId } = verifyToken(token, process.env.SECRET_KEY)
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
        date: new Date(date).toISOString().split('T')[0].slice(8, 10),
        month: new Date(date).toISOString().split('T')[0].slice(5, 7),
        year: new Date(date).toISOString().split('T')[0].slice(0, 4),
        day: dayOfWeek,
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

    let totalWorking = 0;
    datesInMonth.forEach(item => {
      if (item.day === 'Sabtu' || item.day === 'Minggu' || item.is_national_holiday) {
        totalWorking++;
      }
    })

    const query = `SELECT working_hours, check_in_time, work_type FROM transactions WHERE employee_id = $1
        AND EXTRACT(MONTH FROM check_in_time) = $2
        AND EXTRACT(YEAR FROM check_in_time) = $3`

    const { rows } = await client.query(query, [employeeId, month, year])

    const totalMinutes = rows.reduce((acc, obj) => {
      return acc + parseTimeToMinutes(obj.working_hours);
    }, 0);

    const wfh = rows.filter(item => item.work_type === 'WFH')
    const wfo = rows.filter(item => item.work_type === 'WFO')
    const late = rows.filter(item => {
      const checkInTime = new Date(formatterDate(item.check_in_time));
      return checkInTime.getHours() >= 8 && checkInTime.getMinutes() >= 30;
    }).length;
    const notPresent = rows.filter(item => {
      return item.check_in_time === null;
    }).length;

    const totalHours = Math.floor(totalMinutes / 60);
    const totalMinutesRemaining = totalMinutes % 60;
    const totalWorkingHours = `${totalHours.toString().padStart(2, '0')}:${totalMinutesRemaining.toString().padStart(2, '0')}`;

    responHelper(res, 200, {
      data: {
        total_working_day: (datesInMonth.length - totalWorking).toString(),
        employee_working_day: rows.length.toString(),
        standard_working_hour: ((datesInMonth.length - totalWorking) * 8).toString(),
        employee_working_hours: totalWorkingHours,
        not_present: notPresent.toString(), 
        wfh: wfh.length.toString(),
        wfo: wfo.length.toString(),
        late: late.toString()
      },
      message: "Success"
    })
  } catch (error) {
    console.log(error)
    responHelper(res, 500, { message: 'Internal server error.' });
  }
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

      checkin.check_in_time = formatterDate(item.check_in_time)
      checkin.latitude = checkIn?.latitude
      checkin.longitude = checkIn?.longitude
      checkin.status = checkIn?.status
      if (item.check_out_time !== null) {
        checkout.check_out_time = formatterDate(item.check_out_time)
      }
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

    const query = `SELECT id, checkin, checkout, work_type, working_hours, note, activity, check_in_time, check_out_time FROM transactions WHERE id = $1`;


    const { rows } = await client.query(query, [transactionId]);

    const data = rows.map(item => {
      let checkin = {}
      let checkout = {}
      let checkIn = JSON.parse(item.checkin);
      let checkOut = JSON.parse(item.checkout);
      console.log(checkOut)
      checkin.check_in_time = formatterDate(item.check_in_time)
      checkin.latitude = checkIn.latitude
      checkin.longitude = checkIn.longitude
      checkin.status = checkIn.status
      if (checkOut !== null) {
        checkout.check_out_time = formatterDate(item.check_out_time)
        checkout.latitude = checkOut.latitude
        checkout.longitude = checkOut.longitude
        checkout.status = checkOut.status
      }

      return {
        transaction_id: item.id,
        checkin: checkin,
        checkout: checkout,
        note: item.note,
        activity: item.activity,
        work_type: item.work_type,
        working_hours: item.working_hours,
        schedule_in: `${checkin.check_in_time.slice(0, 10)} 01:00:00`,
        schedule_out: `${checkin.check_in_time.slice(0, 10)} 10:00:00`
      };
    });

    responHelper(res, 200, { data, message: `${data.length > 0 ? 'Data Ditemukan.' : 'Data Kosong'}` });
  } catch (error) {
    console.log(error)
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

attendanceRoutes.post('/checkin', checkin, async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authToken(token);

    if (auth.status !== 200) {
      return responHelper(res, auth.status, { data: auth });
    }

    const { employeeId } = verifyToken(token, process.env.SECRET_KEY);

    const { check_in_time, latitude, longitude, status, work_type } = req.body

    const today = new Date(check_in_time * 1000);
    const checkInTime = formatterDate(today);
    const checkin = { latitude, longitude, status };

    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const params = new Date(checkInTime)

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

    const query = `UPDATE transactions SET checkin = $1, check_in_time = $2 , work_type = $3 WHERE employee_id = $4`;

    await client.query(query, [JSON.stringify(checkin), checkInTime, work_type, employeeId]);

    const queryTransaction = `SELECT id as transaction_id FROM transactions 
      WHERE employee_id = $1
      AND EXTRACT(YEAR FROM check_in_time) = $2
      AND EXTRACT(MONTH FROM check_in_time) = $3
      AND EXTRACT(DAY FROM check_in_time) = $4
    `;
    const transactionId = await client.query(queryTransaction, [employeeId, params.getFullYear(), params.getMonth() + 1, params.getDate()])

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



    const checkInTime = formatterDate(rows[0].check_in_time);

    const startTimestamp = new Date(`${checkInTime}`).getTime();
    const endTimestamp = new Date(`${timestamp}`).getTime();

    const workingHours = calculateWorkingHours(startTimestamp, endTimestamp);

    const query = `UPDATE transactions 
      SET checkout = $1, note = $2, activity = $3, working_hours = $4, check_out_time = $5
      WHERE id = $6
    `;
    const values = [JSON.stringify(checkout), note, activity, workingHours, timestamp, transaction_id]

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
    const query = `DELETE FROM transactions WHERE id = $1`
    await client.query(query, [id])

    responHelper(res, 200, { message: 'Delete berhasil.' });
  } catch (error) {
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

export default attendanceRoutes;
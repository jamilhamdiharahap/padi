import express from "express";
import axios from "axios";
import statusResponse from "../utils/status.js";
import { responHelper } from "../helper/responHelper.js";
import { checkin, checkout, correction } from "../utils/validation.js";
import { client } from "../connection/database.js";
import { authenticateUser } from "../utils/auth.js";
import { verifyToken } from "../utils/tokenVerify.js";
import { formatterDate, formatterDateTwo, formatterDayOff } from "../helper/formatterDate.js";

const attendanceRoutes = express.Router();

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
  let auth = authenticateUser(token);

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

    responHelper(res, statusResponse.OK.code, {
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
    let auth = authenticateUser(token);

    if (auth.status !== 200) {
      return responHelper(res, auth.status, { data: auth })
    }

    const { employeeId } = verifyToken(token, process.env.SECRET_KEY)
    const { month, year } = req.params;

    const queryDate = new Date(`${year}-${month}`);
    const queryMonth = queryDate.getMonth() + 1;

    const query = `SELECT id, checkin, created_at, checkout, work_type, working_hours, note, activity, check_in_time, check_out_time 
      FROM transactions 
      WHERE employee_id = $1
      AND EXTRACT(MONTH FROM created_at) = $2
      AND EXTRACT(YEAR FROM created_at) = $3`;

    const values = [employeeId, queryMonth, queryDate.getFullYear()];

    const { rows } = await client.query(query, values);

    const data = rows.map(item => {
      let checkin = {}
      let checkout = {}
      let checkIn = JSON.parse(item.checkin);
      let checkOut = JSON.parse(item.checkout);
      if (item.check_in_time !== null) {
        checkin.check_in_time = formatterDate(item.check_in_time)
      }
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
        is_leave: item.work_type != 'WFO' || item.work_type != 'WFH' ? true : false,
        leave_type: item.work_type,
        leave_description: item.activity,
        day: formatterDateTwo(item.created_at),
        day_off: formatterDayOff(formatterDate(item.created_at))
      };
    });

    responHelper(res, statusResponse.OK.code, { data, message: `${data.length > 0 ? 'Data Ditemukan.' : 'Data Kosong'}` });
  } catch (error) {
    console.log(error)
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

attendanceRoutes.get('/transaction/:transactionId', async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authenticateUser(token);

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
      checkin.check_in_time = formatterDate(item.check_in_time)
      checkin.latitude = checkIn.latitude ? checkIn.latitude : null
      checkin.longitude = checkIn.longitude ? checkIn.longitude : null
      checkin.status = checkIn.status ? checkIn.status : null

      if (checkOut !== null) {
        checkout.check_out_time = formatterDate(item.check_out_time)
        checkout.latitude = checkOut?.latitude
        checkout.longitude = checkOut?.longitude
        checkout.status = checkOut?.status
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
    let auth = authenticateUser(token);

    if (auth.status !== 200) {
      return responHelper(res, auth.status, { data: auth });
    }

    const { employeeId } = verifyToken(token, process.env.SECRET_KEY);

    const { check_in_time, latitude, longitude, status, work_type } = req.body

    const now = new Date();

    const utcPlus7 = new Date(now.getTime() + 7 * 3600 * 1000);

    const timestamp = utcPlus7.toISOString();

    const checkInTime = timestamp.replace("T", " ").replace("Z", "")

    const checkin = { latitude, longitude, status };

    const queryCheck = `SELECT checkin, created_at
    FROM transactions
    WHERE employee_id = $1
    ORDER BY created_at DESC
    LIMIT 1;     
    `;

    const { rows } = await client.query(queryCheck, [employeeId]);

    if (rows[0].checkin !== null) {
      return responHelper(res, statusResponse.BAD_REQUEST.code, { message: 'Anda sudah checkin hari ini.' });
    }

    const query = `UPDATE transactions
    SET checkin = $1, check_in_time = $2, work_type = $3
    WHERE (employee_id = $4 AND created_at = (SELECT MAX(created_at) FROM transactions WHERE employee_id = $4));
    `;
    
    await client.query(query, [JSON.stringify(checkin), checkInTime, work_type, employeeId]);

    responHelper(res, statusResponse.OK.code, { data: null, message: 'Checkin berhasil.' });
  } catch (error) {
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

attendanceRoutes.post('/checkout/:id?', checkout, async (req, res) => {
  let token = req.header("token")
  let auth = authenticateUser(token)

  if (auth.status !== 200) {
    return responHelper(res, auth.status, { data: auth })
  } else {
    const { id } = req.params
    const { note, activity, check_out_time, latitude, longitude, status } = req.body
    if (id) {
      try {
        const query = `UPDATE transactions 
        SET checkout = $1, note = $2, activity = $3, working_hours = $4, check_out_time = $5
        WHERE id = $6
        `;

        const now = new Date();

        const utcPlus7 = new Date(now.getTime() + 7 * 3600 * 1000);

        const timestamp = utcPlus7.toISOString();

        const checkout = { latitude, longitude, status }

        const queryCheck = `
          SELECT checkin, checkout, check_in_time
          FROM transactions
          WHERE id = $1
        `;

        const { rows } = await client.query(queryCheck, [id]);

        const checkInTime = formatterDate(rows[0].check_in_time);

        const startTimestamp = new Date(`${checkInTime}`).getTime();
        const endTimestamp = new Date(`${timestamp}`).getTime();
        const workingHours = calculateWorkingHours(startTimestamp, endTimestamp);

        const values = [JSON.stringify(checkout), note, activity, workingHours, timestamp.replace("T", " ").replace("Z", ""), id]
        await client.query(query, values);

        responHelper(res, statusResponse.OK.code, { message: 'Checkout berhasil.' });
      } catch (error) {
        responHelper(res, statusResponse.INTERNAL_SERVER_ERROR.code, { message: 'Internal server error.' });
      }
    } else {
      try {
        const { employeeId } = verifyToken(token, process.env.SECRET_KEY);

        const today = new Date(check_out_time * 1000);
        const timestamp = formatterDate(today);

        const checkout = { latitude, longitude, status }

        const queryCheck = `
          SELECT checkin, checkout, check_in_time
          FROM transactions
          WHERE employee_id = $1
          ORDER BY created_at DESC
          LIMIT 1;
        `;

        const { rows } = await client.query(queryCheck, [employeeId]);

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
        WHERE (employee_id = $6 AND created_at = (SELECT MAX(created_at) FROM transactions WHERE employee_id = $6))
        `;
        const values = [JSON.stringify(checkout), note, activity, workingHours, timestamp, employeeId]

        await client.query(query, values);

        responHelper(res, statusResponse.OK.code, { message: 'Checkout berhasil.' });
      } catch (error) {
        responHelper(res, statusResponse.INTERNAL_SERVER_ERROR.code, { message: 'Internal server error.' });
      }
    }
  }
});

attendanceRoutes.post('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params
    const query = `DELETE FROM transactions WHERE id = $1`
    await client.query(query, [id])

    responHelper(res, 200, { message: 'Delete berhasil.' });
  } catch (error) {
    responHelper(res, statusResponse.INTERNAL_SERVER_ERROR.code, { message: 'Internal server error.' });
  }
});

attendanceRoutes.post('/correction/:id', correction, async (req, res) => {
  let token = req.header("token")
  let auth = authenticateUser(token)

  if (auth.status !== 200) {
    return responHelper(res, auth.status, { data: auth });
  } else {
    try {
      const { id } = req.params;
      if (!id) {
        responHelper(res, statusResponse.BAD_REQUEST.code, { message: statusResponse.BAD_REQUEST.message });
      }
      const { activity, note } = req.body;
      const query = `UPDATE transactions SET activity = $1, note = $2 WHERE id = $3`;
      await client.query(query, [activity, note, id]);

      responHelper(res, 200, { message: 'Correction berhasil.' });
    } catch (error) {
      responHelper(res, statusResponse.INTERNAL_SERVER_ERROR.code, { message: 'Internal server error.' });
    }
  }
});

attendanceRoutes.get('/permission', async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authenticateUser(token);

    if (auth.status !== 200) {
      return responHelper(res, auth.status, { data: auth })
    }

  } catch (error) {
    console.log(error)
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

export default attendanceRoutes;
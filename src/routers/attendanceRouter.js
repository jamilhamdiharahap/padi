import express from "express";
import { responHelper } from "../helper/responHelper.js";
import axios from "axios";


const attendanceRoutes = express.Router();

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


export default attendanceRoutes;
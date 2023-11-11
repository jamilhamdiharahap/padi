import express from "express";
import schedule from "node-schedule";
import accountRoutes from "./user.js";
import attendanceRoutes from "./attendance.js";
import questionRouter from "./question.js";
import divisionRouter from "./devision.js";
import { scheduleTransaction } from "../helper/scheduleHelper.js";
// import { CronJob } from 'cron';

const routers = express.Router();


const rule = new schedule.RecurrenceRule();
rule.hour = 6;
rule.minute = 27;

schedule.scheduleJob(rule, function () {
  scheduleTransaction();
  console.log('Scheduled task executed at 12 AM');
});

// const job = new CronJob('26 6 * * *',
// 	function () {
//     scheduleTransaction()
//     console.log('Scheduled task executed at 1 AM');
// 	}, 
// 	null,
// 	true,
// 	'Asia/Jakarta'
// );

routers.use((req, res, next) => {
  const apiKey = req.header("API-KEY");
  if (!apiKey) {
    return res.status(401).json({ error: "Header API-KEY tidak ada." });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "INVALID API-KEY!" });
  }
  next();
});

routers.use("/api/v1", accountRoutes);
routers.use("/api/v1", questionRouter);
routers.use("/api/v1", divisionRouter);
routers.use("/api/v1", attendanceRoutes);

export default routers;
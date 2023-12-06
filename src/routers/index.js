import express from "express";
import accountRoutes from "./user.js";
import attendanceRoutes from "./attendance.js";
import questionRouter from "./question.js";
import divisionRouter from "./devision.js";
import scheduleRouter from "./cron.js";

const routers = express.Router();

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
routers.use("/api/v1", scheduleRouter)

export default routers;
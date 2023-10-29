import express from "express";
import accountRoutes from "./accountRouter.js";
import attendanceRoutes from "./attendanceRouter.js";
import dotenv from "dotenv";
import questionRouter from "./questionRouter.js";
import divisionRouter from "./devisionRouter.js";
dotenv.config()

const routers = express.Router();

routers.use((req, res, next) => {
 const apiKey = req.header("API-KEY");
 if (!apiKey) {
   return res.status(401).json({ error: "Header API-KEY tidak ada" });
 }
 if (apiKey !== 'p@di@2023') {
   return res.status(401).json({ error: "INVALID API-KEY!" });
 }
 next();
});

routers.use("/api/v1", accountRoutes);
routers.use("/api/v1", questionRouter);
routers.use("/api/v1", divisionRouter);
routers.use("/api/v1", attendanceRoutes);

export default routers;
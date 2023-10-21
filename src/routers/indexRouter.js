import express from "express";
import accountRoutes from "./accountRouter.js";
import attendanceRoutes from "./attendanceRouter.js";
import dotenv from "dotenv";
import questionRouter from "./questionRouter.js";
import divisionRouter from "./devisionRouter.js";
dotenv.config()

const routers = express.Router();


routers.use("/api/v1", accountRoutes);
routers.use("/api/v1", attendanceRoutes);
routers.use("/api/v1", questionRouter);
routers.use("/api/v1", divisionRouter);


export default routers;
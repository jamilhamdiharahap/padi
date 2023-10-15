import express from "express";
import accountRoutes from "./accountRouter.js";
import attendanceRoutes from "./attendanceRouter.js";
import dotenv from "dotenv";
import questionRouter from "./questionRouter.js";
dotenv.config()

const routers = express.Router();


routers.use("/api/v1", accountRoutes);
routers.use("/api/v1", attendanceRoutes);
routers.use("/api/v1", questionRouter);


export default routers;
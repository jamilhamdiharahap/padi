import express from "express";
import accountRoutes from "./accountRouter.js";
import dotenv from "dotenv";
dotenv.config()

const routers = express.Router();


routers.use("/api/v1", accountRoutes);


export default routers;
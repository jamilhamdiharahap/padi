import express from "express";
import routers from "./src/routers/index.js";
import 'dotenv/config.js'
import { scheduleTransaction } from "./src/helper/scheduleHelper.js";

const app = express();


app.use(express.json());

app.get("/api/v1", (_, res) => {
    res.status(200).json({ message: "Welcome To Padi!" });
});

app.get("/api/cron", async (req, res, next) => {
    await scheduleTransaction();
    next();
});

app.use(routers);


app.listen(3000, () => {
    console.log("aplication running ...");
});
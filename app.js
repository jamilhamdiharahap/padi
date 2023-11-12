import express from "express";
import routers from "./src/routers/index.js";
import 'dotenv/config.js'
import { scheduleTransaction } from "./src/helper/scheduleHelper.js";

const app = express();


app.use(express.json());

app.get("/api/v1", (_, res) => {
    res.status(200).json({ message: "Welcome To Padi!" });
});

export const schedule = async function (event) {
    scheduleTransaction();
    console.log("Scheduled task ran at", new Date().toISOString());
    return {
        statusCode: 200,
        body: "Scheduled task completed successfully!",
    };
};

app.use(routers);


app.listen(3000, () => {
    console.log("aplication running ...");
});
import express from "express";
import routers from "./src/routers/index.js";
import 'dotenv/config.js'

const app = express();


app.use(express.json());

app.get("/api/v1", (_, res) => {
    res.status(200).json({ message: "Welcome To Padi!!" });
});

app.use(routers);


app.listen(3001, () => {
    console.log("aplication running ...");
});
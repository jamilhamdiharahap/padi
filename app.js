import express from "express";
import routers from "./src/routers/index.js";
import cors from 'cors';
import 'dotenv/config.js'

const app = express();


app.use(express.json());
app.use(cors());

app.get("/api/v1", (_, res) => {
    res.status(200).json({ message: "Welcome To Padi!!" });
});

app.use(routers);


app.listen(3000, () => {
    console.log("aplication running ...");
});
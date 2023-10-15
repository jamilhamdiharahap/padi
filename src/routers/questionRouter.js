import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { client } from "../connection/database.js";


const questionRouter = express.Router();

questionRouter.get("/question", async (req, res) => {
 try {
   const query = `SELECT * FROM questions`;
   const { rows } = await client.query(query);

   return responHelper(res, 200, { data: rows, message: 'Data berhasil ditemukan.' });
 } catch (error) {
  res.status(500).json({ message: error });
 }
});


export default questionRouter;
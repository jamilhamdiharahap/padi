import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { client } from "../connection/database.js";


const scheduleRouter = express.Router();

scheduleRouter.get("/schedule", async (req, res) => {
 try {
  const queryEmployee = `SELECT id FROM employees`;
  const { rows } = await client.query(queryEmployee)
  const today = new Date().toLocaleDateString();
  const month = today.slice(0, 2)
  const day = today.slice(3, 5)
  const year = today.slice(6, 10)

  let formatToday = [year, month, day].join('-');

  rows.map(async item => {
   const query = `INSERT INTO transactions (employee_id, created_at) VALUES ($1, $2)`;
   await client.query(query, [item.id, formatToday])
  })
  responHelper(res, 200, { message: 'schedule OK.' });
 } catch (error) {
  responHelper(res, 500, { message: 'Error Schedule!.' });
 }
})


export default scheduleRouter;
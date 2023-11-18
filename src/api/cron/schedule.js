import express from 'express'
import { client } from '../../connection/database.js'

const app = express()

app.get("/", async (req, res) => {
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
  res.status(200).send("schedule OK.")
 } catch (error) {
  console.log("Error Schedule!")
 }
})
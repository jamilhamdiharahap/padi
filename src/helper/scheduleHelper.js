import { client } from "../connection/database.js"

export async function scheduleTransaction() {
 try {
  const queryEmployee = `SELECT id FROM employees`;
  const { rows } = await client.query(queryEmployee)

  rows.map(async item => {
   const query = `INSERT INTO transactions (employee_id) VALUES ($1)`;
   await client.query(query, [item.id])
  })
 } catch (error) {
  console.log("Error Schedule!")
 }
}
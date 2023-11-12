import { client } from "../connection/database.js"

export async function scheduleTransaction() {
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
 } catch (error) {
  console.log(error)
  console.log("Error Schedule!")
 }
}
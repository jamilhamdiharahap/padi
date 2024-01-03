import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { client } from "../connection/database.js";
import { verifyToken } from "../utils/tokenVerify.js";
import { authenticateUser } from "../utils/auth.js";


const scheduleRouter = express.Router();

scheduleRouter.get("/schedule", async (req, res) => {
 let token = req.header("token");
 let auth = authenticateUser(token);

 if (auth.status !== 200) {
  return responHelper(res, auth.status, { data: auth })
 } else {
  try {
   const { employeeId } = verifyToken(token, process.env.SECRET_KEY)
   const createdAt = new Date().toISOString();

   const checkQuery = `SELECT * FROM transactions WHERE employee_id = $1 AND created_at = $2`
   const checkResult = await client.query(checkQuery, [employeeId, createdAt])

   if (checkResult.rows.length > 0) {
    return responHelper(res, 400, { message: 'Already scheduled for today.' })
   }

   const query = `INSERT INTO transactions (employee_id, created_at) VALUES ($1, $2)`
   await client.query(query, [employeeId, createdAt])

   responHelper(res, 200, { message: 'schedule OK.' });
  } catch (error) {
   console.log(error)
   responHelper(res, 500, { message: 'Error Schedule!.' });
  }
 }
})


export default scheduleRouter;
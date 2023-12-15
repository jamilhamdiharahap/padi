import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { client } from "../connection/database.js";
import { verifyToken } from "../utils/tokenVerify.js";


const scheduleRouter = express.Router();

scheduleRouter.get("/schedule", async (req, res) => {
 let token = req.header("token");
 let auth = authenticateUser(token);

 if (auth.status !== 200) {
  return responHelper(res, auth.status, { data: auth })
 } else {
  try {
   const { employeeId } = verifyToken(token, process.env.SECRET_KEY)
   const today = new Date().toLocaleDateString();
   const month = today.slice(0, 2)
   const day = today.slice(3, 5)
   const year = today.slice(6, 10)

   let formatToday = [year, month, day].join('-');
   const query = `INSERT INTO transactions (employee_id, created_at) VALUES ($1, $2)`;
   await client.query(query, [employeeId, formatToday])

   responHelper(res, 200, { message: 'schedule OK.' });
  } catch (error) {
   responHelper(res, 500, { message: 'Error Schedule!.' });
  }
 }
})


export default scheduleRouter;
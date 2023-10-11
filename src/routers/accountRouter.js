import express from "express";
import { generateRandomNumber } from "../helper/generateCode.js";
import { resigterValidation, login } from "../utils/validation.js";
import { client } from "../connection/database.js";
import { responHelper } from "../helper/responHelper.js";
import CryptoJS from "crypto-js";
import { createToken } from "../utils/auth.js";
const accountRoutes = express.Router();


accountRoutes.post("/login", login, async (req, res) => {
 try {
  const { username, password } = req.body;

  const query = `
    SELECT a.name, a.username, a.password, a.student_id_number, a.access_code, a.reminder, b.status 
    FROM accounts a
    INNER JOIN roles b ON a.role_id = b.id
    WHERE a.username = $1 OR a.student_id_number = $1
  `;

  const { rows } = await client.query(query, [username]);

  if (rows.length === 0) {
   return responHelper(res, 400, { data: null, message: 'Nim Tidak Ditemukan' });
  }

  const user = rows[0];
  const comparePassword = CryptoJS.AES.decrypt(user.password, process.env.HASING_KEY).toString(CryptoJS.enc.Utf8);

  if (comparePassword !== password) {
   return responHelper(res, 400, {data: null, message: 'Invalid password' });
  }

  const tokenPayload  = {
   id: user.id,
   username: user.username,
   status: user.status,
  }

  const token = createToken(tokenPayload);
  responHelper(res, 200, { data: user, token, message: 'Login successful' });
 } catch (error) {
  res.status(500).json({ error: 'An error occurred while logging in' });
 }
});

async function checkIfExists(column, value) {
 const query = `SELECT EXISTS (SELECT 1 FROM accounts WHERE ${column} = $1)`;
 const { rows } = await client.query(query, [value]);
 return rows[0].exists;
}

accountRoutes.post("/register", resigterValidation, async (req, res) => {
 try {
  const { name, username, reminder, student_id_number, password } = req.body;

  const usernameExists = await checkIfExists('username', username);
  const nimExists = await checkIfExists('student_id_number', student_id_number);

  if (usernameExists) {
   return responHelper(res, 400, { data: null, message: 'Username sudah terdaftar' });
  }

  if (nimExists) {
   return responHelper(res, 400, { data: null, message: 'NIM sudah terdaftar' });
  }

  const hashPassword = CryptoJS.AES.encrypt(password, process.env.HASING_KEY).toString();

  const query = 'INSERT INTO accounts (name, access_code, reminder, student_id_number, role_id, password, username) VALUES ($1, $2, $3, $4, $5, $6, $7)';
  await client.query(query, [name, generateRandomNumber(), reminder.toUpperCase(), student_id_number, "baa2f5ff-3736-446b-8276-54d760808430", hashPassword, username]);

  return responHelper(res, 200, { message: 'Registrasi berhasil' });
 } catch (error) {
  return responHelper(res, 500, { message: 'Gagal menambahkan pengguna ke database' });
 }
});


export default accountRoutes;
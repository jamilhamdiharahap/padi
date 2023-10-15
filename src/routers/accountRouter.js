import express from "express";
import { generateRandomNumber } from "../helper/generateCode.js";
import { resigterValidation, login, forgetPassword } from "../utils/validation.js";
import { client } from "../connection/database.js";
import { responHelper } from "../helper/responHelper.js";
import CryptoJS from "crypto-js";
import { createToken } from "../utils/auth.js";
const accountRoutes = express.Router();


accountRoutes.post("/login", login, async (req, res) => {
  try {
    const { email, password } = req.body;

    const query = `
    SELECT a.email, a.password, a.access_code, a.reminder, b.status 
    FROM accounts a
    INNER JOIN roles b ON a.role_id = b.id
    WHERE a.email = $1
  `;

    const { rows } = await client.query(query, [email]);

    if (rows.length === 0) {
      return responHelper(res, 400, { data: null, message: 'Email Tidak Ditemukan' });
    }

    const user = rows[0];
    const comparePassword = CryptoJS.AES.decrypt(user.password, process.env.HASING_KEY).toString(CryptoJS.enc.Utf8);

    if (comparePassword !== password) {
      return responHelper(res, 400, { data: null, message: 'Invalid password' });
    }

    const tokenPayload = {
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
    const { email, reminder, question, password } = req.body;

    const usernameExists = await checkIfExists('email', email);

    if (usernameExists) {
      return responHelper(res, 400, { data: null, message: 'Email sudah terdaftar' });
    }

    const hashPassword = CryptoJS.AES.encrypt(password, process.env.HASING_KEY).toString();

    const query = `INSERT INTO accounts (access_code, reminder, role_id, password, email, question)
                VALUES ($1, $2, $3, $4, $5, $6)`;

    await client.query(query, [generateRandomNumber(), reminder.toUpperCase(), "baa2f5ff-3736-446b-8276-54d760808430", hashPassword, email, question]);

    return responHelper(res, 200, { message: 'Registrasi berhasil' });
  } catch (error) {
    return responHelper(res, 500, { message: 'Gagal menambahkan pengguna ke database' });
  }
});

accountRoutes.post("/check-account", async (req, res) => {
  try {
    const { email, question, question_answer } = req.body

    const emailExists = await checkIfExists('email', email);

    if (!emailExists) {
      return responHelper(res, 400, { data: null, message: 'Email tidak valid.' });
    }

    const questionExists = await checkIfExists('question', question);
    if (!questionExists) {
      return responHelper(res, 400, { data: null, message: 'Pertanyaan tidak valid.' });
    }

    const reminderExists = await checkIfExists('reminder', question_answer.toUpperCase());
    if (!reminderExists) {
      return responHelper(res, 400, { data: null, message: 'Jawaban tidak valid.' });
    }

    return responHelper(res, 200, { data: null, message: 'Akun valid.' });
  } catch (error) {
    return responHelper(res, 500, { message: 'Internal server error.' });
  }
});


accountRoutes.post("/forgot-password", forgetPassword, async (req, res) => {
  try {
    const { email, new_password } = req.body

    const query = `UPDATE accounts SET password = $1 WHERE email = $2`

    const hashPassword = CryptoJS.AES.encrypt(new_password, process.env.HASING_KEY).toString();

    const { rowCount } = await client.query(query, [hashPassword, email]);
    if (rowCount === 1) {
      return responHelper(res, 200, { message: 'Berhasil mengganti password.' });
    } else {
      return responHelper(res, 404, { message: 'Email tidak ditemukan.' });
    }
  } catch (error) {
    return responHelper(res, 500, { message: 'Internal server error.' });
  }
});



export default accountRoutes;
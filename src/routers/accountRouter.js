import express from "express";
import { generateRandomNumber } from "../helper/generateCode.js";
import { registerValidation, login, forgetPassword } from "../utils/validation.js";
import { client } from "../connection/database.js";
import { responHelper } from "../helper/responHelper.js";
import CryptoJS from "crypto-js";
import { createToken } from "../utils/auth.js";
const accountRoutes = express.Router();


function comparePasswords(encryptedPassword, plainTextPassword, hashingKey) {
  const decryptedPassword = CryptoJS.AES.decrypt(encryptedPassword, hashingKey).toString(CryptoJS.enc.Utf8);
  return decryptedPassword === plainTextPassword;
}

accountRoutes.post("/login", login, async (req, res) => {
  try {
    const { email, password } = req.body;

    const accountQuery = `
      SELECT a.id, a.email, a.password, a.access_code, a.reminder, b.status 
      FROM accounts a
      INNER JOIN roles b ON a.role_id = b.id
      WHERE a.email = $1
    `;

    const { rows } = await client.query(accountQuery, [email]);

    if (rows.length === 0) {
      return responHelper(res, 400, { data: null, message: 'Email Tidak Ditemukan' });
    }

    const user = rows[0];

    if (!comparePasswords(user.password, password, process.env.HASING_KEY)) {
      return responHelper(res, 400, { data: null, message: 'Invalid password' });
    }

    const employeeQuery = `
      SELECT a.name, a.nip, a.date_of_birth, a.address, a.id as employee_id, a.religion, b.position_name, c.division_name
      FROM employees a
      INNER JOIN positions b ON a.position_id = b.id
      INNER JOIN divisions c ON c.id = b.division_id
      WHERE account_id = $1
    `;

    const employeeItem = await client.query(employeeQuery, [user.id]);
    const employee = employeeItem.rows[0];

    const tokenPayload = {
      id: user.id,
      username: user.username,
      status: user.status,
    };

    user.name = employee.name;
    user.nip = employee.nip;
    user.date_of_birth = employee.date_of_birth;
    user.address = employee.address;
    user.religion = employee.religion;
    user.employee_id = employee.employee_id;
    user.position_name = employee.position_name;
    user.division_name = employee.division_name;
    user.latitude = parseFloat('-6.235064');
    user.longitude  = parseFloat('106.821506');

    const token = createToken(tokenPayload);
    responHelper(res, 200, { data: user, token, message: 'Login successful' });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'An error occurred while logging in' });
  }
});

async function checkIfExists(column, value) {
  const query = `SELECT EXISTS (SELECT 1 FROM accounts WHERE ${column} = $1)`;
  const { rows } = await client.query(query, [value]);
  return rows[0].exists;
}

async function checkIfQuestion(email, question) {
  const query = `SELECT EXISTS (SELECT 1 FROM accounts WHERE question = $1 AND email = $2)`;
  const { rows } = await client.query(query, [question, email]);
  return rows[0].exists;
}

accountRoutes.post("/register", registerValidation, async (req, res) => {
  try {
    const { email, reminder, question, password, full_name, date_of_birth, position } = req.body;

    const usernameExists = await checkIfExists('email', email);

    if (usernameExists) {
      return responHelper(res, 400, { data: null, message: 'Email sudah terdaftar' });
    }

    const hashPassword = CryptoJS.AES.encrypt(password, process.env.HASING_KEY).toString();

    const query = `INSERT INTO accounts (access_code, reminder, role_id, password, email, question)
                VALUES ($1, $2, $3, $4, $5, $6)`;

    const check = await client.query(query, [generateRandomNumber(), reminder.toUpperCase(), "baa2f5ff-3736-446b-8276-54d760808430", hashPassword, email, question]);
    if (check.command === 'INSERT') {
      const queryAccount = `SELECT id FROM accounts WHERE email = $1`;
      const { rows } = await client.query(queryAccount, [email])

      const query = `INSERT INTO employees (name, date_of_birth, position_id, account_id)
      VALUES ($1, $2, $3, $4)`;

      const employees = await client.query(query, [full_name, date_of_birth, position, rows[0].id]);
      if (employees.command !== 'INSERT') {
        const deleteAccount = `DELETE FROM accounts WHERE email = $1`;
        await client.query(deleteAccount, [email]);
        return responHelper(res, 400, { message: 'Registrasi Gagal.' });
      }
    } else {
      return responHelper(res, 400, { message: 'Registrasi Gagal.' });
    }

    return responHelper(res, 200, { message: 'Registrasi berhasil.' });
  } catch (error) {
    console.log(error)
    return responHelper(res, 500, { message: 'Gagal menambahkan pengguna ke database.' });
  }
});

accountRoutes.post("/check-account", async (req, res) => {
  try {
    const { email, question, question_answer } = req.body

    const emailExists = await checkIfExists('email', email);

    if (!emailExists) {
      return responHelper(res, 400, { data: null, message: 'Email tidak valid.' });
    }

    const questionExists = await checkIfQuestion(email, question);

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
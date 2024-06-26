import express from "express";
import { generateRandomNumber } from "../helper/generateCode.js";
import {
  registerValidation,
  login,
  forgetPassword,
  checkAccount
} from "../utils/validation.js";
import { client } from "../connection/database.js";
import { responHelper } from "../helper/responHelper.js";
import CryptoJS from "crypto-js";
import { authenticateUser , createToken } from "../utils/auth.js";
import { verifyToken } from "../utils/tokenVerify.js";
import { comparePasswords } from "../helper/comparePassword.js";
import statusResponse from "../utils/status.js";

const accountRoutes = express.Router();

async function checkIfExists(column, value) {
  const query = `SELECT EXISTS (SELECT 1 FROM accounts WHERE ${column} = $1)`;
  const { rows } = await client.query(query, [value]);
  return rows[0].exists;
};

async function checkIfQuestion(email, question) {
  const query = `SELECT EXISTS (SELECT 1 FROM accounts WHERE question = $1 AND email = $2)`;
  const { rows } = await client.query(query, [question, email]);
  return rows[0].exists;
};

accountRoutes.post("/login", login, async (req, res) => {
  try {
    const { email, password } = req.body;

    const accountQuery = `
      SELECT a.id, a.email, a.password, a.access_code, a.device_access, a.reminder, b.status 
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

    if (user.device_access) {
      return responHelper(res, 400, { data: null, message: 'Akun anda login di device lain.' });
    } else {
      const deviceQuery = `UPDATE accounts SET device_access = $1 WHERE id = $2`
      await client.query(deviceQuery, [true, user.id])
    }

    const employeeQuery = `
      SELECT a.name, a.nip, a.date_of_birth, a.address, a.religion, a.id, b.position_name, c.division_name, d.latitude, d.longitude, d.name as office_name
      FROM employees a
      INNER JOIN positions b ON a.position_id = b.id
      INNER JOIN divisions c ON c.id = b.division_id
      INNER JOIN office_locations d ON d.id = a.location_id
      WHERE account_id = $1
    `;

    const employeeItem = await client.query(employeeQuery, [user.id]);
    const { id, name, nip, date_of_birth, division_name, position_name, religion, address, latitude, longitude, office_name } = employeeItem.rows[0];

    const tokenPayload = {
      employeeId: id
    };

    const transactionQuery = `
      SELECT id, check_in_time, check_out_time
      FROM transactions
      WHERE (employee_id = $1 AND created_at = (SELECT MAX(created_at) FROM transactions WHERE employee_id = $1))
    `;

    const transaction = await client.query(transactionQuery, [id]);

    user.name = name;
    user.nip = nip;
    user.date_of_birth = date_of_birth;
    user.address = address;
    user.religion = religion;
    user.position_name = position_name;
    user.division_name = division_name;
    user.latitude = parseFloat(latitude);
    user.longitude = parseFloat(longitude);
    user.office_name = office_name;
    if(transaction.rows.length > 0){
      user.transaction_id = transaction.rows[0].id
    }else{
      user.transaction_id = null
    }

    const token = createToken(tokenPayload);
    responHelper(res, 200, { data: user, token, message: 'Login successful' });
  } catch (error) {
    console.log(error)
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

accountRoutes.post("/web/login", login, async (req, res) => {
  try {
    const { email, password } = req.body;

    const accountQuery = `
      SELECT a.id, a.email, a.password, a.access_code, a.device_access, a.reminder, b.status 
      FROM accounts a
      INNER JOIN roles b ON a.role_id = b.id
      WHERE a.email = $1 AND b.status = $2
    `;

    const { rows } = await client.query(accountQuery, [email, 'ADMIN']);

    if (rows.length === 0) {
      return responHelper(res, 400, { data: null, message: 'Email Tidak Ditemukan' });
    }

    const user = rows[0];

    if (!comparePasswords(user.password, password, process.env.HASING_KEY)) {
      return responHelper(res, 400, { data: null, message: 'Invalid password' });
    }

    const employeeQuery = `
      SELECT a.name, a.nip, a.date_of_birth, a.address, a.religion, a.id, b.position_name, c.division_name
      FROM employees a
      INNER JOIN positions b ON a.position_id = b.id
      INNER JOIN divisions c ON c.id = b.division_id
      WHERE account_id = $1
    `;

    const employeeItem = await client.query(employeeQuery, [user.id]);

    const tokenPayload = {
      employeeItem
    };

    const token = createToken(tokenPayload);
    responHelper(res, 200, { data: user, token, message: 'Login successful' });
  } catch (error) {
    console.log(error)
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

accountRoutes.post("/register", registerValidation, async (req, res) => {
  try {
    const { email, reminder, question, password, full_name, date_of_birth, position, location_id } = req.body;

    const usernameExists = await checkIfExists('email', email);

    if (usernameExists) {
      return responHelper(res, 400, { data: null, message: 'Email sudah terdaftar' });
    }

    const hashPassword = CryptoJS.AES.encrypt(password, process.env.HASING_KEY).toString();

    const query = `INSERT INTO accounts (access_code, reminder, role_id, password, email, question, device_access)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`;

    const check = await client.query(query, [generateRandomNumber(), reminder.toUpperCase(), "baa2f5ff-3736-446b-8276-54d760808430", hashPassword, email, question, false]);
    if (check.command === 'INSERT') {
      const queryAccount = `SELECT id FROM accounts WHERE email = $1`;
      const { rows } = await client.query(queryAccount, [email])

      const query = `INSERT INTO employees (name, date_of_birth, position_id, account_id, location_id)
      VALUES ($1, $2, $3, $4, $5)`;

      const employees = await client.query(query, [full_name, date_of_birth, position, rows[0].id, location_id]);
      if (employees.command !== 'INSERT') {
        const deleteAccount = `DELETE FROM accounts WHERE email = $1`;
        await client.query(deleteAccount, [email]);
        return responHelper(res, 400, { message: 'Registrasi Gagal.' });
      }
    } else {
      return responHelper(res, 400, { message: 'Registrasi Gagal.' });
    }

    responHelper(res, 200, { message: 'Registrasi berhasil.' });
  } catch (error) {
    responHelper(res, 500, { message: 'Gagal menambahkan pengguna ke database.' });
  }
});

accountRoutes.post("/check-account", checkAccount, async (req, res) => {
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

    responHelper(res, 200, { data: null, message: 'Akun valid.' });
  } catch (error) {
    responHelper(res, 500, { message: 'Internal server error.' });
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
    responHelper(res, 500, { message: 'Internal server error.' });
  }
});

accountRoutes.post("/edit-profile", async (req, res) => {
  try {
    let token = req.header("token");
    let auth = authenticateUser (token);
    if (auth.status !== 200) {
      return responHelper(res, auth.status, { data: auth })
    }

    const { full_name, date_of_birth, nip, address, religion } = req.body

    const { employeeId } = verifyToken(token, process.env.SECRET_KEY)

    const query = `UPDATE employees SET name = $1, date_of_birth = $2, nip = $3, address = $4, religion = $5 WHERE id = $6`
    const values = [full_name, date_of_birth, nip, address, religion, employeeId]

    await client.query(query, values)

    responHelper(res, statusResponse.OK.code, { message: 'Berhasil Memperbaharui profil.' });
  } catch (error) {
    responHelper(res, statusResponse.INTERNAL_SERVER_ERROR.code, { message: 'Internal server error.' });
  }
});

accountRoutes.post("/logout", async (req, res) => {
  let token = req.header("token");
  let auth = authenticateUser (token);

  if (auth.status !== 200) {
    return responHelper(res, auth.status, { data: auth })
  } else {
    try {
      const { employeeId } = verifyToken(token, process.env.SECRET_KEY)
      const query = `UPDATE accounts SET device_access = $1 WHERE id = (SELECT account_id FROM employees WHERE id = $2)`
      await client.query(query, [false, employeeId])
      responHelper(res, 200, { data: null, message: 'Logout successful' });
    } catch (error) {
      responHelper(res, 500, { message: 'Internal server error.' })
    }
  }

});

export default accountRoutes;
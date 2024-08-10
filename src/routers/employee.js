import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { client } from "../connection/database.js";
import { authenticateUser } from "../utils/auth.js";


const employeeRouter = express.Router();

employeeRouter.get("/employee", async (req, res) => {

    let token = req.header("token");
    let auth = authenticateUser(token);

    if (auth.status !== 200) {
        return responHelper(res, auth.status, { data: auth })
    } else {
        try {
            const { keyword = '', page = 1, limit = 10 } = req.query;

            const offset = (page - 1) * limit;

            let query = 'SELECT * FROM employees WHERE name ILIKE $1 LIMIT $2 OFFSET $3';
            let querycount = 'SELECT count(*) FROM employees WHERE name ILIKE $1';

            let queryParams = [`%${keyword}%`, limit, offset];

            const { rows } = await client.query(query, queryParams);
            const total_elements = await client.query(querycount, [`%${keyword}%`]);

            const paging = {
                total_elements: parseInt(total_elements.rows[0].count),
                total_Pages: Math.ceil(total_elements.rows[0].count / limit)
            }

            responHelper(res, 200, { data: rows, paging, message: 'Data berhasil ditemukan.' });
        } catch (error) {
            console.error(error);
            responHelper(res, 500, { message: 'Internal server error.' });
        }
    }
});

employeeRouter.post("/employee-delete", async (req, res) => {
    const { id } = req.body

    let token = req.header("token");
    let auth = authenticateUser(token);

    if (auth.status !== 200) {
        return responHelper(res, auth.status, { data: auth })
    } else {
        try {

            const queryTransaction = 'DELETE FROM transactions WHERE employee_id = $1'
            await client.query(queryTransaction, [id])

            const queryAccountId = 'SELECT account_id FROM employees WHERE id = $1'
            const rows = await client.query(queryAccountId, [id])

            const queryEmployee = 'DELETE FROM employees WHERE id = $1'
            await client.query(queryEmployee, [id])
            
            const queryAccount = 'DELETE FROM accounts WHERE id = $1'
            await client.query(queryAccount, [rows.rows[0].account_id])

            responHelper(res, 200, { message: 'Data berhasil dihapus.' });
        } catch (error) {
            console.error(error);
            responHelper(res, 500, { message: 'Internal server error.' });
        }
    }
});


export default employeeRouter;
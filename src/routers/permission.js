import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { client } from "../connection/database.js";
import { verifyToken } from "../utils/tokenVerify.js";
import { authenticateUser } from "../utils/auth.js";


const permissionRouter = express.Router();

permissionRouter.post('/permission', async (req, res) => {
    let token = req.header("token");
    let auth = authenticateUser(token);

    if (auth.status !== 200) {
        return responHelper(res, auth.status, { data: auth })
    } else {
        try{
            const { status, start_date, end_date, reason } = req.body


            const { employeeId } = verifyToken(token, process.env.SECRET_KEY)

            if (!start_date || !end_date) {
                return responHelper(res, 400, { message: 'Tanggal mulai dan tanggal akhir harus disediakan.' });
            }

            const startDate = new Date(start_date);
            const endDate = new Date(end_date);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return responHelper(res, 400, { message: 'Format tanggal tidak valid.' });
            }

            const timeDiff = endDate.getTime() - startDate.getTime();
            const dayDiff = timeDiff / (1000 * 3600 * 24) + 1;


            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth();


            const queryCheckPermission = 'SELECT COUNT(*) FROM transactions WHERE employee_id = $1 AND work_type = $2 AND EXTRACT(YEAR FROM created_at) = $3'
            const rows = await client.query(queryCheckPermission, [employeeId, status, currentDate.getFullYear()])

            let totalLeave = parseInt(rows.rows[0].count)

            if (dayDiff > 12) {
                return responHelper(res, 400, { message: 'Durasi pengajuan tidak boleh lebih dari 12 hari.' });
            }

            if (dayDiff > totalLeave && totalLeave > 0) {
                return responHelper(res, 400, { message: `Sisa Cuti Anda Tinggal ${totalLeave}.` });
            }


            const startYear = startDate.getFullYear();
            const startMonth = startDate.getMonth();
            const endYear = endDate.getFullYear();
            const endMonth = endDate.getMonth();

            if (startYear < currentYear || (startYear === currentYear && startMonth < currentMonth)) {
                return responHelper(res, 400, { message: 'Tanggal telah sudah berlalu.' });
            }

            if (endYear < currentYear || (endYear === currentYear && endMonth < currentMonth)) {
                return responHelper(res, 400, { message: 'Tanggal telah berlalu.' });
            }
            
            const query = `INSERT INTO permissions (employee_id, status, reason, start_date, end_date, permission_status) VALUES ($1, $2, $3, $4, $5, $6)`;
            await client.query(query, [employeeId, status, reason, start_date, end_date, "PENDING"]);
            
            responHelper(res, 200, { message: `Pengajuan ${status} berhasil.` });
        }catch (error) {
            console.log(error)
            responHelper(res, 500, { message: 'Internal server error.' });
        } 
    }
});

permissionRouter.post('/permission-approve', async (req, res) => {
    let token = req.header("token");
    let auth = authenticateUser(token);

    if (auth.status !== 200) {
        return responHelper(res, auth.status, { data: auth })
    } else {
        try {
            const { status, start_date, end_date, id, employeeId } = req.body

            const currentDate = new Date();
            const startDate = new Date(start_date);
            const endDate = new Date(end_date);

            if (endDate < currentDate) {
                return responHelper(res, 400, { message: 'Pengajuan sudah expired.' });
            }

            const query = "UPDATE permissions SET permission_status = $1 WHERE id = $2"
            if (status == 'rejected') {
                await client.query(query, ['REJECTED', id])
                return responHelper(res, 400, { message: 'Pengajuan telah ditolak.' });
            } else if (status == 'approved') {
                await client.query(query, ['APPROVED', id])
            }


            const checkin = { "latitude": "", "longitude": "", "status": "CHECKIN" }
            const checkout = { "latitude": "", "longitude": "", "status": "CHECKOUT" }

            const daysCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

            const queries = [];
            for (let i = 0; i < daysCount; i++) {
                const currentCheckInDate = new Date(startDate);
                currentCheckInDate.setDate(startDate.getDate() + i);
                currentCheckInDate.setHours(8, 0, 0, 0);

                const currentCheckOutDate = new Date(currentCheckInDate);
                currentCheckOutDate.setHours(17, 0, 0, 0);

                const query = `INSERT INTO transactions (employee_id, checkin, checkout, work_type, working_hours, created_at, check_in_time, check_out_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
                queries.push(client.query(query, [employeeId, checkin, checkout, status , '08:00', currentDate, currentCheckInDate, currentCheckOutDate]));
            }
            await Promise.all(queries);
            responHelper(res, 200, { message: 'Pengajuan berhasil diapprove.'});
        } catch (error) {
            console.log(error)
            responHelper(res, 500, { message: 'Internal server error.' });
        }
    }
});

permissionRouter.get('/permission-o', async (req, res) => {
    let token = req.header("token");
    let auth = authenticateUser(token);

    if (auth.status !== 200) {
        return responHelper(res, auth.status, { data: auth })
    } else {
        try {
            const { keyword = '', page = 1, limit = 10 } = req.query;

            const offset = (page - 1) * limit;

            let query = 'SELECT a.*, b.name FROM permissions a LEFT JOIN employees b ON a.employee_id = b.id WHERE a.reason ILIKE $1 LIMIT $2 OFFSET $3';
            let querycount = 'SELECT count(*) FROM permissions WHERE reason ILIKE $1';

            let queryParams = [`%${keyword}%`, limit, offset];

            const { rows } = await client.query(query, queryParams);
            const total_elements = await client.query(querycount, [`%${keyword}%`]);

            const paging = {
                total_elements: parseInt(total_elements.rows[0].count),
                total_Pages: Math.ceil(total_elements.rows[0].count / limit)
            }

            responHelper(res, 200, { data: rows, paging, message: 'Data berhasil ditemukan.' }  );
        } catch (error) {
            console.error(error);
            responHelper(res, 500, { message: 'Internal server error.' });
        }
    }
});

permissionRouter.get('/submission/:status?', async (req, res) => {
    let token = req.header("token");
    let auth = authenticateUser(token);
    const status = req.params.status;

    if (auth.status !== 200) {
        return responHelper(res, auth.status, { data: auth });
    }

    try {
        let query = 'SELECT * FROM permissions';
        let queryParams = [];

        if (status) {
            query += ' WHERE permission_status = $1';
            queryParams.push(status);
        }

        const { rows } = await client.query(query, queryParams);

        responHelper(res, 200, { data: rows, message: 'Data berhasil ditemukan.' });
    } catch (error) {
        console.error(error);
        responHelper(res, 500, { message: 'Internal server error.' });
    }
});



export default permissionRouter;


import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { client } from "../connection/database.js";
import { authenticateUser } from "../utils/auth.js";


const locationRouter = express.Router();

locationRouter.get("/location/find-all", async (req, res) => {
    try {
        let query = 'SELECT * FROM office_locations';
        const { rows } = await client.query(query);
        responHelper(res, 200, { data: rows, message: 'Data berhasil ditemukan.' });
    } catch (error) {
        console.error(error);
        responHelper(res, 500, { message: 'Internal server error.' });
    }
});

locationRouter.get("/location", async (req, res) => {

    let token = req.header("token");
    let auth = authenticateUser(token);

    if (auth.status !== 200) {
        return responHelper(res, auth.status, { data: auth })
    } else {
        try {
            const { keyword = '', page = 1, limit = 10 } = req.query;

            const offset = (page - 1) * limit;

            let query = 'SELECT * FROM office_locations WHERE name ILIKE $1 LIMIT $2 OFFSET $3';
            let querycount = 'SELECT count(*) FROM office_locations WHERE name ILIKE $1';

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


locationRouter.post("/location", async (req, res) => {
    try {
        const { offine_name, latitude, longitude } = req.body

        const query = `INSERT INTO office_locations (name, longitude, latitude) VALUES ($1, $2, $3)`;
        await client.query(query, [offine_name, longitude, latitude]);

        responHelper(res, 200, { message: 'Data berhasil ditambahkan.' });
    } catch (error) {
        responHelper(res, 500, { message: 'Internal server error.' });
    }
});


export default locationRouter;
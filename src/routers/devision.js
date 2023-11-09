import express from "express";
import { responHelper } from "../helper/responHelper.js";
import { client } from "../connection/database.js";


const divisionRouter = express.Router();

divisionRouter.get("/division", async (req, res) => {
 try {
  const query = `SELECT id, division_name FROM divisions`;
  const { rows } = await client.query(query);

  responHelper(res, 200, { data: rows, message: 'Data berhasil ditemukan.' });
 } catch (error) {
  responHelper(res, 500, { message: 'Internal server error.' });
 }
});

divisionRouter.get("/position/:divisionId?", async (req, res) => {
 try {
  const { divisionId } = req.params;
  let query = 'SELECT id, position_name FROM positions';

  if (divisionId) {
   query += ' WHERE division_id = $1';
  }

  const { rows } = await client.query(query, divisionId ? [divisionId] : []);

  responHelper(res, 200, { data: rows, message: 'Data berhasil ditemukan.' });
 } catch (error) {
  responHelper(res, 500, { message: 'Internal server error.' });
 }
});


export default divisionRouter;
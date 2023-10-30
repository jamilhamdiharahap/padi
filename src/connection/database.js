import pkg from "pg";
import 'dotenv/config.js'

const { Pool } = pkg

const client = new Pool({
 host: process.env.DB_HOST,
 port: process.env.DB_PORT,
 user: process.env.DB_USER,
 password: process.env.DB_PASSWORD,
 database: process.env.DB_NAME,
 max: 20,
 idleTimeoutMillis: 30000,
 connectionTimeoutMillis: 2000,
});

client.connect()
 .then(() => {
  console.log('connected...');
 })
 .catch((error) => {
  console.error('Error connecting to the database:', error);
 });

export { client };

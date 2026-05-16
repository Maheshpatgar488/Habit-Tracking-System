const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });
        console.log("Attempting query...");
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND role = ?', ['admin', 'admin']);
        console.log("Query success. Rows:", rows);
        process.exit(0);
    } catch (err) {
        console.error("DB Error:", err.message);
        process.exit(1);
    }
}
check();

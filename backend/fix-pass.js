const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function fixPassword() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });
        
        const newHash = await bcrypt.hash('admin123', 10);
        await pool.query('UPDATE users SET password = ? WHERE username = "admin"', [newHash]);
        console.log("Admin password successfully reset to 'admin123'!");
        process.exit(0);
    } catch (err) {
        console.error("DB Error:", err.message);
        process.exit(1);
    }
}
fixPassword();

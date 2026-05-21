const pool = require('./config/db');
require('dotenv').config();

async function createTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cron_execution_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                endpoint VARCHAR(255) NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message TEXT
            )
        `);
        console.log('✅ Created cron_execution_logs table successfully.');
    } catch (err) {
        console.error('Error creating table:', err.message);
    } finally {
        process.exit(0);
    }
}

createTable();

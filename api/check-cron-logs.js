const pool = require('./config/db');
require('dotenv').config();

async function checkLogs() {
    try {
        console.log("=== CHECKING CRON LOGS ===");
        const [logs] = await pool.query(`
            SELECT id, endpoint, DATE_FORMAT(executed_at, "%Y-%m-%d %H:%i:%s") as executed_at, message 
            FROM cron_execution_logs 
            ORDER BY id DESC 
            LIMIT 20
        `);
        console.log(logs);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkLogs();

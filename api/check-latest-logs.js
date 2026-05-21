const pool = require('./config/db');

async function check() {
    try {
        console.log("=== CHECKING LATEST LOGS ===");
        const today = new Date().toISOString().split('T')[0];
        const [logs] = await pool.query(
            'SELECT id, task_name, DATE_FORMAT(scheduled_time, "%Y-%m-%d %H:%i:%s") as scheduled_time, notif_5min_sent, notif_start_sent, status FROM daily_task_logs WHERE date = ? ORDER BY scheduled_time ASC',
            [today]
        );
        console.log(logs);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();

const cron = require('node-cron');
const pool = require('../config/db');

// Run every minute
cron.schedule('* * * * *', async () => {
    console.log('[CRON] Running Status Auto-Updater...');
    try {
        const now = new Date();
        // MySQL expects 'YYYY-MM-DD HH:MM:SS'
        const localNowStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');

        // Find all pending tasks where (scheduled_time + duration_minutes) has passed
        // Meaning the task window is over, but it's still marked 'pending'
        const query = `
            UPDATE daily_task_logs 
            SET status = 'missed' 
            WHERE status = 'pending' 
            AND DATE_ADD(scheduled_time, INTERVAL duration_minutes MINUTE) < ?
        `;

        const [result] = await pool.query(query, [localNowStr]);
        if (result.affectedRows > 0) {
            console.log(`[CRON] Updated ${result.affectedRows} tasks to 'missed'.`);
        }
    } catch (error) {
        console.error('[CRON] Error in Status Auto-Updater:', error);
    }
});

const cron = require('node-cron');
const pool = require('../config/db');

// Run every minute
cron.schedule('* * * * *', async () => {
    console.log('[CRON] Running Status Auto-Updater...');
    try {
        // Find all pending tasks where (scheduled_time + duration_minutes) has passed
        // Meaning the task window is over, but it's still marked 'pending' (timezone-corrected)
        const query = `
            UPDATE daily_task_logs d
            SET d.status = 'missed' 
            WHERE d.status = 'pending' 
            AND DATE_ADD(
                DATE_ADD(d.scheduled_time, INTERVAL d.duration_minutes MINUTE), 
                INTERVAL COALESCE(
                    (SELECT MIN(timezone_offset) FROM push_subscriptions WHERE user_id = d.user_id), 
                    -330
                ) MINUTE
            ) < NOW()
        `;

        const [result] = await pool.query(query);
        if (result.affectedRows > 0) {
            console.log(`[CRON] Updated ${result.affectedRows} tasks to 'missed'.`);
        }
    } catch (error) {
        console.error('[CRON] Error in Status Auto-Updater:', error);
    }
});

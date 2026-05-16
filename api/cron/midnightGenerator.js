const cron = require('node-cron');
const pool = require('../config/db');

// Run every day at 00:00 (Midnight)
cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running Midnight Generator...');
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Check if logs already exist for today to avoid duplicates
        const [existingLogs] = await pool.query('SELECT id FROM daily_task_logs WHERE date = ? LIMIT 1', [today]);
        if (existingLogs.length > 0) {
            console.log('[CRON] Logs for today already generated.');
            return;
        }

        // Get all routine templates
        const [templates] = await pool.query('SELECT * FROM routine_templates');
        
        if (templates.length === 0) {
            console.log('[CRON] No routine templates found.');
            return;
        }

        const values = templates.map(template => {
            // Combine today's date with the start_time from template
            // start_time is usually returned as a string like '10:00:00'
            const scheduledTime = `${today} ${template.start_time}`;
            return [template.user_id, template.task_name, scheduledTime, template.duration_minutes, 'pending', today];
        });

        if (values.length > 0) {
            await pool.query(
                'INSERT INTO daily_task_logs (user_id, task_name, scheduled_time, duration_minutes, status, date) VALUES ?',
                [values]
            );
            console.log(`[CRON] Generated ${values.length} daily task logs for ${today}.`);
        }
    } catch (error) {
        console.error('[CRON] Error in Midnight Generator:', error);
    }
});

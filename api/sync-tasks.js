const pool = require('./config/db');

async function forceGenerateTasks() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        console.log(`Checking routines for ${today}...`);
        
        const [templates] = await pool.query('SELECT * FROM routine_templates');
        
        if (templates.length === 0) {
            console.log('No routine templates found. Have you created a routine yet?');
            process.exit(0);
        }

        let addedCount = 0;

        for (const template of templates) {
            const scheduledTime = `${today} ${template.start_time}`;
            
            // Check if this specific task already exists for today
            const [existingLogs] = await pool.query(
                'SELECT id FROM daily_task_logs WHERE user_id = ? AND task_name = ? AND date = ?', 
                [template.user_id, template.task_name, today]
            );

            if (existingLogs.length === 0) {
                await pool.query(
                    'INSERT INTO daily_task_logs (user_id, task_name, scheduled_time, duration_minutes, status, date) VALUES (?, ?, ?, ?, ?, ?)',
                    [template.user_id, template.task_name, scheduledTime, template.duration_minutes, 'pending', today]
                );
                addedCount++;
            }
        }

        console.log(`Successfully synced ${addedCount} new tasks for today!`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

forceGenerateTasks();

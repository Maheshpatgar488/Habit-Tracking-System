const pool = require('./config/db');

async function diag() {
    try {
        console.log('=== Database Diagnostic ===');
        const [users] = await pool.query('SELECT id, name, username, role FROM users');
        console.log('Users in database:', users);

        const [templates] = await pool.query('SELECT * FROM routine_templates');
        console.log('Routine Templates:', templates);

        const [logs] = await pool.query('SELECT * FROM daily_task_logs ORDER BY date DESC LIMIT 20');
        console.log('Recent 20 Daily Task Logs:', logs.map(l => ({
            id: l.id,
            user_id: l.user_id,
            task_name: l.task_name,
            scheduled_time: l.scheduled_time,
            duration: l.duration_minutes,
            status: l.status,
            date: l.date
        })));

        console.log('Current Date/Time Checks:');
        console.log('Server Time (UTC ISO):', new Date().toISOString());
        console.log('Server Date split:', new Date().toISOString().split('T')[0]);

        const [dbTime] = await pool.query('SELECT NOW() as db_now, CURDATE() as db_curdate, UTC_TIMESTAMP() as db_utc');
        console.log('Database time fields:', dbTime);

        process.exit(0);
    } catch (err) {
        console.error('Diagnostic error:', err);
        process.exit(1);
    }
}

diag();

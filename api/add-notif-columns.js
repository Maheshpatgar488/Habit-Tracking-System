// One-time migration: add notification sent tracking columns
const pool = require('./config/db');
require('dotenv').config();

async function migrate() {
    try {
        await pool.query(`
            ALTER TABLE daily_task_logs 
            ADD COLUMN IF NOT EXISTS notif_5min_sent TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS notif_start_sent TINYINT(1) DEFAULT 0
        `);
        console.log('✅ Migration complete: notif_5min_sent and notif_start_sent columns added.');
    } catch (err) {
        console.error('Migration error:', err.message);
    } finally {
        process.exit(0);
    }
}

migrate();

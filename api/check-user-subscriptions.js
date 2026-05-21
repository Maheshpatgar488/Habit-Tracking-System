const pool = require('./config/db');
require('dotenv').config();

async function checkSubs() {
    try {
        console.log("=== CHECKING PUSH SUBSCRIPTIONS ===");
        const [subs] = await pool.query(`
            SELECT id, user_id, endpoint, DATE_FORMAT(created_at, "%Y-%m-%d %H:%i:%s") as created_at 
            FROM push_subscriptions
        `);
        console.log(subs);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkSubs();

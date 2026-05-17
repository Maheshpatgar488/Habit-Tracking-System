const pool = require('./config/db');

async function clean() {
    try {
        console.log("Starting push subscriptions cleanup...");

        // 1. Let's find duplicates and keep only the latest one for each unique endpoint
        const deleteQuery = `
            DELETE p1 FROM push_subscriptions p1
            INNER JOIN push_subscriptions p2 
            WHERE p1.id < p2.id 
            AND p1.user_id = p2.user_id 
            AND p1.endpoint = p2.endpoint
        `;
        
        const [result] = await pool.query(deleteQuery);
        console.log(`Successfully cleaned up ${result.affectedRows} duplicate subscriptions!`);

        // 2. Fetch the remaining active subscriptions to verify
        const [remaining] = await pool.query('SELECT id, user_id, SUBSTRING(endpoint, 1, 60) as endpoint, created_at FROM push_subscriptions');
        console.log("Remaining unique subscriptions:", remaining);

        process.exit(0);
    } catch (err) {
        console.error("Cleanup error:", err);
        process.exit(1);
    }
}

clean();

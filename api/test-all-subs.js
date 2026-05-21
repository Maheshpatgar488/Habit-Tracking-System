const pool = require('./config/db');
const webpush = require('web-push');
require('dotenv').config();

webpush.setVapidDetails(
    'mailto:test@test.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

async function testAll() {
    try {
        console.log('=== TESTING ALL PUSH SUBSCRIPTIONS IN DATABASE ===');
        const [subs] = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = 30001');
        
        if (subs.length === 0) {
            console.log('No subscriptions found for user 30001');
            process.exit(0);
        }

        console.log(`Found ${subs.length} registered subscriptions. Sending test push to each...`);

        for (const sub of subs) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            };

            const payload = JSON.stringify({
                title: 'Diagnostics Test 🛠️',
                body: `Testing subscription ID: ${sub.id}`,
                icon: '/icon.png'
            });

            const options = {
                headers: { 'Urgency': 'high' },
                TTL: 60
            };

            try {
                await webpush.sendNotification(pushSubscription, payload, options);
                console.log(`✅ SUCCESS for Subscription ID: ${sub.id} (Created at: ${sub.created_at})`);
            } catch (err) {
                console.error(`❌ FAILED for Subscription ID: ${sub.id} (Created at: ${sub.created_at})`);
                console.error(`   Error Status Code: ${err.statusCode}`);
                console.error(`   Error Message: ${err.message || 'No message'}`);
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`   💡 Tip: This subscription is expired or unsubscribed. We should delete it from DB.`);
                }
            }
        }
    } catch (err) {
        console.error('Diagnostic error:', err);
    } finally {
        process.exit(0);
    }
}

testAll();

const cron = require('node-cron');
const webpush = require('web-push');
const pool = require('../config/db');
require('dotenv').config();

webpush.setVapidDetails(
    'mailto:test@test.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Run every minute
cron.schedule('* * * * *', async () => {
    console.log('[CRON] Running Notification Trigger...');
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.log('[CRON] VAPID keys not configured, skipping notifications.');
        return;
    }

    try {
        // Get tasks that are exactly 5 minutes away (using timezone-independent DB calculations)
        const query = `
            SELECT d.id, d.user_id, d.task_name, d.scheduled_time, p.endpoint, p.p256dh, p.auth 
            FROM daily_task_logs d
            JOIN push_subscriptions p ON d.user_id = p.user_id
            WHERE d.status = 'pending' 
            AND DATE_FORMAT(DATE_ADD(d.scheduled_time, INTERVAL p.timezone_offset MINUTE), '%Y-%m-%d %H:%i') = DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 5 MINUTE), '%Y-%m-%d %H:%i')
        `;

        const [tasks] = await pool.query(query);

        if (tasks.length > 0) {
            console.log(`[CRON] Found ${tasks.length} tasks starting in 5 minutes. Sending notifications...`);
            
            for (const task of tasks) {
                const pushSubscription = {
                    endpoint: task.endpoint,
                    keys: {
                        p256dh: task.p256dh,
                        auth: task.auth
                    }
                };

                const payload = JSON.stringify({
                    title: 'Upcoming Task Reminder',
                    body: `Reminder: '${task.task_name}' starts in 5 minutes!`,
                    icon: '/icon.png'
                });

                try {
                    await webpush.sendNotification(pushSubscription, payload);
                    console.log(`[CRON] Notification sent to user ${task.user_id} for task ${task.task_name}`);
                } catch (err) {
                    console.error(`[CRON] Failed to send notification to user ${task.user_id}:`, err);
                }
            }
        }
    } catch (error) {
        console.error('[CRON] Error in Notification Trigger:', error);
    }
});

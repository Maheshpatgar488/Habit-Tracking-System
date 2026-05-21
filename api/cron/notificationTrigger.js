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
        // scheduled_time is stored in IST (local), TiDB/MySQL NOW() is UTC.
        // Subtract 330 min (IST = UTC+5:30) to convert stored IST time -> UTC, then compare with NOW() UTC.
        // notif_5min_sent / notif_start_sent flags prevent duplicate sends when laptop wakes from sleep
        // and multiple cron cycles catch the same task window simultaneously.

        // 5-min reminder: task starts in 1-5 minutes (60-300 seconds) AND hasn't been notified yet
        const query5Min = `
            SELECT d.id, d.user_id, d.task_name, d.scheduled_time, p.endpoint, p.p256dh, p.auth 
            FROM daily_task_logs d
            JOIN push_subscriptions p ON d.user_id = p.user_id
            WHERE d.status = 'pending'
            AND d.notif_5min_sent = 0
            AND TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), DATE_ADD(d.scheduled_time, INTERVAL COALESCE(p.timezone_offset, -330) MINUTE)) BETWEEN 60 AND 300
        `;

        // Start notification: task started within last 15 minutes (0-900 seconds ago) AND hasn't been notified yet
        const queryStart = `
            SELECT d.id, d.user_id, d.task_name, d.scheduled_time, p.endpoint, p.p256dh, p.auth 
            FROM daily_task_logs d
            JOIN push_subscriptions p ON d.user_id = p.user_id
            WHERE d.status = 'pending'
            AND d.notif_start_sent = 0
            AND TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), DATE_ADD(d.scheduled_time, INTERVAL COALESCE(p.timezone_offset, -330) MINUTE)) BETWEEN -900 AND 0
        `;

        const [tasks5Min] = await pool.query(query5Min);
        const [tasksStart] = await pool.query(queryStart);

        if (tasks5Min.length > 0) {
            console.log(`[CRON] Found ${tasks5Min.length} tasks starting in 5 minutes. Sending reminders...`);
            
            // Collect unique task IDs to mark as sent (avoid marking before successful send)
            const sentTaskIds = [];

            for (const task of tasks5Min) {
                const pushSubscription = {
                    endpoint: task.endpoint,
                    keys: { p256dh: task.p256dh, auth: task.auth }
                };

                const payload = JSON.stringify({
                    title: 'Upcoming Task Reminder ⏰',
                    body: `'${task.task_name}' starts in 5 minutes!`,
                    icon: '/icon.png'
                });

                const options = {
                    headers: { 'Urgency': 'high' },
                    TTL: 300 // 5 minutes
                };

                try {
                    await webpush.sendNotification(pushSubscription, payload, options);
                    sentTaskIds.push(task.id);
                    console.log(`[CRON] 5-min reminder sent to user ${task.user_id} for task ${task.task_name}`);
                } catch (err) {
                    console.error(`[CRON] Failed to send 5-min reminder to user ${task.user_id}:`, err.statusCode || err.message);
                }
            }

            // Mark all successfully-notified tasks so cron never sends again
            if (sentTaskIds.length > 0) {
                const uniqueIds = [...new Set(sentTaskIds)];
                await pool.query(
                    `UPDATE daily_task_logs SET notif_5min_sent = 1 WHERE id IN (${uniqueIds.map(() => '?').join(',')})`,
                    uniqueIds
                );
            }
        }

        if (tasksStart.length > 0) {
            console.log(`[CRON] Found ${tasksStart.length} tasks starting now. Sending start notifications...`);
            
            const sentTaskIds = [];

            for (const task of tasksStart) {
                const pushSubscription = {
                    endpoint: task.endpoint,
                    keys: { p256dh: task.p256dh, auth: task.auth }
                };

                const payload = JSON.stringify({
                    title: 'Task Started 🚀',
                    body: `Your task '${task.task_name}' has started - complete it on time!`,
                    icon: '/icon.png'
                });

                const options = {
                    headers: { 'Urgency': 'high' },
                    TTL: 900 // 15 minutes
                };

                try {
                    await webpush.sendNotification(pushSubscription, payload, options);
                    sentTaskIds.push(task.id);
                    console.log(`[CRON] Start notification sent to user ${task.user_id} for task ${task.task_name}`);
                } catch (err) {
                    console.error(`[CRON] Failed to send start notification to user ${task.user_id}:`, err.statusCode || err.message);
                }
            }

            if (sentTaskIds.length > 0) {
                const uniqueIds = [...new Set(sentTaskIds)];
                await pool.query(
                    `UPDATE daily_task_logs SET notif_start_sent = 1 WHERE id IN (${uniqueIds.map(() => '?').join(',')})`,
                    uniqueIds
                );
            }
        }
    } catch (error) {
        console.error('[CRON] Error in Notification Trigger:', error);
    }
});

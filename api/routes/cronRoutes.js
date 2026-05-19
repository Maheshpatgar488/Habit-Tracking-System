const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:test@test.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// Security middleware to ensure only Vercel Cron can trigger these endpoints
const verifyCron = (req, res, next) => {
    // Note: Vercel sends a specific authorization header for cron jobs
    // In production, we'd verify process.env.CRON_SECRET
    if (process.env.NODE_ENV === 'production') {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ message: 'Unauthorized cron request' });
        }
    }
    next();
};

router.use(verifyCron);

// 1. Midnight Generator
router.get('/midnight', async (req, res) => {
    console.log('[VERCEL CRON] Running Midnight Generator...');
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const [existingLogs] = await pool.query('SELECT id FROM daily_task_logs WHERE date = ? LIMIT 1', [today]);
        if (existingLogs.length > 0) {
            console.log('[VERCEL CRON] Logs for today already generated.');
            return res.status(200).json({ message: 'Already generated' });
        }

        const [templates] = await pool.query('SELECT * FROM routine_templates');
        if (templates.length === 0) {
            return res.status(200).json({ message: 'No templates' });
        }

        const values = templates.map(template => {
            const scheduledTime = `${today} ${template.start_time}`;
            return [template.user_id, template.task_name, scheduledTime, template.duration_minutes, 'pending', today];
        });

        if (values.length > 0) {
            await pool.query(
                'INSERT INTO daily_task_logs (user_id, task_name, scheduled_time, duration_minutes, status, date) VALUES ?',
                [values]
            );
        }
        res.status(200).json({ message: `Generated ${values.length} logs` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Status Updater
router.get('/status', async (req, res) => {
    console.log('[VERCEL CRON] Running Status Auto-Updater & Notification Sender...');
    try {
        // 1. Find all pending tasks that have expired (scheduled_time + duration < now in UTC)
        // and fetch their users' push subscriptions
        const selectQuery = `
            SELECT d.id, d.user_id, d.task_name, d.scheduled_time, p.endpoint, p.p256dh, p.auth 
            FROM daily_task_logs d
            JOIN push_subscriptions p ON d.user_id = p.user_id
            WHERE d.status = 'pending' 
            AND DATE_ADD(DATE_ADD(d.scheduled_time, INTERVAL d.duration_minutes MINUTE), INTERVAL COALESCE(p.timezone_offset, -330) MINUTE) < NOW()
        `;
        const [expiredTasks] = await pool.query(selectQuery);

        let notificationsSent = 0;

        // 2. Send 'Missed Task' push notification
        if (expiredTasks.length > 0 && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            for (const task of expiredTasks) {
                const pushSubscription = {
                    endpoint: task.endpoint,
                    keys: { p256dh: task.p256dh, auth: task.auth }
                };

                const payload = JSON.stringify({
                    title: 'Task Missed ❌',
                    body: `Oh no! You missed your scheduled task: '${task.task_name}'. Keep going, you've got this!`,
                    icon: '/icon.png'
                });

                try {
                    await webpush.sendNotification(pushSubscription, payload);
                    notificationsSent++;
                } catch (err) {
                    console.error('[STATUS CRON] Failed to send missed notification:', err.message);
                }
            }
        }

        // 3. Finally, update the tasks status to 'missed' in the database (with fallback to default -330 if user has no subscriptions)
        const updateQuery = `
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
        const [result] = await pool.query(updateQuery);

        res.status(200).json({ 
            message: `Updated ${result.affectedRows} tasks to missed. Sent ${notificationsSent} notifications.` 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Notification Trigger
router.get('/notify', async (req, res) => {
    console.log('[VERCEL CRON] Running Notification Trigger...');
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return res.status(200).json({ message: 'VAPID keys not configured' });
    }
    try {
        // scheduled_time is stored in IST (local), TiDB NOW() is UTC.
        // Subtract 330 min to convert IST -> UTC, then compare with NOW() UTC.
        // notif_*_sent flags ensure each notification fires only once.

        // 5-min reminder: task starts in 4-6 minutes AND not yet sent
        const query5Min = `
            SELECT d.id, d.user_id, d.task_name, d.scheduled_time, p.endpoint, p.p256dh, p.auth 
            FROM daily_task_logs d
            JOIN push_subscriptions p ON d.user_id = p.user_id
            WHERE d.status = 'pending'
            AND d.notif_5min_sent = 0
            AND TIMESTAMPDIFF(MINUTE, NOW(), DATE_ADD(d.scheduled_time, INTERVAL -330 MINUTE)) BETWEEN 4 AND 6
        `;

        // Start notification: task started within last 2 minutes AND not yet sent
        const queryStart = `
            SELECT d.id, d.user_id, d.task_name, d.scheduled_time, p.endpoint, p.p256dh, p.auth 
            FROM daily_task_logs d
            JOIN push_subscriptions p ON d.user_id = p.user_id
            WHERE d.status = 'pending'
            AND d.notif_start_sent = 0
            AND TIMESTAMPDIFF(MINUTE, NOW(), DATE_ADD(d.scheduled_time, INTERVAL -330 MINUTE)) BETWEEN -2 AND 1
        `;

        const [tasks5Min] = await pool.query(query5Min);
        const [tasksStart] = await pool.query(queryStart);

        let sentCount = 0;
        
        if (tasks5Min.length > 0) {
            const sentIds = [];
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

                try {
                    await webpush.sendNotification(pushSubscription, payload);
                    sentIds.push(task.id);
                    sentCount++;
                } catch (err) {
                    console.error('Failed to send 5-min notification', err.statusCode || err.message);
                }
            }
            if (sentIds.length > 0) {
                const uniqueIds = [...new Set(sentIds)];
                await pool.query(
                    `UPDATE daily_task_logs SET notif_5min_sent = 1 WHERE id IN (${uniqueIds.map(() => '?').join(',')})`,
                    uniqueIds
                );
            }
        }

        if (tasksStart.length > 0) {
            const sentIds = [];
            for (const task of tasksStart) {
                const pushSubscription = {
                    endpoint: task.endpoint,
                    keys: { p256dh: task.p256dh, auth: task.auth }
                };

                const payload = JSON.stringify({
                    title: 'Task Started 🚀',
                    body: `Your task '${task.task_name}' has started — complete it on time!`,
                    icon: '/icon.png'
                });

                try {
                    await webpush.sendNotification(pushSubscription, payload);
                    sentIds.push(task.id);
                    sentCount++;
                } catch (err) {
                    console.error('Failed to send start notification', err.statusCode || err.message);
                }
            }
            if (sentIds.length > 0) {
                const uniqueIds = [...new Set(sentIds)];
                await pool.query(
                    `UPDATE daily_task_logs SET notif_start_sent = 1 WHERE id IN (${uniqueIds.map(() => '?').join(',')})`,
                    uniqueIds
                );
            }
        }

        res.status(200).json({ 
            message: `Sent ${sentCount} notifications (5-min: ${tasks5Min.length}, start: ${tasksStart.length})` 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

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
    console.log('[VERCEL CRON] Running Status Auto-Updater...');
    try {
        const now = new Date();
        const localNowStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');

        const query = `
            UPDATE daily_task_logs 
            SET status = 'missed' 
            WHERE status = 'pending' 
            AND DATE_ADD(scheduled_time, INTERVAL duration_minutes MINUTE) < ?
        `;
        const [result] = await pool.query(query, [localNowStr]);
        res.status(200).json({ message: `Updated ${result.affectedRows} tasks` });
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
        const now = new Date();
        const futureTime = new Date(now.getTime() + 5 * 60000);
        const localFutureStr = new Date(futureTime.getTime() - futureTime.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 16); 
            
        const query = `
            SELECT d.id, d.user_id, d.task_name, d.scheduled_time, p.endpoint, p.p256dh, p.auth 
            FROM daily_task_logs d
            JOIN push_subscriptions p ON d.user_id = p.user_id
            WHERE d.status = 'pending' 
            AND DATE_FORMAT(d.scheduled_time, '%Y-%m-%d %H:%i') = ?
        `;

        const searchTimeStr = localFutureStr.replace('T', ' ');
        const [tasks] = await pool.query(query, [searchTimeStr]);

        let sentCount = 0;
        if (tasks.length > 0) {
            for (const task of tasks) {
                const pushSubscription = {
                    endpoint: task.endpoint,
                    keys: { p256dh: task.p256dh, auth: task.auth }
                };

                const payload = JSON.stringify({
                    title: 'Upcoming Task Reminder',
                    body: `Reminder: '${task.task_name}' starts in 5 minutes!`,
                    icon: '/icon.png'
                });

                try {
                    await webpush.sendNotification(pushSubscription, payload);
                    sentCount++;
                } catch (err) {
                    console.error('Failed to send notification', err);
                }
            }
        }
        res.status(200).json({ message: `Sent ${sentCount} notifications out of ${tasks.length} due` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

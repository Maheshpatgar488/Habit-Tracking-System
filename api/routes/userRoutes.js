const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware(['user']));

// Get today's timeline (daily task logs)
router.get('/timeline', async (req, res) => {
    try {
        const today = req.query.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // 1. Fetch existing logs for the user on this date
        let [logs] = await pool.query(
            'SELECT id, user_id, task_name, DATE_FORMAT(scheduled_time, "%Y-%m-%dT%H:%i:%s") as scheduled_time, duration_minutes, status, date FROM daily_task_logs WHERE user_id = ? AND date = ? ORDER BY scheduled_time ASC',
            [req.user.id, today]
        );

        // 2. Self-healing / On-demand generation: If no logs exist yet, generate them from routine templates
        if (logs.length === 0) {
            const [templates] = await pool.query('SELECT * FROM routine_templates WHERE user_id = ?', [req.user.id]);
            
            if (templates.length > 0) {
                const values = templates.map(template => {
                    const scheduledTime = `${today} ${template.start_time}`;
                    return [template.user_id, template.task_name, scheduledTime, template.duration_minutes, 'pending', today];
                });

                await pool.query(
                    'INSERT INTO daily_task_logs (user_id, task_name, scheduled_time, duration_minutes, status, date) VALUES ?',
                    [values]
                );

                // Re-fetch the newly generated logs
                [logs] = await pool.query(
                    'SELECT id, user_id, task_name, DATE_FORMAT(scheduled_time, "%Y-%m-%dT%H:%i:%s") as scheduled_time, duration_minutes, status, date FROM daily_task_logs WHERE user_id = ? AND date = ? ORDER BY scheduled_time ASC',
                    [req.user.id, today]
                );
            }
        }

        res.json(logs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mark task as completed
router.put('/tasks/:id/complete', async (req, res) => {
    try {
        const taskId = req.params.id;
        
        // Ensure the task belongs to the user (fetch with timezone-agnostic string format)
        const [task] = await pool.query(
            "SELECT *, DATE_FORMAT(scheduled_time, '%Y-%m-%d %H:%i:%s') as scheduled_time_str FROM daily_task_logs WHERE id = ? AND user_id = ?",
            [taskId, req.user.id]
        );
        
        if (task.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (task[0].status !== 'pending') {
            return res.status(400).json({ message: `Task is already ${task[0].status}` });
        }

        // Get the user's registered timezone offset from push_subscriptions
        const [[sub]] = await pool.query(
            "SELECT MIN(timezone_offset) as tz FROM push_subscriptions WHERE user_id = ?",
            [req.user.id]
        );
        const tzOffset = sub && sub.tz !== null ? parseInt(sub.tz) : -330;

        // Current user time (timezone adjusted representation)
        const now = new Date();
        const userLocalNow = new Date(now.getTime() - tzOffset * 60000);

        const startTime = new Date(task[0].scheduled_time_str + 'Z');
        const endTime = new Date(startTime.getTime() + task[0].duration_minutes * 60000);

        if (userLocalNow < startTime) {
            return res.status(400).json({ message: 'Task has not started yet. You cannot mark it as completed early!' });
        }

        if (userLocalNow > endTime) {
            // Auto-update to missed since the duration window has expired
            await pool.query('UPDATE daily_task_logs SET status = "missed" WHERE id = ?', [taskId]);
            return res.status(400).json({ message: 'Task window has closed. The task has been marked as missed!' });
        }

        await pool.query('UPDATE daily_task_logs SET status = "completed" WHERE id = ?', [taskId]);
        res.json({ message: 'Task marked as completed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Revert task from completed back to pending
router.put('/tasks/:id/revert', async (req, res) => {
    try {
        const taskId = req.params.id;
        
        // Ensure the task belongs to the user
        const [task] = await pool.query(
            "SELECT *, DATE_FORMAT(scheduled_time, '%Y-%m-%d %H:%i:%s') as scheduled_time_str FROM daily_task_logs WHERE id = ? AND user_id = ?",
            [taskId, req.user.id]
        );
        
        if (task.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (task[0].status !== 'completed') {
            return res.status(400).json({ message: 'Only completed tasks can be reverted back to pending' });
        }

        // Get the user's registered timezone offset from push_subscriptions
        const [[sub]] = await pool.query(
            "SELECT MIN(timezone_offset) as tz FROM push_subscriptions WHERE user_id = ?",
            [req.user.id]
        );
        const tzOffset = sub && sub.tz !== null ? parseInt(sub.tz) : -330;

        // Current user time (timezone adjusted representation)
        const now = new Date();
        const userLocalNow = new Date(now.getTime() - tzOffset * 60000);

        const startTime = new Date(task[0].scheduled_time_str + 'Z');
        const endTime = new Date(startTime.getTime() + task[0].duration_minutes * 60000);

        // A task can only be reverted while its duration window is still active!
        if (userLocalNow > endTime) {
            await pool.query('UPDATE daily_task_logs SET status = "missed" WHERE id = ?', [taskId]);
            return res.status(400).json({ message: 'The task window has closed. The task is now marked as missed and cannot be reverted!' });
        }

        // Reset status to pending and reset notification flags to allow retry
        await pool.query(
            'UPDATE daily_task_logs SET status = "pending", notif_5min_sent = 0, notif_start_sent = 0 WHERE id = ?',
            [taskId]
        );
        res.json({ message: 'Task reverted to pending' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
    try {
        const { endpoint, keys, timezoneOffset } = req.body;
        
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ message: 'Invalid subscription object' });
        }

        // Get timezoneOffset, default to -330 (IST) if not provided
        const tzOffset = timezoneOffset !== undefined ? parseInt(timezoneOffset) : -330;

        // Upsert the current endpoint (insert if new, update timezone if already exists)
        const [existing] = await pool.query(
            'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
            [req.user.id, endpoint]
        );

        if (existing.length === 0) {
            await pool.query(
                'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, timezone_offset) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, endpoint, keys.p256dh, keys.auth, tzOffset]
            );
            res.status(201).json({ message: 'Subscribed to push notifications' });
        } else {
            await pool.query(
                'UPDATE push_subscriptions SET p256dh = ?, auth = ?, timezone_offset = ? WHERE user_id = ? AND endpoint = ?',
                [keys.p256dh, keys.auth, tzOffset, req.user.id, endpoint]
            );
            res.status(200).json({ message: 'Subscription updated' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

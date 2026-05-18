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
        
        // Ensure the task belongs to the user
        const [task] = await pool.query('SELECT * FROM daily_task_logs WHERE id = ? AND user_id = ?', [taskId, req.user.id]);
        
        if (task.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (task[0].status !== 'pending') {
            return res.status(400).json({ message: `Task is already ${task[0].status}` });
        }

        await pool.query('UPDATE daily_task_logs SET status = "completed" WHERE id = ?', [taskId]);
        res.json({ message: 'Task marked as completed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
    try {
        const subscription = req.body;
        const { endpoint, keys } = subscription;
        
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ message: 'Invalid subscription object' });
        }

        // Check if this endpoint is already subscribed for this user
        const [existing] = await pool.query(
            'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
            [req.user.id, endpoint]
        );

        if (existing.length === 0) {
            await pool.query(
                'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
                [req.user.id, endpoint, keys.p256dh, keys.auth]
            );
            res.status(201).json({ message: 'Subscribed to push notifications' });
        } else {
            res.status(200).json({ message: 'Already subscribed to this endpoint' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

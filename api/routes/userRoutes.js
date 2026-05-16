const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware(['user']));

// Get today's timeline (daily task logs)
router.get('/timeline', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const [logs] = await pool.query(
            'SELECT * FROM daily_task_logs WHERE user_id = ? AND date = ? ORDER BY scheduled_time ASC',
            [req.user.id, today]
        );
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

        await pool.query(
            'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
            [req.user.id, endpoint, keys.p256dh, keys.auth]
        );

        res.status(201).json({ message: 'Subscribed to push notifications' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

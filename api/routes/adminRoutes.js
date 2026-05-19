const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware(['admin']));

// Get all users
router.get('/users', async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, name, username, role, created_at FROM users WHERE role = "user"');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new user
router.post('/users', async (req, res) => {
    try {
        const { name, username, password } = req.body;

        if (!name || !username || !password) {
            return res.status(400).json({ message: 'Please provide all fields' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, "user")',
            [name, username, hashedPassword]
        );

        res.status(201).json({ message: 'User created successfully', userId: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Username already exists' });
        }
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a routine for a user
router.post('/routines', async (req, res) => {
    try {
        const { user_id, task_name, start_time, duration_minutes } = req.body;

        if (!user_id || !task_name || !start_time || !duration_minutes) {
            return res.status(400).json({ message: 'Please provide all fields' });
        }

        await pool.query(
            'INSERT INTO routine_templates (user_id, task_name, start_time, duration_minutes) VALUES (?, ?, ?, ?)',
            [user_id, task_name, start_time, duration_minutes]
        );

        // Instantly generate the task for TODAY so it shows up immediately
        const today = new Date().toISOString().split('T')[0];
        const scheduledTime = `${today} ${start_time}`;
        
        // Check if a task with the exact same name and time was already generated for today to prevent duplicates
        const [existing] = await pool.query(
            'SELECT id FROM daily_task_logs WHERE user_id = ? AND task_name = ? AND scheduled_time = ?',
            [user_id, task_name, scheduledTime]
        );
        
        if (existing.length === 0) {
            await pool.query(
                'INSERT INTO daily_task_logs (user_id, task_name, scheduled_time, duration_minutes, status, date) VALUES (?, ?, ?, ?, ?, ?)',
                [user_id, task_name, scheduledTime, duration_minutes, 'pending', today]
            );
            return res.status(201).json({ message: 'Routine added and synced for today successfully' });
        } else {
            return res.status(201).json({ message: 'Routine template saved (Task already exists for today)' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get routines for a specific user
router.get('/routines/:userId', async (req, res) => {
    try {
        const [routines] = await pool.query('SELECT * FROM routine_templates WHERE user_id = ? ORDER BY start_time ASC', [req.params.userId]);
        res.json(routines);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a routine template
router.delete('/routines/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM routine_templates WHERE id = ?', [req.params.id]);
        res.json({ message: 'Routine deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get daily task logs with date filtering (today, yesterday, last7, last30, custom, all)
router.get('/tasks', async (req, res) => {
    try {
        const filter = req.query.filter || 'today';
        const clientDate = req.query.date; // YYYY-MM-DD (used as "today" anchor or custom date)

        const today = clientDate || new Date().toISOString().split('T')[0];
        const baseDate = new Date(today + 'T00:00:00');

        const getOffset = (days) => {
            const d = new Date(baseDate);
            d.setDate(d.getDate() - days);
            return d.toISOString().split('T')[0];
        };

        let query = `
            SELECT d.id, d.task_name, DATE_FORMAT(d.scheduled_time, '%Y-%m-%dT%H:%i:%s') as scheduled_time, 
                   d.duration_minutes, d.status, u.name as user_name, d.date 
            FROM daily_task_logs d
            JOIN users u ON d.user_id = u.id
        `;
        let queryParams = [];

        if (filter === 'today') {
            query += ' WHERE d.date = ?';
            queryParams.push(today);
        } else if (filter === 'yesterday') {
            query += ' WHERE d.date = ?';
            queryParams.push(getOffset(1));
        } else if (filter === 'last7') {
            query += ' WHERE d.date BETWEEN ? AND ?';
            queryParams.push(getOffset(6), today);
        } else if (filter === 'last30') {
            query += ' WHERE d.date BETWEEN ? AND ?';
            queryParams.push(getOffset(29), today);
        } else if (filter === 'custom' && clientDate) {
            query += ' WHERE d.date = ?';
            queryParams.push(clientDate);
        }
        // filter === 'all' → no WHERE clause → returns everything

        query += ' ORDER BY d.date DESC, d.scheduled_time ASC';

        const [tasks] = await pool.query(query, queryParams);
        res.json(tasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

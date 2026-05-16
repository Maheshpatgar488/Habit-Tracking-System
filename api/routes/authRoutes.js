const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

router.post('/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ message: 'Please provide username, password, and role' });
        }

        const [users] = await pool.query('SELECT * FROM users WHERE username = ? AND role = ?', [username, role]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials or role' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials or role' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, username: user.username, role: user.role }
        });
    } catch (error) {
        console.error("Auth Error:", error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

module.exports = router;

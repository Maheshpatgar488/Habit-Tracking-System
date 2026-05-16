const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./config/db');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/user', require('./routes/userRoutes'));

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start the cron jobs
require('./cron/midnightGenerator');
require('./cron/statusUpdater');
require('./cron/notificationTrigger');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

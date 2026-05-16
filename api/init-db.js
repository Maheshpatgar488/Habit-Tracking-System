const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDB() {
    try {
        console.log("Connecting to MySQL server...");
        // Connect without a specific database to create it first
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            multipleStatements: true // Required to run the full schema script at once
        });

        console.log("Creating database if it doesn't exist...");
        await connection.query('CREATE DATABASE IF NOT EXISTS task_management;');
        
        console.log("Switching to task_management database...");
        await connection.query('USE task_management;');

        console.log("Reading schema.sql...");
        const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

        console.log("Executing schema.sql...");
        await connection.query(sql);

        console.log("Database initialized successfully!");
        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error("Initialization Failed:", err.message);
        process.exit(1);
    }
}
initDB();

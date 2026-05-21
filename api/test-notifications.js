const pool = require('./config/db');

async function testNotifications() {
    try {
        console.log('=== Starting Notification Query Verification Test ===');
        
        // 1. Get user 30001's subscription timezone offset (default to -330)
        const [subs] = await pool.query('SELECT timezone_offset FROM push_subscriptions WHERE user_id = 30001 LIMIT 1');
        const tzOffset = subs.length > 0 ? subs[0].timezone_offset : -330;
        console.log(`Using timezone offset: ${tzOffset} minutes for user 30001`);

        // 2. Clear any existing temporary dummy tasks
        await pool.query("DELETE FROM daily_task_logs WHERE task_name LIKE 'TEMP_TEST_%'");

        // 3. We will insert 4 temporary test tasks with scheduled_time adjusted relative to local time.
        // We fetch the current database UTC time as a raw string to avoid driver parsing issues.
        const [timeCheck] = await pool.query('SELECT CAST(UTC_TIMESTAMP() AS CHAR) as db_utc');
        const utcStr = timeCheck[0].db_utc;
        console.log('Current Database UTC Time String:', utcStr);

        // Parse raw UTC string
        const [datePart, timePart] = utcStr.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, min, sec] = timePart.split(':').map(Number);
        const dbUtcDate = new Date(Date.UTC(year, month - 1, day, hour, min, sec));

        // Convert UTC to user's local date object (Local = UTC - tzOffset)
        const localNow = new Date(dbUtcDate.getTime() - (tzOffset * 60 * 1000));
        console.log('Calculated User Local Time:', localNow.toISOString().replace('T', ' ').substring(0, 19));

        // Format Date object back to YYYY-MM-DD HH:mm:ss using its UTC methods 
        // because localNow holds the local time shifted into the UTC coordinates.
        const formatLocalSQL = (d) => {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
                   `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
        };

        // Let's define the local scheduled times for our 4 test scenarios:
        // A. Starts in 3 minutes (should trigger 5-min reminder)
        const timeStartsIn3 = new Date(localNow.getTime() + (3 * 60 * 1000));
        // B. Started 5 minutes ago (should trigger start notification)
        const timeStarted5Ago = new Date(localNow.getTime() - (5 * 60 * 1000));
        // C. Starts in 10 minutes (too early, should NOT trigger either)
        const timeStartsIn10 = new Date(localNow.getTime() + (10 * 60 * 1000));
        // D. Started 25 minutes ago (too late, should NOT trigger either)
        const timeStarted25Ago = new Date(localNow.getTime() - (25 * 60 * 1000));

        const tasksToInsert = [
            [30001, 'TEMP_TEST_Starts_In_3', formatLocalSQL(timeStartsIn3), 15, 'pending', '2026-05-21'],
            [30001, 'TEMP_TEST_Started_5_Ago', formatLocalSQL(timeStarted5Ago), 15, 'pending', '2026-05-21'],
            [30001, 'TEMP_TEST_Starts_In_10', formatLocalSQL(timeStartsIn10), 15, 'pending', '2026-05-21'],
            [30001, 'TEMP_TEST_Started_25_Ago', formatLocalSQL(timeStarted25Ago), 15, 'pending', '2026-05-21']
        ];

        await pool.query(
            'INSERT INTO daily_task_logs (user_id, task_name, scheduled_time, duration_minutes, status, date) VALUES ?',
            [tasksToInsert]
        );
        console.log('Inserted 4 temporary dummy tasks successfully.');

        // 4. Run the 5-minute Reminder query
        const query5Min = `
            SELECT d.id, d.task_name,
                   TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), DATE_ADD(d.scheduled_time, INTERVAL COALESCE(p.timezone_offset, -330) MINUTE)) as diff
            FROM daily_task_logs d
            JOIN push_subscriptions p ON d.user_id = p.user_id
            WHERE d.status = 'pending'
            AND d.notif_5min_sent = 0
            AND d.task_name LIKE 'TEMP_TEST_%'
            AND TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), DATE_ADD(d.scheduled_time, INTERVAL COALESCE(p.timezone_offset, -330) MINUTE)) BETWEEN 1 AND 5
        `;
        const [matched5Min] = await pool.query(query5Min);
        console.log('\n--- 5-Minute Reminder Query Results (Expected: TEMP_TEST_Starts_In_3 only) ---');
        console.log(matched5Min);

        // 5. Run the Start Notification query
        const queryStart = `
            SELECT d.id, d.task_name,
                   TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), DATE_ADD(d.scheduled_time, INTERVAL COALESCE(p.timezone_offset, -330) MINUTE)) as diff
            FROM daily_task_logs d
            JOIN push_subscriptions p ON d.user_id = p.user_id
            WHERE d.status = 'pending'
            AND d.notif_start_sent = 0
            AND d.task_name LIKE 'TEMP_TEST_%'
            AND TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), DATE_ADD(d.scheduled_time, INTERVAL COALESCE(p.timezone_offset, -330) MINUTE)) BETWEEN -15 AND 0
        `;
        const [matchedStart] = await pool.query(queryStart);
        console.log('\n--- Start Notification Query Results (Expected: TEMP_TEST_Started_5_Ago only) ---');
        console.log(matchedStart);

        // 6. Clean up temporary tasks
        await pool.query("DELETE FROM daily_task_logs WHERE task_name LIKE 'TEMP_TEST_%'");
        console.log('\nCleaned up all temporary test tasks successfully.');

        // 7. Overall evaluation
        const success5Min = matched5Min.length > 0 && matched5Min.every(t => t.task_name === 'TEMP_TEST_Starts_In_3');
        const successStart = matchedStart.length > 0 && matchedStart.every(t => t.task_name === 'TEMP_TEST_Started_5_Ago');

        if (success5Min && successStart) {
            console.log('\n🎉 SUCCESS: All query windows and boundaries validated perfectly! 🎉');
        } else {
            console.log('\n❌ FAILURE: Mismatch in expected query results. Please review query logic. ❌');
        }

        process.exit(success5Min && successStart ? 0 : 1);
    } catch (err) {
        console.error('Test Error:', err);
        process.exit(1);
    }
}

testNotifications();

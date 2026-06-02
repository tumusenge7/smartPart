require('dotenv').config();
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_NAME = process.env.DB_NAME || 'EPMS';

// First connect without specifying a database to create it if needed
const initDb = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
});

initDb.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }

    initDb.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``, (err) => {
        if (err) {
            console.error('Error creating database:', err.message);
            process.exit(1);
        }
        console.log(`Database '${DB_NAME}' ready`);
        initDb.end();

        // Now connect to the database and run schema
        const db = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log('Running database seed...');

        const sqlPath = path.join(__dirname, 'database.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Remove CREATE DATABASE and USE statements (handled above)
        const cleanSql = sql
            .replace(/CREATE DATABASE.*?;/gi, '')
            .replace(/USE .*?;/gi, '');

        const statements = cleanSql.split(';').filter(s => s.trim());

        // Separate CREATE statements from INSERT statements
        const creates = statements.filter(s => /CREATE/i.test(s));
        const inserts = statements.filter(s => /INSERT/i.test(s));

        let idx = 0;
        const runCreates = () => {
            if (idx >= creates.length) {
                // Run migration after CREATE but before INSERT
                db.query("ALTER TABLE Employee ADD COLUMN Status VARCHAR(20) DEFAULT 'Active'", (err) => {
                    if (err && !err.message.includes('Duplicate column')) {
                        console.log('Migration note:', err.message);
                    } else if (!err) {
                        console.log('Added Status column to Employee table');
                    }
                    idx = 0;
                    runInserts();
                });
                return;
            }
            const stmt = creates[idx].trim();
            idx++;
            if (!stmt) { runCreates(); return; }
            db.query(stmt, (err) => {
                if (err && !err.message.includes('already exists')) {
                    console.log('SQL note:', err.message);
                }
                runCreates();
            });
        };

        const runInserts = () => {
            if (idx >= inserts.length) {
                // All done, now create admin user
                bcrypt.hash('admin123', 10).then(hash => {
                    db.query(
                        'INSERT IGNORE INTO users (username, password, role) VALUES (?, ?, ?)',
                        ['admin', hash, 'admin'],
                        (err) => {
                            if (err) console.error('Error creating admin user:', err.message);
                            else console.log('Admin user created/verified (admin / admin123)');
                            console.log('Seed complete!');
                            process.exit(0);
                        }
                    );
                });
                return;
            }
            const stmt = inserts[idx].trim();
            idx++;
            if (!stmt) { runInserts(); return; }
            db.query(stmt, (err) => {
                if (err && !err.message.includes('already exists')) {
                    console.log('SQL note:', err.message);
                }
                runInserts();
            });
        };

        runCreates();
    });
});

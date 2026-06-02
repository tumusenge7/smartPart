require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param } = require('express-validator');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests. Try again later.' }
});

app.use('/api/login', loginLimiter);
app.use('/api/', apiLimiter);

// Database connection using connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'EPMS',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Validation helper
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

// ============ AUTHENTICATION ============
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    try {
        db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
            if (err) {
                console.error('Login query error:', err);
                return res.status(500).json({ success: false, message: 'Internal server error' });
            }

            if (results.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const user = results[0];
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.json({
                success: true,
                token,
                user: { username: user.username, role: user.role }
            });
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Verify token middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Token expired. Please login again.' });
            }
            return res.status(403).json({ message: 'Invalid token.' });
        }
        req.user = decoded;
        next();
    });
};

// ============ EMPLOYEE CRUD ============
app.get('/api/employees', verifyToken, (req, res) => {
    db.query('SELECT * FROM Employee', (err, results) => {
        if (err) {
            console.error('Employee fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch employees' });
        }
        res.json(results);
    });
});

app.post('/api/employees', verifyToken, [
    body('employeeNumber').trim().notEmpty().withMessage('Employee number is required'),
    body('FirstName').trim().notEmpty().withMessage('First name is required'),
    body('LastName').trim().notEmpty().withMessage('Last name is required'),
    body('Position').trim().notEmpty().withMessage('Position is required'),
    body('Gender').trim().isIn(['M', 'F']).withMessage('Gender must be M or F'),
    body('DepartmentCode').trim().notEmpty().withMessage('Department code is required'),
    body('Telephone').optional().trim().isLength({ max: 20 }).withMessage('Telephone too long'),
    body('hiredDate').optional().isDate().withMessage('Invalid date format'),
    body('Status').optional().trim().isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive'),
    validate
], (req, res) => {
    const { employeeNumber, FirstName, LastName, Position, Address, Telephone, Gender, hiredDate, DepartmentCode, Status } = req.body;

    db.query(
        `INSERT INTO Employee (employeeNumber, FirstName, LastName, Position, Address, Telephone, Gender, hiredDate, DepartmentCode, Status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [employeeNumber, FirstName, LastName, Position, Address || null, Telephone || null, Gender, hiredDate || null, DepartmentCode, Status || 'Active'],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    db.query('SELECT Status FROM Employee WHERE employeeNumber = ?', [employeeNumber], (selErr, rows) => {
                        if (!selErr && rows.length > 0) {
                            return res.status(409).json({ error: `Employee number already exists with Status: ${rows[0].Status}` });
                        }
                        return res.status(409).json({ error: 'Employee number already exists' });
                    });
                    return;
                }
                console.error('Employee create error:', err);
                return res.status(500).json({ error: 'Failed to create employee' });
            }
            res.json({ success: true, id: result.insertId });
        }
    );
});

app.put('/api/employees/:id', verifyToken, [
    param('id').trim().notEmpty().withMessage('Employee ID is required'),
    body('FirstName').trim().notEmpty().withMessage('First name is required'),
    body('LastName').trim().notEmpty().withMessage('Last name is required'),
    body('Position').trim().notEmpty().withMessage('Position is required'),
    body('Gender').trim().isIn(['M', 'F']).withMessage('Gender must be M or F'),
    body('DepartmentCode').trim().notEmpty().withMessage('Department code is required'),
    body('Telephone').optional().trim().isLength({ max: 20 }).withMessage('Telephone too long'),
    body('hiredDate').optional().isDate().withMessage('Invalid date format'),
    body('Status').optional().trim().isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive'),
    validate
], (req, res) => {
    const { FirstName, LastName, Position, Address, Telephone, Gender, hiredDate, DepartmentCode, Status } = req.body;

    db.query(
        `UPDATE Employee SET FirstName=?, LastName=?, Position=?, Address=?, Telephone=?, Gender=?, hiredDate=?, DepartmentCode=?, Status=?
         WHERE employeeNumber=?`,
        [FirstName, LastName, Position, Address || null, Telephone || null, Gender, hiredDate || null, DepartmentCode, Status || 'Active', req.params.id],
        (err, result) => {
            if (err) {
                console.error('Employee update error:', err);
                return res.status(500).json({ error: 'Failed to update employee' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Employee not found' });
            }
            res.json({ success: true });
        }
    );
});

app.delete('/api/employees/:id', verifyToken, [
    param('id').trim().notEmpty().withMessage('Employee ID is required'),
    validate
], (req, res) => {
    db.query('DELETE FROM Employee WHERE employeeNumber=?', [req.params.id], (err, result) => {
        if (err) {
            console.error('Employee delete error:', err);
            return res.status(500).json({ error: 'Failed to delete employee' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json({ success: true });
    });
});

// ============ DEPARTMENT CRUD ============
app.get('/api/departments', verifyToken, (req, res) => {
    db.query('SELECT * FROM Department', (err, results) => {
        if (err) {
            console.error('Department fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch departments' });
        }
        res.json(results);
    });
});

app.post('/api/departments', verifyToken, [
    body('DepartmentCode').trim().notEmpty().isLength({ max: 10 }).withMessage('Department code is required (max 10 chars)'),
    body('DepartmentName').trim().notEmpty().withMessage('Department name is required'),
    body('GrossSalary').isFloat({ min: 0 }).withMessage('Gross salary must be a positive number'),
    validate
], (req, res) => {
    const { DepartmentCode, DepartmentName, GrossSalary } = req.body;

    db.query('INSERT INTO Department VALUES (?, ?, ?)',
        [DepartmentCode, DepartmentName, GrossSalary],
        (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Department code already exists' });
                }
                console.error('Department create error:', err);
                return res.status(500).json({ error: 'Failed to create department' });
            }
            res.json({ success: true });
        }
    );
});

app.put('/api/departments/:code', verifyToken, [
    param('code').trim().notEmpty().withMessage('Department code is required'),
    body('DepartmentName').trim().notEmpty().withMessage('Department name is required'),
    body('GrossSalary').isFloat({ min: 0 }).withMessage('Gross salary must be a positive number'),
    validate
], (req, res) => {
    const { DepartmentName, GrossSalary } = req.body;

    db.query('UPDATE Department SET DepartmentName=?, GrossSalary=? WHERE DepartmentCode=?',
        [DepartmentName, GrossSalary, req.params.code],
        (err, result) => {
            if (err) {
                console.error('Department update error:', err);
                return res.status(500).json({ error: 'Failed to update department' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Department not found' });
            }
            res.json({ success: true });
        }
    );
});

app.delete('/api/departments/:code', verifyToken, [
    param('code').trim().notEmpty().withMessage('Department code is required'),
    validate
], (req, res) => {
    db.query('DELETE FROM Department WHERE DepartmentCode=?', [req.params.code], (err, result) => {
        if (err) {
            console.error('Department delete error:', err);
            return res.status(500).json({ error: 'Failed to delete department' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
        res.json({ success: true });
    });
});

// ============ SALARY CRUD ============
app.get('/api/salaries', verifyToken, (req, res) => {
    const query = `SELECT s.*, d.DepartmentName
                   FROM Salary s
                   JOIN Department d ON s.DepartmentCode = d.DepartmentCode`;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Salary fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch salaries' });
        }
        res.json(results);
    });
});

app.post('/api/salaries', verifyToken, [
    body('DepartmentCode').trim().notEmpty().withMessage('Department code is required'),
    body('GrossSalary').isFloat({ min: 0 }).withMessage('Gross salary must be a positive number'),
    body('TotalDeduction').isFloat({ min: 0 }).withMessage('Total deduction must be a positive number'),
    body('NetSalary').isFloat({ min: 0 }).withMessage('Net salary must be a positive number'),
    body('month').trim().notEmpty().withMessage('Month is required'),
    validate
], (req, res) => {
    const { DepartmentCode, GrossSalary, TotalDeduction, NetSalary, month } = req.body;

    db.query('INSERT INTO Salary (DepartmentCode, GrossSalary, TotalDeduction, NetSalary, month) VALUES (?, ?, ?, ?, ?)',
        [DepartmentCode, GrossSalary, TotalDeduction, NetSalary, month],
        (err) => {
            if (err) {
                console.error('Salary create error:', err);
                return res.status(500).json({ error: 'Failed to create salary record' });
            }
            res.json({ success: true });
        }
    );
});

app.put('/api/salaries/:id', verifyToken, [
    param('id').isInt().withMessage('Salary ID must be an integer'),
    body('DepartmentCode').trim().notEmpty().withMessage('Department code is required'),
    body('GrossSalary').isFloat({ min: 0 }).withMessage('Gross salary must be a positive number'),
    body('TotalDeduction').isFloat({ min: 0 }).withMessage('Total deduction must be a positive number'),
    body('NetSalary').isFloat({ min: 0 }).withMessage('Net salary must be a positive number'),
    body('month').trim().notEmpty().withMessage('Month is required'),
    validate
], (req, res) => {
    const { DepartmentCode, GrossSalary, TotalDeduction, NetSalary, month } = req.body;

    db.query('UPDATE Salary SET DepartmentCode=?, GrossSalary=?, TotalDeduction=?, NetSalary=?, month=? WHERE SalaryID=?',
        [DepartmentCode, GrossSalary, TotalDeduction, NetSalary, month, req.params.id],
        (err, result) => {
            if (err) {
                console.error('Salary update error:', err);
                return res.status(500).json({ error: 'Failed to update salary record' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Salary record not found' });
            }
            res.json({ success: true });
        }
    );
});

app.delete('/api/salaries/:id', verifyToken, [
    param('id').isInt().withMessage('Salary ID must be an integer'),
    validate
], (req, res) => {
    db.query('DELETE FROM Salary WHERE SalaryID=?', [req.params.id], (err, result) => {
        if (err) {
            console.error('Salary delete error:', err);
            return res.status(500).json({ error: 'Failed to delete salary record' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Salary record not found' });
        }
        res.json({ success: true });
    });
});

// ============ MONTHLY PAYROLL REPORT ============
app.get('/api/monthly-payroll', verifyToken, (req, res) => {
    const query = `SELECT e.FirstName, e.LastName, e.Position, d.DepartmentName, s.NetSalary, s.month
                   FROM Employee e
                   JOIN Department d ON e.DepartmentCode = d.DepartmentCode
                   JOIN Salary s ON d.DepartmentCode = s.DepartmentCode`;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Payroll report error:', err);
            return res.status(500).json({ error: 'Failed to generate payroll report' });
        }
        res.json(results);
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running securely on port ${PORT}`);
});

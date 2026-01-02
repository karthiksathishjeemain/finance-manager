const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                family_name VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS loans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                borrowed_by VARCHAR(255) NOT NULL,
                lender_name VARCHAR(255) NOT NULL,
                loan_source VARCHAR(50) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                date DATE NOT NULL,
                interest_rate DECIMAL(5, 2),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS family_members (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('Database tables initialized');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

initializeDatabase();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(session({
    secret: process.env.SESSION_SECRET || 'family-loans-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
}

app.post('/api/register', async (req, res) => {
    const { familyName, password } = req.body;

    if (!familyName || !password) {
        return res.status(400).json({ error: 'Family name and password are required' });
    }

    try {
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE family_name = $1',
            [familyName]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Family name already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            'INSERT INTO users (family_name, password_hash) VALUES ($1, $2) RETURNING id, family_name',
            [familyName, hashedPassword]
        );

        req.session.userId = result.rows[0].id;
        req.session.familyName = result.rows[0].family_name;

        res.json({
            message: 'Registration successful',
            familyName: result.rows[0].family_name
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    const { familyName, password } = req.body;

    if (!familyName || !password) {
        return res.status(400).json({ error: 'Family name and password are required' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE family_name = $1',
            [familyName]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.id;
        req.session.familyName = user.family_name;

        res.json({
            message: 'Login successful',
            familyName: user.family_name
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logout successful' });
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            familyName: req.session.familyName
        });
    } else {
        res.json({ authenticated: false });
    }
});

app.get('/api/family-members', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM family_members WHERE user_id = $1 ORDER BY name ASC',
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching family members:', error);
        res.status(500).json({ error: 'Error fetching family members' });
    }
});

app.post('/api/family-members/bulk', isAuthenticated, async (req, res) => {
    const { members } = req.body;

    if (!members || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ error: 'Members array is required' });
    }

    try {
        for (const name of members) {
            if (name && name.trim()) {
                await pool.query(
                    'INSERT INTO family_members (user_id, name) VALUES ($1, $2)',
                    [req.session.userId, name.trim()]
                );
            }
        }

        const result = await pool.query(
            'SELECT * FROM family_members WHERE user_id = $1 ORDER BY name ASC',
            [req.session.userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error adding family members:', error);
        res.status(500).json({ error: 'Error adding family members' });
    }
});

app.post('/api/family-members', isAuthenticated, async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO family_members (user_id, name) VALUES ($1, $2) RETURNING *',
            [req.session.userId, name.trim()]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error adding family member:', error);
        res.status(500).json({ error: 'Error adding family member' });
    }
});

app.put('/api/family-members/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }

    try {
        const result = await pool.query(
            'UPDATE family_members SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
            [name.trim(), id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Family member not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating family member:', error);
        res.status(500).json({ error: 'Error updating family member' });
    }
});

app.delete('/api/family-members/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM family_members WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Family member not found' });
        }

        res.json({ success: true, message: 'Family member deleted successfully' });
    } catch (error) {
        console.error('Error deleting family member:', error);
        res.status(500).json({ error: 'Error deleting family member' });
    }
});

app.get('/api/loans', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC',
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching loans:', error);
        res.status(500).json({ error: 'Error fetching loans' });
    }
});

app.post('/api/loans', isAuthenticated, async (req, res) => {
    const { borrowedBy, lenderName, loanSource, amount, date, interestRate, notes } = req.body;

    if (!borrowedBy || !lenderName || !loanSource || !amount || !date) {
        return res.status(400).json({ error: 'All required fields must be provided' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO loans (user_id, borrowed_by, lender_name, loan_source, amount, date, interest_rate, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [req.session.userId, borrowedBy, lenderName, loanSource, amount, date, interestRate || null, notes || '']
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating loan:', error);
        res.status(500).json({ error: 'Error creating loan' });
    }
});

app.put('/api/loans/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { borrowedBy, lenderName, loanSource, amount, date, interestRate, notes } = req.body;

    if (!borrowedBy || !lenderName || !loanSource || !amount || !date) {
        return res.status(400).json({ error: 'All required fields must be provided' });
    }

    try {
        const result = await pool.query(
            `UPDATE loans 
             SET borrowed_by = $1, lender_name = $2, loan_source = $3, amount = $4, 
                 date = $5, interest_rate = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 AND user_id = $9 RETURNING *`,
            [borrowedBy, lenderName, loanSource, amount, date, interestRate || null, notes || '', id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Loan not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating loan:', error);
        res.status(500).json({ error: 'Error updating loan' });
    }
});

app.delete('/api/loans/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM loans WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Loan not found' });
        }

        res.json({ success: true, message: 'Loan deleted successfully' });
    } catch (error) {
        console.error('Error deleting loan:', error);
        res.status(500).json({ error: 'Error deleting loan' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Family Loans Manager Server Running!`);
        console.log(`📊 Access the app at: http://localhost:${PORT}`);
        console.log(`💾 Database: PostgreSQL\n`);
    });
}

module.exports = app;

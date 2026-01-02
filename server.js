const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./family_loans.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_name TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        borrowed_by TEXT NOT NULL,
        lender_name TEXT NOT NULL,
        loan_source TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        interest_rate REAL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    console.log('Database tables initialized');
}

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
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            'INSERT INTO users (family_name, password) VALUES (?, ?)',
            [familyName, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Family name already exists' });
                    }
                    return res.status(500).json({ error: 'Error creating account' });
                }

                req.session.userId = this.lastID;
                req.session.familyName = familyName;
                res.json({
                    success: true,
                    message: 'Account created successfully',
                    familyName: familyName
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { familyName, password } = req.body;

    if (!familyName || !password) {
        return res.status(400).json({ error: 'Family name and password are required' });
    }

    db.get(
        'SELECT * FROM users WHERE family_name = ?',
        [familyName],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Server error' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Invalid family name or password' });
            }

            try {
                const match = await bcrypt.compare(password, user.password);

                if (match) {
                    req.session.userId = user.id;
                    req.session.familyName = user.family_name;
                    res.json({
                        success: true,
                        message: 'Login successful',
                        familyName: user.family_name
                    });
                } else {
                    res.status(401).json({ error: 'Invalid family name or password' });
                }
            } catch (error) {
                res.status(500).json({ error: 'Server error' });
            }
        }
    );
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error logging out' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
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


app.get('/api/family-members', isAuthenticated, (req, res) => {
    db.all(
        'SELECT * FROM family_members WHERE user_id = ? ORDER BY name ASC',
        [req.session.userId],
        (err, members) => {
            if (err) {
                return res.status(500).json({ error: 'Error fetching family members' });
            }
            res.json(members);
        }
    );
});

app.post('/api/family-members/bulk', isAuthenticated, (req, res) => {
    const { members } = req.body;

    if (!members || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ error: 'Members array is required' });
    }

    const stmt = db.prepare('INSERT INTO family_members (user_id, name) VALUES (?, ?)');

    members.forEach(name => {
        if (name && name.trim()) {
            stmt.run(req.session.userId, name.trim());
        }
    });

    stmt.finalize((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error adding family members' });
        }

        db.all(
            'SELECT * FROM family_members WHERE user_id = ? ORDER BY name ASC',
            [req.session.userId],
            (err, members) => {
                if (err) {
                    return res.status(500).json({ error: 'Error fetching family members' });
                }
                res.json(members);
            }
        );
    });
});

app.post('/api/family-members', isAuthenticated, (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }

    db.run(
        'INSERT INTO family_members (user_id, name) VALUES (?, ?)',
        [req.session.userId, name.trim()],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Error adding family member' });
            }

            db.get(
                'SELECT * FROM family_members WHERE id = ?',
                [this.lastID],
                (err, member) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error fetching member' });
                    }
                    res.json(member);
                }
            );
        }
    );
});

app.put('/api/family-members/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }

    db.run(
        'UPDATE family_members SET name = ? WHERE id = ? AND user_id = ?',
        [name.trim(), id, req.session.userId],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Error updating family member' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Family member not found' });
            }

            db.get(
                'SELECT * FROM family_members WHERE id = ?',
                [id],
                (err, member) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error fetching member' });
                    }
                    res.json(member);
                }
            );
        }
    );
});

app.delete('/api/family-members/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;

    db.run(
        'DELETE FROM family_members WHERE id = ? AND user_id = ?',
        [id, req.session.userId],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Error deleting family member' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Family member not found' });
            }

            res.json({ success: true, message: 'Family member deleted successfully' });
        }
    );
});


app.get('/api/loans', isAuthenticated, (req, res) => {
    db.all(
        'SELECT * FROM loans WHERE user_id = ? ORDER BY created_at DESC',
        [req.session.userId],
        (err, loans) => {
            if (err) {
                return res.status(500).json({ error: 'Error fetching loans' });
            }
            res.json(loans);
        }
    );
});

app.post('/api/loans', isAuthenticated, (req, res) => {
    const { borrowedBy, lenderName, loanSource, amount, date, interestRate, notes } = req.body;

    if (!borrowedBy || !lenderName || !loanSource || !amount || !date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.run(
        `INSERT INTO loans (user_id, borrowed_by, lender_name, loan_source, amount, date, interest_rate, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.session.userId, borrowedBy, lenderName, loanSource, amount, date, interestRate || null, notes || ''],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Error creating loan' });
            }

            db.get(
                'SELECT * FROM loans WHERE id = ?',
                [this.lastID],
                (err, loan) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error fetching created loan' });
                    }
                    res.json(loan);
                }
            );
        }
    );
});

app.put('/api/loans/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const { borrowedBy, lenderName, loanSource, amount, date, interestRate, notes } = req.body;

    db.run(
        `UPDATE loans 
         SET borrowed_by = ?, lender_name = ?, loan_source = ?, amount = ?, date = ?, 
             interest_rate = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [borrowedBy, lenderName, loanSource, amount, date, interestRate || null, notes || '', id, req.session.userId],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Error updating loan' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Loan not found' });
            }

            db.get(
                'SELECT * FROM loans WHERE id = ?',
                [id],
                (err, loan) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error fetching updated loan' });
                    }
                    res.json(loan);
                }
            );
        }
    );
});

app.delete('/api/loans/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;

    db.run(
        'DELETE FROM loans WHERE id = ? AND user_id = ?',
        [id, req.session.userId],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Error deleting loan' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Loan not found' });
            }

            res.json({ success: true, message: 'Loan deleted successfully' });
        }
    );
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Family Loans Manager Server Running!`);
    console.log(`📊 Access the app at: http://localhost:${PORT}`);
    console.log(`💾 Database: family_loans.db\n`);
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('\n✅ Database connection closed');
        }
        process.exit(0);
    });
});

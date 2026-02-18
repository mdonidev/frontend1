const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jwt-simple');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from current directory
app.use(express.static(path.join(__dirname, '.')));

// Protect image hotlinking (basic server-side protection)
// Blocks requests for image files when the Referer header is from another origin.
// Configure via HOTLINK_PROTECT env var (default: true)
const HOTLINK_PROTECT = process.env.HOTLINK_PROTECT !== 'false';
if (HOTLINK_PROTECT) {
    app.use((req, res, next) => {
        // Only inspect GET requests for image resources
        if (req.method !== 'GET') return next();

        const ext = path.extname(req.path).toLowerCase();
        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
        if (!imageExts.includes(ext)) return next();

        const referer = req.get('referer') || '';
        const host = `${req.protocol}://${req.get('host')}`;

        // Allow same-origin requests or empty referer (some clients omit it)
        if (referer && !referer.startsWith(host) && !referer.startsWith('https://backend-production-4bcf.up.railway.app')) {
            return res.status(403).send('Hotlinking not allowed');
        }

        // Try to serve the file from disk if it exists under project
        const filePath = path.join(__dirname, req.path);
        return res.sendFile(filePath, (err) => {
            if (err) return next();
        });
    });

    // Add basic anti-framing header for extra protection
    app.use((req, res, next) => {
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
        next();
    });
}

// Database setup
const db = new sqlite3.Database('./kayal_database.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                phone TEXT,
                address TEXT,
                city TEXT,
                zipCode TEXT,
                newsletter BOOLEAN DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Orders table
        db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                orderNumber TEXT UNIQUE,
                totalAmount REAL,
                status TEXT DEFAULT 'pending',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(id)
            )
        `);

        // Order items table
        db.run(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orderId INTEGER NOT NULL,
                productName TEXT NOT NULL,
                size TEXT,
                color TEXT,
                quantity INTEGER,
                price REAL,
                FOREIGN KEY(orderId) REFERENCES orders(id)
            )
        `);

        // Wishlist table
        db.run(`
            CREATE TABLE IF NOT EXISTS wishlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                productName TEXT NOT NULL,
                price REAL,
                addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(id)
            )
        `);

        // Products table
        db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                category TEXT,
                sizes TEXT,
                colors TEXT,
                stock INTEGER DEFAULT 0,
                image TEXT,
                isActive BOOLEAN DEFAULT 1,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Admin table
        db.run(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER UNIQUE NOT NULL,
                role TEXT DEFAULT 'admin',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(id)
            )
        `);

        // Site settings table for configurable homepage elements
        db.run(`
            CREATE TABLE IF NOT EXISTS site_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_key TEXT UNIQUE NOT NULL,
                setting_value TEXT NOT NULL,
                description TEXT,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default site settings if they don't exist
        const defaultSettings = [
            { key: 'hero_emoji', value: '👕', description: 'Hero section t-shirt emoji' },
            { key: 'classic_white_emoji', value: '👕', description: 'Classic White product emoji' },
            { key: 'color_bold_emoji', value: '🎨', description: 'Color Bold product emoji' },
            { key: 'premium_comfort_emoji', value: '✨', description: 'Premium Comfort product emoji' },
            { key: 'signature_edition_emoji', value: '🌟', description: 'Signature Edition product emoji' },
            { key: 'shipping_icon', value: '🚚', description: 'Shipping feature icon' },
            { key: 'returns_icon', value: '🔄', description: 'Returns feature icon' },
            { key: 'support_icon', value: '💬', description: 'Support feature icon' }
        ];

        defaultSettings.forEach(setting => {
            db.run(
                'INSERT OR IGNORE INTO site_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
                [setting.key, setting.value, setting.description]
            );
        });

        // Seed sample products
        const sampleProducts = [
            {
                name: 'Classic White',
                description: 'Premium classic white t-shirt',
                price: 19.99,
                category: 'Classic',
                sizes: JSON.stringify(['XS', 'S', 'M', 'L', 'XL']),
                colors: JSON.stringify(['White', 'Black', 'Navy']),
                stock: 50,
                image: '👕'
            },
            {
                name: 'Color Bold',
                description: 'Vibrant colored t-shirt with bold design',
                price: 22.99,
                category: 'Premium',
                sizes: JSON.stringify(['XS', 'S', 'M', 'L', 'XL']),
                colors: JSON.stringify(['Red', 'Blue', 'Green', 'Yellow']),
                stock: 40,
                image: '🎨'
            },
            {
                name: 'Premium Comfort',
                description: 'Ultra-soft premium comfort t-shirt',
                price: 24.99,
                category: 'Premium',
                sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
                colors: JSON.stringify(['White', 'Grey', 'Black']),
                stock: 35,
                image: '✨'
            },
            {
                name: 'Signature Edition',
                description: 'Exclusive signature edition limited t-shirt',
                price: 29.99,
                category: 'Limited',
                sizes: JSON.stringify(['M', 'L', 'XL']),
                colors: JSON.stringify(['Black', 'Gold']),
                stock: 20,
                image: '🌟'
            }
        ];

        sampleProducts.forEach(product => {
            db.run(
                `INSERT OR IGNORE INTO products (name, description, price, category, sizes, colors, stock, image, isActive) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [product.name, product.description, product.price, product.category, 
                 typeof product.sizes === 'string' ? product.sizes : JSON.stringify(product.sizes), 
                 typeof product.colors === 'string' ? product.colors : JSON.stringify(product.colors), 
                 product.stock, product.image]
            );
        });

        console.log('Database tables initialized');
    });
}

// Routes

// Register endpoint
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, email, password, phone, address, city, zipCode, newsletter } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
        db.run(
            `INSERT INTO users (firstName, lastName, email, password, phone, address, city, zipCode, newsletter)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [firstName, lastName, email, hashedPassword, phone || null, address || null, city || null, zipCode || null, newsletter ? 1 : 0],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ message: 'Email already registered' });
                    }
                    return res.status(500).json({ message: 'Registration failed: ' + err.message });
                }

                res.status(201).json({
                    message: 'User registered successfully',
                    userId: this.lastID
                });
            }
        );
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        try {
            // Compare passwords
            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Generate JWT token
            const token = jwt.encode({
                id: user.id,
                email: user.email,
                firstName: user.firstName
            }, JWT_SECRET);

            // Return user data without password
            const userWithoutPassword = { ...user };
            delete userWithoutPassword.password;

            res.json({
                message: 'Login successful',
                token: token,
                user: userWithoutPassword
            });
        } catch (error) {
            res.status(500).json({ message: 'Error during login: ' + error.message });
        }
    });
});

// Get user profile endpoint
app.get('/api/user/:id', authenticateToken, (req, res) => {
    const userId = req.params.id;

    db.get('SELECT id, firstName, lastName, email, phone, address, city, zipCode, createdAt FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    });
});

// Update user profile endpoint
app.put('/api/user/:id', authenticateToken, (req, res) => {
    const userId = req.params.id;
    const { firstName, lastName, phone, address, city, zipCode } = req.body;

    db.run(
        `UPDATE users SET firstName = ?, lastName = ?, phone = ?, address = ?, city = ?, zipCode = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [firstName, lastName, phone, address, city, zipCode, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'Update failed: ' + err.message });
            }

            res.json({ message: 'Profile updated successfully' });
        }
    );
});

// Get user orders
app.get('/api/user/:id/orders', authenticateToken, (req, res) => {
    const userId = req.params.id;

    db.all('SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC', [userId], (err, orders) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }

        res.json(orders);
    });
});

// Add to wishlist
app.post('/api/wishlist', authenticateToken, (req, res) => {
    const { userId, productName, price } = req.body;

    db.run(
        'INSERT INTO wishlist (userId, productName, price) VALUES (?, ?, ?)',
        [userId, productName, price],
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error adding to wishlist: ' + err.message });
            }

            res.status(201).json({
                message: 'Added to wishlist',
                id: this.lastID
            });
        }
    );
});

// Get user wishlist
app.get('/api/user/:id/wishlist', authenticateToken, (req, res) => {
    const userId = req.params.id;

    db.all('SELECT * FROM wishlist WHERE userId = ? ORDER BY addedAt DESC', [userId], (err, items) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }

        res.json(items);
    });
});

// Remove from wishlist
app.delete('/api/wishlist/:id', authenticateToken, (req, res) => {
    const wishlistId = req.params.id;

    db.run('DELETE FROM wishlist WHERE id = ?', [wishlistId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error removing from wishlist: ' + err.message });
        }

        res.json({ message: 'Removed from wishlist' });
    });
});

// Create order
app.post('/api/orders', authenticateToken, (req, res) => {
    const { userId, items, totalAmount } = req.body;
    const orderNumber = 'ORD-' + Date.now();

    db.run(
        'INSERT INTO orders (userId, orderNumber, totalAmount, status) VALUES (?, ?, ?, ?)',
        [userId, orderNumber, totalAmount, 'pending'],
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error creating order: ' + err.message });
            }

            const orderId = this.lastID;

            // Insert order items
            let completed = 0;
            items.forEach((item) => {
                db.run(
                    'INSERT INTO order_items (orderId, productName, size, color, quantity, price) VALUES (?, ?, ?, ?, ?, ?)',
                    [orderId, item.name, item.size || null, item.color || null, item.quantity, item.price],
                    (err) => {
                        if (err) console.error('Error inserting order item:', err);
                        completed++;
                        if (completed === items.length) {
                            res.status(201).json({
                                message: 'Order created successfully',
                                orderId: orderId,
                                orderNumber: orderNumber
                            });
                        }
                    }
                );
            });
        }
    );
});
// Get order items
app.get('/api/orders/:orderId/items', authenticateToken, (req, res) => {
    const { orderId } = req.params;

    db.all('SELECT * FROM order_items WHERE orderId = ?', [orderId], (err, items) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching order items: ' + err.message });
        }
        res.json(items);
    });
});
// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.decode(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ message: 'Invalid token: ' + error.message });
    }
}

// Admin authorization middleware
function checkAdminAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.decode(token, JWT_SECRET);
        req.user = decoded;

        // Check if user is admin
        db.get('SELECT * FROM admins WHERE userId = ?', [decoded.id], (err, admin) => {
            if (err) {
                return res.status(500).json({ message: 'Database error: ' + err.message });
            }

            if (!admin) {
                return res.status(403).json({ message: 'Admin access required' });
            }

            req.admin = admin;
            next();
        });
    } catch (error) {
        res.status(403).json({ message: 'Invalid token: ' + error.message });
    }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// ============================================
// ADMIN CRUD OPERATIONS
// ============================================

// Get all products (public)
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products WHERE isActive = 1', (err, products) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }
        res.json(products);
    });
});

// Get single product by ID (public)
app.get('/api/products/:id', (req, res) => {
    const productId = req.params.id;

    db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    });
});

// Create product (admin only)
app.post('/api/admin/products', checkAdminAuth, (req, res) => {
    const { name, description, price, category, sizes, colors, stock, image } = req.body;

    if (!name || !price) {
        return res.status(400).json({ message: 'Name and price are required' });
    }

    // Always stringify if not already a string
    const sizesStr = typeof sizes === 'string' ? sizes : JSON.stringify(sizes);
    const colorsStr = typeof colors === 'string' ? colors : JSON.stringify(colors);

    db.run(
        `INSERT INTO products (name, description, price, category, sizes, colors, stock, image, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [name, description, price, category, sizesStr, colorsStr, stock, image],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'Product name already exists' });
                }
                return res.status(500).json({ message: 'Error creating product: ' + err.message });
            }

            res.status(201).json({
                message: 'Product created successfully',
                productId: this.lastID
            });
        }
    );
});

// Update product (admin only)
app.put('/api/admin/products/:id', checkAdminAuth, (req, res) => {
    const productId = req.params.id;
    const { name, description, price, category, sizes, colors, stock, image, isActive } = req.body;

    // Always stringify if not already a string
    const sizesStr = typeof sizes === 'string' ? sizes : JSON.stringify(sizes);
    const colorsStr = typeof colors === 'string' ? colors : JSON.stringify(colors);

    db.run(
        `UPDATE products 
         SET name = ?, description = ?, price = ?, category = ?, sizes = ?, colors = ?, 
             stock = ?, image = ?, isActive = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, description, price, category, sizesStr, colorsStr, 
         stock, image, isActive !== undefined ? isActive : 1, productId],
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error updating product: ' + err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ message: 'Product not found' });
            }

            res.json({ message: 'Product updated successfully' });
        }
    );
});

// Delete product (admin only)
app.delete('/api/admin/products/:id', checkAdminAuth, (req, res) => {
    const productId = req.params.id;

    db.run('DELETE FROM products WHERE id = ?', [productId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error deleting product: ' + err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully' });
    });
});

// Get all products (admin - including inactive)
app.get('/api/admin/products', checkAdminAuth, (req, res) => {
    db.all('SELECT * FROM products ORDER BY createdAt DESC', (err, products) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }
        res.json(products);
    });
});

// Get dashboard stats (admin only)
app.get('/api/admin/stats', checkAdminAuth, (req, res) => {
    Promise.all([
        new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                if (err) reject(err);
                resolve(row.count);
            });
        }),
        new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
                if (err) reject(err);
                resolve(row.count);
            });
        }),
        new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM orders', (err, row) => {
                if (err) reject(err);
                resolve(row.count);
            });
        }),
        new Promise((resolve, reject) => {
            db.get('SELECT SUM(totalAmount) as total FROM orders', (err, row) => {
                if (err) reject(err);
                resolve(row.total || 0);
            });
        })
    ]).then(([userCount, productCount, orderCount, totalRevenue]) => {
        res.json({
            users: userCount,
            products: productCount,
            orders: orderCount,
            revenue: totalRevenue
        });
    }).catch(err => {
        res.status(500).json({ message: 'Error fetching stats: ' + err.message });
    });
});

// Get all users (admin only)
app.get('/api/admin/users', checkAdminAuth, (req, res) => {
    db.all('SELECT id, firstName, lastName, email, phone, city, createdAt FROM users ORDER BY createdAt DESC', 
        (err, users) => {
            if (err) {
                return res.status(500).json({ message: 'Database error: ' + err.message });
            }
            res.json(users);
        }
    );
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', checkAdminAuth, (req, res) => {
    const userId = req.params.id;

    // Don't allow deleting self
    if (userId == req.user.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error deleting user: ' + err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    });
});

// Get all orders (admin only)
app.get('/api/admin/orders', checkAdminAuth, (req, res) => {
    db.all('SELECT * FROM orders ORDER BY createdAt DESC', (err, orders) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }
        res.json(orders);
    });
});

// Update order status (admin only)
app.put('/api/admin/orders/:id', checkAdminAuth, (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error updating order: ' + err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ message: 'Order status updated successfully' });
    });
});

// Make user admin (admin only)
app.post('/api/admin/make-admin/:userId', checkAdminAuth, (req, res) => {
    const userId = req.params.userId;

    db.run(
        'INSERT INTO admins (userId, role) VALUES (?, ?)',
        [userId, 'admin'],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'User is already an admin' });
                }
                return res.status(500).json({ message: 'Error: ' + err.message });
            }

            res.status(201).json({ message: 'User is now an admin' });
        }
    );
});

// Remove admin privileges (admin only)
app.delete('/api/admin/remove-admin/:userId', checkAdminAuth, (req, res) => {
    const userId = req.params.userId;

    // Don't allow removing self
    if (userId == req.user.id) {
        return res.status(400).json({ message: 'Cannot remove your own admin privileges' });
    }

    db.run('DELETE FROM admins WHERE userId = ?', [userId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error: ' + err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        res.json({ message: 'Admin privileges removed' });
    });
});

// SITE SETTINGS ENDPOINTS

// Get all site settings (public)
app.get('/api/site-settings', (req, res) => {
    db.all('SELECT setting_key, setting_value FROM site_settings', (err, settings) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching site settings: ' + err.message });
        }

        // Convert to key-value object
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.setting_key] = setting.setting_value;
        });

        res.json(settingsObj);
    });
});

// Get all site settings with descriptions (admin only)
app.get('/api/admin/site-settings', checkAdminAuth, (req, res) => {
    db.all('SELECT * FROM site_settings ORDER BY setting_key', (err, settings) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching site settings: ' + err.message });
        }
        res.json(settings);
    });
});

// Update site setting (admin only)
app.put('/api/admin/site-settings/:key', checkAdminAuth, (req, res) => {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
        return res.status(400).json({ message: 'Value is required' });
    }

    db.run(
        'UPDATE site_settings SET setting_value = ?, updatedAt = CURRENT_TIMESTAMP WHERE setting_key = ?',
        [value, key],
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error updating setting: ' + err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ message: 'Setting not found' });
            }

            res.json({ message: 'Setting updated successfully' });
        }
    );
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Server error: ' + err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on https://backend-production-4bcf.up.railway.app:${PORT}`);
    console.log('API endpoints:');
    console.log('  POST   /api/register - Register new user');
    console.log('  POST   /api/login - Login user');
    console.log('  GET    /api/health - Health check');
});

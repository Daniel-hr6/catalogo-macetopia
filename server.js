const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

// Ensure uploads directory exists
const fsSync = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fsSync.existsSync(uploadDir)){
    fsSync.mkdirSync(uploadDir);
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, 'img-' + Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// Serve static files from the same directory
app.use(express.static(__dirname));

// Expose the uploads directory securely
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Function to read JSON db
async function readDB() {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
}

// Function to write to JSON db
async function writeDB(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// --- API Endpoints ---

// Middleware to authenticate admin
const authenticate = async (req, res, next) => {
    const db = await readDB();
    const storedPwd = db.config.password || 'admin';
    const reqPwd = req.headers['x-admin-password'];
    if (reqPwd === storedPwd) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// GET /api/config
app.get('/api/config', async (req, res) => {
    try {
        const db = await readDB();
        const conf = { ...db.config };
        delete conf.password;
        res.json(conf);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read database' });
    }
});

// POST /api/check-password
app.post('/api/check-password', async (req, res) => {
    try {
        const db = await readDB();
        const storedPwd = db.config.password || 'admin';
        if (req.body.password === storedPwd) {
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid password' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to check password' });
    }
});

// POST /api/upload
app.post('/api/upload', authenticate, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image provided' });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
});

// PUT /api/config
app.put('/api/config', authenticate, async (req, res) => {
    try {
        const db = await readDB();
        db.config = { ...db.config, ...req.body };
        await writeDB(db);
        const conf = { ...db.config };
        delete conf.password;
        res.json(conf);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// GET /api/products
app.get('/api/products', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.products);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read database' });
    }
});

// POST /api/products
app.post('/api/products', authenticate, async (req, res) => {
    try {
        const db = await readDB();
        const newProduct = req.body;
        
        // Generate a random ID if not provided
        if (!newProduct.id) {
            newProduct.id = 'p' + Date.now().toString();
        }
        
        db.products.push(newProduct);
        await writeDB(db);
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// PUT /api/products/:id
app.put('/api/products/:id', authenticate, async (req, res) => {
    try {
        const db = await readDB();
        const index = db.products.findIndex(p => p.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        db.products[index] = { ...db.products[index], ...req.body };
        await writeDB(db);
        res.json(db.products[index]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// DELETE /api/products/:id
app.delete('/api/products/:id', authenticate, async (req, res) => {
    try {
        const db = await readDB();
        db.products = db.products.filter(p => p.id !== req.params.id);
        await writeDB(db);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

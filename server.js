const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON data
app.use(bodyParser.json());

// CORS Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Data file paths
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const MENU_FILE = path.join(__dirname, 'menu.json');

// Helper function to read/write orders (Correct Logic)
function readOrders() {
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const data = fs.readFileSync(ORDERS_FILE, 'utf8');
            return JSON.parse(data);
        } else {
            return { orders: [], counter: 1 };
        }
    } catch (e) {
        return { orders: [], counter: 1 };
    }
}

function writeOrders(data) {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing orders file:', e);
    }
}

// =========================================================
// ✅ CORRECTED API ENDPOINTS
// =========================================================

// 1. Fetch all orders
app.get('/api/orders', (req, res) => {
    const data = readOrders();
    res.json(data.orders || []);
});

// 2. Place new order
app.post('/api/orders', (req, res) => {
    const data = readOrders();
    const newOrder = req.body;
    newOrder.orderNumber = data.counter++;
    newOrder.id = Date.now().toString();
    newOrder.timestamp = Date.now();
    newOrder.confirmed = false;
    data.orders.push(newOrder);
    writeOrders(data);
    res.status(201).json({ message: 'Order placed', id: newOrder.id });
});

// 3. ✅ FIX: Confirm Order Route (Jo aap dashboard me use karte hain)
app.put('/api/orders/:id/confirm', (req, res) => {
    const orderId = req.params.id;
    const data = readOrders();
    const orderIndex = data.orders.findIndex(o => o.id === orderId);

    if (orderIndex !== -1) {
        data.orders[orderIndex].confirmed = true;
        writeOrders(data);
        res.json({ message: 'Order confirmed' });
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
});

// 4. ✅ FIX: Update/Edit Bill Route (Isse 404 error solve hoga)
app.put('/api/orders/:id', (req, res) => {
    const orderId = req.params.id;
    const data = readOrders();
    const orderIndex = data.orders.findIndex(o => o.id === orderId);

    if (orderIndex !== -1) {
        const updatedData = req.body;
        
        // Purana data aur naya data merge karein
        data.orders[orderIndex] = {
            ...data.orders[orderIndex], // Purani details rakhein
            items: updatedData.items,   // Naye items
            total: updatedData.total,   // Naya total
            confirmed: updatedData.confirmed // Status
        };

        writeOrders(data);
        console.log(`✅ Order ID ${orderId} updated successfully.`);
        res.json(data.orders[orderIndex]); // Updated order wapas bhejein
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
});

// 5. Delete order
app.delete('/api/orders/:id', (req, res) => {
    const data = readOrders();
    data.orders = data.orders.filter(o => o.id !== req.params.id);
    writeOrders(data);
    res.json({ message: 'Deleted' });
});

// =========================================================
// 🚀 MENU MANAGEMENT ROUTES (Naya Item Add Karne Ke Liye)
// =========================================================

// Helper function to read/write menu
function readMenu() {
    try {
        if (fs.existsSync(MENU_FILE)) {
            const data = fs.readFileSync(MENU_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (e) { return []; }
}

function writeMenu(data) {
    try {
        fs.writeFileSync(MENU_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) { console.error('Error writing menu file:', e); }
}

// 1. Saare menu items fetch karne ke liye (index.html isse load hoga)
app.get('/api/menu', (req, res) => {
    const menu = readMenu();
    res.json(menu);
});

// 2. Naya item add karne ke liye (Owner Dashboard isse use karega)
app.post('/api/menu', (req, res) => {
    try {
        const menu = readMenu();
        const newItem = req.body;

        // Validation
        if (!newItem.name || !newItem.price || !newItem.category) {
            return res.status(400).json({ message: 'Missing item details' });
        }

        newItem.id = Date.now().toString(); // Unique ID generator
        menu.push(newItem);
        
        writeMenu(menu);
        console.log(`✅ New item added: ${newItem.name}`);
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

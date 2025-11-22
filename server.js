const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000; // API is port 3000 par chalegi

// Middleware for parsing JSON data
app.use(bodyParser.json());

// CORS Middleware to allow frontend to talk to backend
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Sabhi domains ko allow karta hai
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Data file path (Temporary "database")
const DATA_FILE = path.join(__dirname, 'orders.json');

// Helper function to read data
function readOrders() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        // Agar file exist nahi karti ya empty hai
        return { orders: [], counter: 1 };
    }
}

// Helper function to write data
function writeOrders(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// =========================================================
// API ENDPOINTS
// =========================================================

// 1. GET /api/orders (Fetch all orders)
app.get('/api/orders', (req, res) => {
    const data = readOrders();
    res.json(data);
});

// 2. POST /api/orders (Place a new order - index.html se call hoga)
app.post('/api/orders', (req, res) => {
    const data = readOrders();
    const newOrder = req.body;
    
    // Server-side ID aur metadata generate karna
    newOrder.orderNumber = data.counter++; 
    newOrder.id = Date.now().toString(); // Temporary unique ID
    newOrder.timestamp = Date.now();
    
    data.orders.push(newOrder);
    writeOrders(data);
    
    console.log(`New Order #${newOrder.orderNumber} placed by ${newOrder.customerName}`);
    res.status(201).json({ 
        message: 'Order placed successfully', 
        orderNumber: newOrder.orderNumber,
        id: newOrder.id 
    });
});

// 3. PUT /api/orders/:id/confirm (Confirm an order)
app.put('/api/orders/:id/confirm', (req, res) => {
    const orderId = req.params.id;
    const data = readOrders();
    const orderIndex = data.orders.findIndex(o => o.id === orderId);

    if (orderIndex !== -1) {
        data.orders[orderIndex].confirmed = true;
        data.orders[orderIndex].confirmedAt = new Date().toLocaleString();
        writeOrders(data);
        
        console.log(`Order ID ${orderId} confirmed.`);
        res.json({ message: 'Order confirmed successfully' });
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
});

// 4. DELETE /api/orders/:id (Delete an order)
app.delete('/api/orders/:id', (req, res) => {
    const orderId = req.params.id;
    const data = readOrders();
    const initialLength = data.orders.length;
    
    data.orders = data.orders.filter(o => o.id !== orderId);
    
    if (data.orders.length < initialLength) {
        writeOrders(data);
        console.log(`Order ID ${orderId} deleted.`);
        res.json({ message: 'Order deleted successfully' });
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('API Endpoints are ready!');
});
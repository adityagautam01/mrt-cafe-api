const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================
// 🌐 MONGODB CONNECTION
// =========================================================
// YAHAN APNA PASSWORD BADLEIN: <db_password> ki jagah apna asli password likhein
const mongoURI = "mongodb+srv://aditya_admin:Akumar6586@cluster0.wotddhe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; 
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';

const razorpay = razorpayKeyId && razorpayKeySecret
    ? new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret
      })
    : null;

mongoose.connect(mongoURI)
  .then(() => console.log("✅ MongoDB Connected: Data ab hamesha ke liye Cloud me save rahega"))
  .catch(err => console.error("❌ Connection Error:", err));

// =========================================================
// 📋 DATABASE SCHEMAS (Database Structure)
// =========================================================

// Menu Items ke liye
const menuSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    emoji: String,
    id: String
});
const MenuItem = mongoose.model('MenuItem', menuSchema);

// Orders ke liye
const orderSchema = new mongoose.Schema({
    orderNumber: Number,
    customerName: String,
    tableNumber: String,
    contactNumber: String,
    items: Array,
    total: Number,
    type: String,
    paymentMethod: String,
    paymentStatus: String,
    confirmed: { type: Boolean, default: false },
    date: String,
    time: String,
    timestamp: { type: Number, default: Date.now },
    id: String
});
const Order = mongoose.model('Order', orderSchema);

// Order Counter (Order Number badhane ke liye)
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);

async function createCafeOrder(orderData) {
    const counter = await Counter.findOneAndUpdate(
        { _id: 'orderId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const newOrder = new Order({
        ...orderData,
        orderNumber: counter.seq,
        id: Date.now().toString(),
        timestamp: Date.now()
    });

    await newOrder.save();

    return newOrder;
}

// Middleware
app.use(bodyParser.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// =========================================================
// 🚀 API ENDPOINTS (Menu & Orders)
// =========================================================

// --- MENU ROUTES ---

// 1. Saare menu items fetch karna (index.html ke liye)
app.get('/api/menu', async (req, res) => {
    try {
        const menu = await MenuItem.find();
        res.json(menu);
    } catch (err) { res.status(500).json({ message: 'Error fetching menu' }); }
});

// 2. Naya item add karna (Dashboard ke liye)
app.post('/api/menu', async (req, res) => {
    try {
        const newItem = new MenuItem({
            ...req.body,
            id: Date.now().toString()
        });
        await newItem.save();
        console.log(`✅ Item saved: ${newItem.name}`);
        res.status(201).json(newItem);
    } catch (err) { res.status(500).json({ message: 'Error saving item' }); }
});

// --- ORDER ROUTES ---

// 3. Saare orders fetch karna
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ timestamp: -1 });
        res.json(orders);
    } catch (err) { res.status(500).json({ message: 'Error fetching orders' }); }
});

// 4. Naya order place karna
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = await createCafeOrder(req.body);
        res.status(201).json({ message: 'Order placed', id: newOrder.id, orderNumber: newOrder.orderNumber });
    } catch (err) { res.status(500).json({ message: 'Error placing order' }); }
});

app.post('/api/payments/razorpay/order', async (req, res) => {
    try {
        if (!razorpay) {
            return res.status(500).json({ message: 'Razorpay is not configured on the server.' });
        }

        const amount = Number(req.body.amount);
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount for Razorpay order.' });
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `mrt_${Date.now()}`,
            notes: {
                customerName: String(req.body.customerName || 'MR.T Cafe Customer').slice(0, 255),
                orderType: String(req.body.type || 'Dine-In').slice(0, 255)
            }
        });

        res.json({
            keyId: razorpayKeyId,
            order: razorpayOrder
        });
    } catch (err) {
        console.error('Razorpay order creation error:', err);
        res.status(500).json({ message: 'Unable to create Razorpay order.' });
    }
});

app.post('/api/payments/razorpay/verify', async (req, res) => {
    try {
        if (!razorpay) {
            return res.status(500).json({ message: 'Razorpay is not configured on the server.' });
        }

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderData
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderData) {
            return res.status(400).json({ message: 'Missing Razorpay verification data.' });
        }

        const expectedSignature = crypto
            .createHmac('sha256', razorpayKeySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: 'Payment signature verification failed.' });
        }

        const savedOrder = await createCafeOrder({
            ...orderData,
            paymentMethod: 'Online',
            paymentStatus: 'Paid via Razorpay',
            confirmed: true,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id
        });

        res.status(201).json({
            message: 'Payment verified and order placed.',
            id: savedOrder.id,
            orderNumber: savedOrder.orderNumber
        });
    } catch (err) {
        console.error('Razorpay verification error:', err);
        res.status(500).json({ message: 'Unable to verify Razorpay payment.' });
    }
});

// 5. Order confirm karna
app.put('/api/orders/:id/confirm', async (req, res) => {
    try {
        const updated = await Order.findOneAndUpdate(
            { id: req.params.id },
            { confirmed: true },
            { new: true }
        );
        res.json({ message: 'Order confirmed', order: updated });
    } catch (err) { res.status(500).json({ message: 'Error confirming order' }); }
});

// 6. Order/Bill edit karna
app.put('/api/orders/:id', async (req, res) => {
    try {
        const updated = await Order.findOneAndUpdate(
            { id: req.params.id },
            {
                items: req.body.items,
                total: req.body.total,
                confirmed: req.body.confirmed,
                paymentMethod: req.body.paymentMethod,
                paymentStatus: req.body.paymentStatus
            },
            { new: true }
        );
        res.json(updated);
    } catch (err) { res.status(500).json({ message: 'Error updating order' }); }
});

// 7. Order delete karna
app.delete('/api/orders/:id', async (req, res) => {
    try {
        await Order.deleteOne({ id: req.params.id });
        res.json({ message: 'Deleted successfully' });
    } catch (err) { res.status(500).json({ message: 'Error deleting order' }); }
});

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'Connected to MongoDB' }));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

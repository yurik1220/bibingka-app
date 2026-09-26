require('dotenv').config();
const express = require('express');
const cors = require('cors');

const dashboardRoutes = require('./routes/dashboard');
const ordersRoutes = require('./routes/orders');
const productsRoutes = require('./routes/products');
const paymentsRoutes = require('./routes/payments');
const productionRoutes = require('./routes/production');
const reportsRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const publicRoutes = require('./routes/public');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/public', publicRoutes);

// Catch anything unhandled
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Basic error handler as a safety net
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Bibingka backend running on http://localhost:${PORT}`);
});
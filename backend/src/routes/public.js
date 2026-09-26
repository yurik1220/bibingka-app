const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const {
  buildOrderItems,
  syncProductionForDate,
  checkAndReserveCapacity,
} = require('../controllers/ordersController');
const { uploadBuffer } = require('../utils/cloudinary');
const { sendPushNotification } = require('../utils/pushNotifications');

const router = express.Router();

// Files are held in memory only long enough to stream to Cloudinary, never
// written to disk on the server. 5MB cap is generous for a phone screenshot.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Threshold for the "limited" availability state shown to customers.
// Adjust freely — this is not a hard business rule, just a display cutoff.
const LIMITED_THRESHOLD_PIECES = 30;

// GET /api/public/products — no auth, read-only menu for the ordering site.
// Only returns available products; price/pieces_per_bundle come straight
// from the DB so the frontend never has to be trusted for pricing math.
router.get('/products', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, price, pieces_per_bundle, image_url
     FROM products
     WHERE is_available = true
     ORDER BY name ASC`
  );
  res.json(rows);
});

// GET /api/public/availability?date=2026-12-24
// Returns capacity/reserved/remaining/status for one date. The frontend
// uses this to show Available/Limited/Sold Out/Closed, but this is
// DISPLAY ONLY — POST /orders re-checks capacity itself, atomically, as
// the actual authority.
router.get('/availability', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date query param is required' });
  }

  const prodRes = await pool.query(
    'SELECT daily_capacity, is_closed FROM production WHERE date = $1',
    [date]
  );

  if (prodRes.rows.length === 0 || prodRes.rows[0].daily_capacity == null) {
    return res.json({ date, capacity: null, reserved: 0, remaining: 0, status: 'closed' });
  }

  const { daily_capacity: capacity, is_closed: isClosed } = prodRes.rows[0];

  if (isClosed) {
    return res.json({ date, capacity: Number(capacity), reserved: null, remaining: 0, status: 'closed' });
  }

  const reservedRes = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity * COALESCE(p.pieces_per_bundle, 1)), 0) AS reserved
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.pickup_date = $1 AND o.status != 'cancelled'`,
    [date]
  );

  const reserved = Number(reservedRes.rows[0].reserved);
  const remaining = Number(capacity) - reserved;

  let status;
  if (remaining <= 0) status = 'sold_out';
  else if (remaining <= LIMITED_THRESHOLD_PIECES) status = 'limited';
  else status = 'available';

  res.json({ date, capacity: Number(capacity), reserved, remaining, status });
});

// POST /api/public/upload-payment-screenshot
// multipart/form-data, field name "screenshot". Returns { url }.
// Called by the frontend BEFORE order submission (upload first, then send
// the returned URL as part of the order payload) so the order-creation
// transaction itself never has to hold a file upload open.
router.post('/upload-payment-screenshot', upload.single('screenshot'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'screenshot file is required' });
  }

  try {
    const url = await uploadBuffer(req.file.buffer);
    res.json({ url });
  } catch (err) {
    console.error('Cloudinary upload failed:', err);
    res.status(500).json({ error: 'Failed to upload screenshot' });
  }
});

// Generates "BNA-YYYYMMDD-NNN" within the same locked transaction as the
// capacity check, so two concurrent orders for the same date can never
// collide on the same sequence number (the production row's FOR UPDATE
// lock, taken just before this in the calling code, serializes access).
async function generateOrderNumber(client, pickupDate) {
  const datePart = pickupDate.replace(/-/g, '');
  const { rows } = await client.query(
    `SELECT COUNT(*) AS count FROM orders WHERE pickup_date = $1`,
    [pickupDate]
  );
  const sequence = Number(rows[0].count) + 1;
  const sequencePadded = String(sequence).padStart(3, '0');
  return `BNA-${datePart}-${sequencePadded}`;
}

// POST /api/public/orders — the actual guest checkout endpoint.
// NEVER trusts client-provided price, total, piece count, or availability.
// Everything is recalculated server-side from the database.
router.post('/orders', async (req, res) => {
  const {
    customer, // { name, phone, email }
    pickup,   // { date, time }
    items,    // [{ productId, quantity }]
    notes,
    paymentMethod,
    paymentScreenshotUrl,
  } = req.body;

  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: 'Customer name and phone are required' });
  }
  if (!pickup?.date || !pickup?.time) {
    return res.status(400).json({ error: 'Pickup date and time are required' });
  }
  if (!items?.length) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  // Normalize the public payload's { productId, quantity } shape to what
  // buildOrderItems expects ({ product_id, quantity }) — kept as a tiny
  // adapter here rather than changing buildOrderItems's existing contract,
  // since the Form-import path already depends on the original shape.
  const normalizedItems = items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
  }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let orderItems, total, totalPieces;
    try {
      ({ orderItems, total, totalPieces } = await buildOrderItems(client, normalizedItems));
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid item in order: ${err.message}` });
    }

    // Atomic capacity check + implicit reservation. Locks the production
    // row for this date until COMMIT/ROLLBACK, so a second concurrent
    // request for the same date queues behind this one and sees accurate
    // "reserved" numbers once it proceeds.
    const capacityResult = await checkAndReserveCapacity(client, pickup.date, totalPieces);
    if (!capacityResult.ok) {
      await client.query('ROLLBACK');
      if (capacityResult.reason === 'closed') {
        return res.status(409).json({
          error: 'This date is not available for pickup. Please choose another date.',
          reason: 'closed',
        });
      }
      return res.status(409).json({
        error: 'Sorry, this date no longer has enough capacity for your order. Please reduce your order or choose another pickup date.',
        reason: 'exceeds_capacity',
        remaining: capacityResult.remaining,
      });
    }

    const orderNumber = await generateOrderNumber(client, pickup.date);

    const orderRes = await client.query(
      `INSERT INTO orders
         (customer_name, customer_phone, pickup_date, pickup_time,
          fulfillment_type, status, customer_note, order_number, total_amount)
       VALUES ($1, $2, $3, $4, 'pickup', 'pending_payment', $5, $6, $7)
       RETURNING *`,
      [
        customer.name, customer.phone, pickup.date, pickup.time,
        notes ?? null, orderNumber, total,
      ]
    );
    const order = orderRes.rows[0];

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.product_id, item.quantity, item.unit_price, item.subtotal]
      );
    }

    await client.query(
      `INSERT INTO payments (order_id, method, status, screenshot_url)
       VALUES ($1, $2, 'pending', $3)`,
      [order.id, paymentMethod || 'gcash', paymentScreenshotUrl ?? null]
    );

    await syncProductionForDate(client, pickup.date);

    await client.query('COMMIT');

    await sendPushNotification(
      'New order received!',
      `${customer.name} ordered ${totalPieces} bibingka pieces - PHP ${total}`,
      { orderId: order.id }
    );

    res.status(201).json({
      order_number: order.order_number,
      order_id: order.id,
      pickup_date: order.pickup_date,
      pickup_time: order.pickup_time,
      total_amount: order.total_amount,
      payment_status: 'pending',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Public order creation failed:', err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

module.exports = router;
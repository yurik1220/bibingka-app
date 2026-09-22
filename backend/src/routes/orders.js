const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireFormImportSecret } = require('../middleware/auth');
const {
  buildOrderItems,
  syncProductionForDate,
} = require('../controllers/ordersController');
const { sendPushNotification } = require('../utils/pushNotifications');

const router = express.Router();

// GET /api/orders?status=pending_payment&date=2026-12-24
router.get('/', requireAuth, async (req, res) => {
  const { status, date } = req.query;
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (date) {
    values.push(date);
    conditions.push(`pickup_date = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM orders ${where} ORDER BY created_at DESC`,
    values
  );
  res.json(rows);
});

// GET /api/orders/:id  (with items + payment)
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (orderRes.rows.length === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const itemsRes = await pool.query(
    `SELECT oi.*, p.name AS product_name
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [id]
  );

  const paymentRes = await pool.query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
    [id]
  );

  res.json({
    ...orderRes.rows[0],
    items: itemsRes.rows,
    payment: paymentRes.rows[0] || null,
  });
});

// PATCH /api/orders/:id/status  { status: 'preparing' }
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const valid = [
    'pending_payment', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled',
  ];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const { rows } = await pool.query(
    `UPDATE orders SET status = $1, updated_at = now()
     WHERE id = $2 RETURNING *`,
    [status, id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }

  await syncProductionForDate(pool, rows[0].pickup_date);
  res.json(rows[0]);
});

// POST /api/orders/import  — called by Google Apps Script on form submit.
// Protected by a separate shared secret (never the app token) since this
// is the one endpoint reachable from outside your own app.
router.post('/import', requireFormImportSecret, async (req, res) => {
  const {
    google_form_response_id,
    customer_name,
    customer_phone,
    pickup_date,
    pickup_time,
    fulfillment_type, // 'pickup' | 'delivery'
    delivery_address, // only present when fulfillment_type === 'delivery'
    customer_note,
    items, // [{ product_id, quantity }]
    payment_method,
    payment_screenshot_url,
    raw_import,
  } = req.body;

  const validFulfillment = ['pickup', 'delivery'];
  const fulfillmentType = validFulfillment.includes(fulfillment_type)
    ? fulfillment_type
    : 'pickup';

  if (!google_form_response_id || !customer_name || !items?.length) {
    return res.status(400).json({
      error: 'google_form_response_id, customer_name, and items are required',
    });
  }

  const client = await pool.connect();
  try {
    // Dedup: if this form response was already imported, return it as-is
    // instead of creating a duplicate order.
    const existing = await client.query(
      'SELECT * FROM orders WHERE google_form_response_id = $1',
      [google_form_response_id]
    );
    if (existing.rows.length > 0) {
      return res.status(200).json({ ...existing.rows[0], deduped: true });
    }

    await client.query('BEGIN');

    let orderItems, total;
    try {
      ({ orderItems, total } = await buildOrderItems(client, items));
    } catch (err) {
      // Unknown product from the form — don't drop the order, flag it
      // instead so Ate/you can fix it manually.
      const inserted = await client.query(
        `INSERT INTO orders
           (customer_name, customer_phone, pickup_date, pickup_time,
            fulfillment_type, delivery_address,
            status, customer_note, google_form_response_id, raw_import, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6, 'needs_review', $7, $8, $9, 0)
         RETURNING *`,
        [
          customer_name, customer_phone, pickup_date, pickup_time,
          fulfillmentType, delivery_address ?? null,
          customer_note, google_form_response_id,
          JSON.stringify(raw_import ?? req.body),
        ]
      );
      await client.query('COMMIT');

      await sendPushNotification(
        'Order needs review',
        `${customer_name}'s order couldn't be matched to a product — check it manually.`,
        { orderId: inserted.rows[0].id }
      );

      return res.status(201).json({ ...inserted.rows[0], warning: err.message });
    }

    const orderRes = await client.query(
      `INSERT INTO orders
         (customer_name, customer_phone, pickup_date, pickup_time,
          fulfillment_type, delivery_address,
          status, customer_note, google_form_response_id, raw_import, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_payment', $7, $8, $9, $10)
       RETURNING *`,
      [
        customer_name, customer_phone, pickup_date, pickup_time,
        fulfillmentType, delivery_address ?? null,
        customer_note, google_form_response_id,
        JSON.stringify(raw_import ?? req.body), total,
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

    if (payment_method) {
      await client.query(
        `INSERT INTO payments (order_id, method, status, screenshot_url)
         VALUES ($1, $2, 'pending', $3)`,
        [order.id, payment_method, payment_screenshot_url ?? null]
      );
    }

    await syncProductionForDate(client, pickup_date);

    await client.query('COMMIT');

    await sendPushNotification(
      'New order received!',
      `${customer_name} ordered ${orderItems.reduce((sum, i) => sum + i.quantity, 0)} bibingka - PHP ${total}`,
      { orderId: order.id }
    );

    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Order import failed:', err);
    res.status(500).json({ error: 'Failed to import order' });
  } finally {
    client.release();
  }
});

module.exports = router;
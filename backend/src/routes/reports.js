const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/reports/sales?from=2026-12-01&to=2026-12-24
// Sales are always computed from orders/order_items — never stored, so
// they can't drift out of sync with the source data.
router.get('/sales', async (req, res) => {
  const { from, to } = req.query;

  const summary = await pool.query(
    `SELECT
       COUNT(DISTINCT o.id) AS total_orders,
       COALESCE(SUM(oi.quantity), 0) AS total_bibingka_sold,
       COALESCE(SUM(oi.subtotal), 0) AS gross_sales
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status != 'cancelled'
       AND o.pickup_date BETWEEN $1 AND $2`,
    [from, to]
  );

  const byProduct = await pool.query(
    `SELECT p.name, SUM(oi.quantity) AS quantity, SUM(oi.subtotal) AS total_sales
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.status != 'cancelled'
       AND o.pickup_date BETWEEN $1 AND $2
     GROUP BY p.name
     ORDER BY total_sales DESC`,
    [from, to]
  );

  const byDay = await pool.query(
    `SELECT o.pickup_date AS date, SUM(oi.subtotal) AS total_sales
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status != 'cancelled'
       AND o.pickup_date BETWEEN $1 AND $2
     GROUP BY o.pickup_date
     ORDER BY o.pickup_date`,
    [from, to]
  );

  res.json({
    ...summary.rows[0],
    by_product: byProduct.rows,
    by_day: byDay.rows,
  });
});

// GET /api/reports/best-sellers?from=...&to=...
router.get('/best-sellers', async (req, res) => {
  const { from, to } = req.query;

  const { rows } = await pool.query(
    `SELECT p.name, SUM(oi.quantity) AS total_sold
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.status != 'cancelled'
       AND o.pickup_date BETWEEN $1 AND $2
     GROUP BY p.name
     ORDER BY total_sold DESC
     LIMIT 10`,
    [from, to]
  );
  res.json(rows);
});

// GET /api/reports/pickup-times?from=...&to=...
router.get('/pickup-times', async (req, res) => {
  const { from, to } = req.query;

  const { rows } = await pool.query(
    `SELECT pickup_time, COUNT(*) AS order_count
     FROM orders
     WHERE status != 'cancelled'
       AND pickup_date BETWEEN $1 AND $2
     GROUP BY pickup_time
     ORDER BY order_count DESC`,
    [from, to]
  );
  res.json(rows);
});

module.exports = router;

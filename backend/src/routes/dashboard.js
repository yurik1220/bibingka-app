const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard?date=2026-12-24  (defaults to today)
// One call that feeds the whole Dashboard screen, so the app doesn't need
// to make 4-5 separate requests just to render the home screen.
router.get('/', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const ordersToday = await pool.query(
    `SELECT COUNT(*) AS total_orders,
            COALESCE(SUM(total_amount), 0) AS todays_sales
     FROM orders
     WHERE pickup_date = $1 AND status != 'cancelled'`,
    [date]
  );

  const bibingkaToPrepare = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity), 0) AS total
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.pickup_date = $1 AND o.status != 'cancelled'`,
    [date]
  );

  const pendingPayments = await pool.query(
    `SELECT COUNT(*) AS total
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE o.pickup_date = $1 AND p.status = 'pending'`,
    [date]
  );

  const statusBreakdown = await pool.query(
    `SELECT status, COUNT(*) AS count
     FROM orders
     WHERE pickup_date = $1
     GROUP BY status`,
    [date]
  );

  res.json({
    date,
    total_orders: Number(ordersToday.rows[0].total_orders),
    todays_sales: Number(ordersToday.rows[0].todays_sales),
    bibingka_to_prepare: Number(bibingkaToPrepare.rows[0].total),
    pending_payments: Number(pendingPayments.rows[0].total),
    status_breakdown: statusBreakdown.rows,
  });
});

module.exports = router;

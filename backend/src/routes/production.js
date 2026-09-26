const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/production/:date  (YYYY-MM-DD) — full breakdown for that day
router.get('/:date', async (req, res) => {
  const { date } = req.params;

  const prodRes = await pool.query(
    'SELECT * FROM production WHERE date = $1',
    [date]
  );

  if (prodRes.rows.length === 0) {
    return res.json({ date, daily_capacity: null, is_closed: false, items: [] });
  }

  const production = prodRes.rows[0];
  const itemsRes = await pool.query(
    `SELECT pi.*, p.name AS product_name
     FROM production_items pi
     JOIN products p ON p.id = pi.product_id
     WHERE pi.production_id = $1
     ORDER BY p.name`,
    [production.id]
  );

  res.json({ ...production, items: itemsRes.rows });
});

// PATCH /api/production/:date/capacity  { daily_capacity: 100, is_closed: false }
router.patch('/:date/capacity', async (req, res) => {
  const { date } = req.params;
  const { daily_capacity, is_closed } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO production (date, daily_capacity, is_closed)
     VALUES ($1, $2, COALESCE($3, false))
     ON CONFLICT (date) DO UPDATE SET
       daily_capacity = COALESCE($2, production.daily_capacity),
       is_closed = COALESCE($3, production.is_closed)
     RETURNING *`,
    [date, daily_capacity, is_closed]
  );
  res.json(rows[0]);
});

// PATCH /api/production/items/:id  { produced_qty: 45 }
// Auto-derives status: complete once produced_qty >= ordered_qty.
router.patch('/items/:id', async (req, res) => {
  const { id } = req.params;
  const { produced_qty } = req.body;

  const { rows } = await pool.query(
    `UPDATE production_items
     SET produced_qty = $1,
         status = CASE
           WHEN $1 >= ordered_qty THEN 'complete'
           WHEN $1 > 0 THEN 'in_progress'
           ELSE 'pending'
         END
     WHERE id = $2
     RETURNING *`,
    [produced_qty, id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Production item not found' });
  }
  res.json(rows[0]);
});

module.exports = router;
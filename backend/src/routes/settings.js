const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Settings is a single-row table (there's only ever one business).
// GET /api/settings
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM settings LIMIT 1');

  if (rows.length === 0) {
    // Auto-create the one settings row on first access.
    const inserted = await pool.query(
      'INSERT INTO settings (business_name) VALUES ($1) RETURNING *',
      ['Bibingka ni Ate']
    );
    return res.json(inserted.rows[0]);
  }
  res.json(rows[0]);
});

// PATCH /api/settings
router.patch('/', async (req, res) => {
  const {
    business_name, google_form_url, pickup_times,
    payment_methods_enabled, notifications_enabled, push_token,
  } = req.body;

  const existing = await pool.query('SELECT id FROM settings LIMIT 1');
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Settings not initialized yet — GET /api/settings first' });
  }

  const { rows } = await pool.query(
    `UPDATE settings SET
       business_name = COALESCE($1, business_name),
       google_form_url = COALESCE($2, google_form_url),
       pickup_times = COALESCE($3, pickup_times),
       payment_methods_enabled = COALESCE($4, payment_methods_enabled),
       notifications_enabled = COALESCE($5, notifications_enabled),
       push_token = COALESCE($6, push_token)
     WHERE id = $7
     RETURNING *`,
    [
      business_name, google_form_url,
      pickup_times ? JSON.stringify(pickup_times) : null,
      payment_methods_enabled ? JSON.stringify(payment_methods_enabled) : null,
      notifications_enabled, push_token, existing.rows[0].id,
    ]
  );
  res.json(rows[0]);
});

module.exports = router;
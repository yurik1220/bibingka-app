const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// PATCH /api/payments/:id  { status: 'verified' | 'rejected' | 'refunded' }
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const valid = ['pending', 'verified', 'rejected', 'refunded'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const verifiedAt = status === 'verified' ? new Date() : null;

  const { rows } = await pool.query(
    `UPDATE payments SET status = $1, verified_at = $2 WHERE id = $3 RETURNING *`,
    [status, verifiedAt, id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  // Verifying payment auto-confirms the order — matches the doc's flow
  // (Pending Payment -> Confirmed once payment is verified).
  if (status === 'verified') {
    await pool.query(
      `UPDATE orders SET status = 'confirmed', updated_at = now()
       WHERE id = $1 AND status = 'pending_payment'`,
      [rows[0].order_id]
    );
  }

  res.json(rows[0]);
});

module.exports = router;

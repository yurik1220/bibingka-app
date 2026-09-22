const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/products
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM products ORDER BY name ASC'
  );
  res.json(rows);
});

// POST /api/products
router.post('/', async (req, res) => {
  const { name, price, daily_limit, image_url } = req.body;

  if (!name || price == null) {
    return res.status(400).json({ error: 'name and price are required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO products (name, price, daily_limit, image_url)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, price, daily_limit ?? null, image_url ?? null]
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/products/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, daily_limit, is_available, image_url } = req.body;

  const { rows } = await pool.query(
    `UPDATE products SET
       name = COALESCE($1, name),
       price = COALESCE($2, price),
       daily_limit = COALESCE($3, daily_limit),
       is_available = COALESCE($4, is_available),
       image_url = COALESCE($5, image_url),
       updated_at = now()
     WHERE id = $6
     RETURNING *`,
    [name, price, daily_limit, is_available, image_url, id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(rows[0]);
});

module.exports = router;

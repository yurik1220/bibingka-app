const pool = require('../db/pool');

// Shared logic: given items [{product_id, quantity}], look up current prices
// and build order_items rows + total. Keeping this here (not in the route)
// so both the manual-create endpoint and the Google Form import endpoint
// use the exact same pricing/validation logic.
async function buildOrderItems(client, items) {
  const orderItems = [];
  let total = 0;

  for (const item of items) {
    const { rows } = await client.query(
      'SELECT id, price FROM products WHERE id = $1',
      [item.product_id]
    );

    if (rows.length === 0) {
      throw new Error(`Unknown product_id: ${item.product_id}`);
    }

    const unitPrice = Number(rows[0].price);
    const subtotal = unitPrice * item.quantity;
    total += subtotal;

    orderItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal,
    });
  }

  return { orderItems, total };
}

// After an order is created/updated, roll its items into that day's
// production totals so the Production screen stays in sync automatically.
async function syncProductionForDate(client, pickupDate) {
  if (!pickupDate) return;

  let { rows: prodRows } = await client.query(
    'SELECT id FROM production WHERE date = $1',
    [pickupDate]
  );

  let productionId;
  if (prodRows.length === 0) {
    const inserted = await client.query(
      'INSERT INTO production (date) VALUES ($1) RETURNING id',
      [pickupDate]
    );
    productionId = inserted.rows[0].id;
  } else {
    productionId = prodRows[0].id;
  }

  // Recompute ordered_qty per product for this date from scratch —
  // simplest way to stay correct even after cancellations/edits.
  const { rows: totals } = await client.query(
    `SELECT oi.product_id, SUM(oi.quantity) AS qty
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.pickup_date = $1 AND o.status != 'cancelled'
     GROUP BY oi.product_id`,
    [pickupDate]
  );

  for (const row of totals) {
    await client.query(
      `INSERT INTO production_items (production_id, product_id, ordered_qty)
       VALUES ($1, $2, $3)
       ON CONFLICT (production_id, product_id)
       DO UPDATE SET ordered_qty = $3`,
      [productionId, row.product_id, row.qty]
    );
  }
}

module.exports = { buildOrderItems, syncProductionForDate };

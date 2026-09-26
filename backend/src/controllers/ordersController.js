const pool = require('../db/pool');

// Shared logic: given items [{product_id, quantity}], look up current prices
// and build order_items rows + total. Keeping this here (not in the route)
// so both the manual-create endpoint and the Google Form import endpoint
// use the exact same pricing/validation logic.
async function buildOrderItems(client, items) {
  const orderItems = [];
  let total = 0;
  let totalPieces = 0;

  for (const item of items) {
    const { rows } = await client.query(
      'SELECT id, price, pieces_per_bundle FROM products WHERE id = $1',
      [item.product_id]
    );

    if (rows.length === 0) {
      throw new Error(`Unknown product_id: ${item.product_id}`);
    }

    const unitPrice = Number(rows[0].price);
    const piecesPerBundle = Number(rows[0].pieces_per_bundle) || 1;
    const subtotal = unitPrice * item.quantity;
    total += subtotal;
    totalPieces += item.quantity * piecesPerBundle;

    orderItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal,
    });
  }

  return { orderItems, total, totalPieces };
}

// After an order is created/updated, roll its items into that day's
// production totals so the Production screen stays in sync automatically.
//
// IMPORTANT: order_items.quantity is a count of BUNDLES (e.g. "2" means
// 2 orders of a "4pcs" product), not actual pieces. production_items must
// store actual PIECE counts, since that's what Ate needs to know how much
// to bake. So this multiplies by products.pieces_per_bundle when rolling
// up — never store raw bundle quantity here.
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

  // Recompute ordered_qty (in PIECES, not bundles) per product for this
  // date from scratch — simplest way to stay correct even after
  // cancellations/edits. COALESCE pieces_per_bundle to 1 as a safety net
  // in case any product is missing a value.
  const { rows: totals } = await client.query(
    `SELECT oi.product_id, SUM(oi.quantity * COALESCE(p.pieces_per_bundle, 1)) AS qty
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
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

// Atomically checks and reserves daily piece capacity for a pickup date,
// for use by the (upcoming) public ordering site's order-creation endpoint.
//
// Must be called inside an existing transaction (client should already be
// mid-BEGIN), BEFORE inserting the new order — so the whole reservation
// check + order insert commits or rolls back together.
//
// Concurrency: SELECT ... FOR UPDATE locks the production row for this
// date for the duration of the transaction. A second concurrent request
// for the same date blocks here until the first transaction commits or
// rolls back, so two near-simultaneous orders can never both slip in
// under a nearly-full quota — the second one sees the first's reservation
// already reflected once the lock releases.
//
// A date with NO production row yet (Ate never set a capacity for it) is
// treated as CLOSED, not unlimited — customers can't order for a date
// Ate hasn't explicitly opened.
//
// Returns { ok: true, remaining } on success (capacity was available and
// is now implicitly reserved, since the caller inserts order_items in the
// same transaction right after this call — production_items itself isn't
// updated here, syncProductionForDate still owns that after the order
// commits).
// Returns { ok: false, reason, remaining } on failure — caller should
// ROLLBACK and surface `reason` to the customer.
async function checkAndReserveCapacity(client, pickupDate, requestedPieces) {
  const { rows } = await client.query(
    `SELECT daily_capacity FROM production WHERE date = $1 FOR UPDATE`,
    [pickupDate]
  );

  if (rows.length === 0 || rows[0].daily_capacity == null) {
    return { ok: false, reason: 'closed', remaining: 0 };
  }

  const capacity = Number(rows[0].daily_capacity);

  // Reserved = pieces already committed for this date, from non-cancelled
  // orders. Computed fresh here (not read from production_items, which is
  // a denormalized cache updated by syncProductionForDate after the fact)
  // so this check is always based on live order_items data, consistent
  // with whatever the row lock above is actually protecting.
  const { rows: reservedRows } = await client.query(
    `SELECT COALESCE(SUM(oi.quantity * COALESCE(p.pieces_per_bundle, 1)), 0) AS reserved
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.pickup_date = $1 AND o.status != 'cancelled'`,
    [pickupDate]
  );
  const reserved = Number(reservedRows[0].reserved);
  const remaining = capacity - reserved;

  if (requestedPieces > remaining) {
    return { ok: false, reason: 'exceeds_capacity', remaining };
  }

  return { ok: true, remaining: remaining - requestedPieces };
}

module.exports = { buildOrderItems, syncProductionForDate, checkAndReserveCapacity };
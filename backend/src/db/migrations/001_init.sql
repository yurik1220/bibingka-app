-- 001_init.sql
-- Core schema for the Bibingka ni Ate app

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  price        NUMERIC(10, 2) NOT NULL,
  daily_limit  INTEGER,
  is_available BOOLEAN NOT NULL DEFAULT true,
  image_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id                      SERIAL PRIMARY KEY,
  customer_name           TEXT NOT NULL,
  customer_phone          TEXT,
  pickup_date             DATE,
  pickup_time             TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending_payment'
                            CHECK (status IN (
                              'pending_payment', 'confirmed', 'preparing',
                              'ready', 'completed', 'cancelled', 'needs_review'
                            )),
  customer_note           TEXT,
  -- fulfillment_type and delivery_address are added by migration 002_add_delivery.sql
  google_form_response_id TEXT UNIQUE, -- prevents duplicate imports
  raw_import              JSONB,       -- full raw form payload, debug fallback
  total_amount            NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal   NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method         TEXT NOT NULL CHECK (method IN ('gcash', 'maya', 'cash', 'other')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'verified', 'rejected', 'refunded')),
  screenshot_url TEXT,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production (
  id             SERIAL PRIMARY KEY,
  date           DATE NOT NULL UNIQUE,
  daily_capacity INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_items (
  id            SERIAL PRIMARY KEY,
  production_id INTEGER NOT NULL REFERENCES production(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  ordered_qty   INTEGER NOT NULL DEFAULT 0,
  produced_qty  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'complete')),
  UNIQUE (production_id, product_id)
);

CREATE TABLE IF NOT EXISTS settings (
  id                       SERIAL PRIMARY KEY,
  business_name            TEXT,
  google_form_url          TEXT,
  pickup_times             JSONB DEFAULT '[]',
  payment_methods_enabled  JSONB DEFAULT '["gcash", "maya", "cash"]',
  notifications_enabled    BOOLEAN NOT NULL DEFAULT true
);

-- Helpful indexes for the common queries the app will run
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON orders(pickup_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_production_items_production_id ON production_items(production_id);

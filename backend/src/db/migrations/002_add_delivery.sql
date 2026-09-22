-- 002_add_delivery.sql
-- Adds pickup-vs-delivery support to orders, per Lalamove/Grab delivery option.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'pickup'
    CHECK (fulfillment_type IN ('pickup', 'delivery')),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- pickup_time/pickup_date columns are kept as-is and used for both pickup
-- and delivery scheduling, to avoid touching every existing reference.

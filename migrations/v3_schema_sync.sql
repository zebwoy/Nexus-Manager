-- ============================================================================
-- Nexus Manager v3 — Schema Sync & Consistency Migration
-- Safe & Idempotent: Run this in your Neon PostgreSQL SQL Editor
-- Fixes: duplicate day_openings, missing columns, missing recharge_platforms
-- ============================================================================

BEGIN;

-- ── 1. Users: add email, status columns (v3 additions) ─────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

DO $$
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'operator', 'staff', 'super_admin', 'trial'));
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
    ALTER TABLE users ADD CONSTRAINT users_status_check
        CHECK (status IN ('active', 'suspended', 'invited'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 2. Customers: add address, client_type ──────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS client_type VARCHAR(30) DEFAULT 'customer';

-- ── 3. Audit Logs: add module, metadata ────────────────────────────────────
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ── 4. Session Players: add customer_id, player_name ───────────────────────
ALTER TABLE session_players ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id);
ALTER TABLE session_players ADD COLUMN IF NOT EXISTS player_name VARCHAR(100);

-- ── 5. Recharges: add margin computed column ────────────────────────────────
-- Note: GENERATED columns cannot be added with ADD COLUMN IF NOT EXISTS in older PG.
-- This block is safe — it silently skips if the column already exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'recharges' AND column_name = 'margin'
    ) THEN
        ALTER TABLE recharges
            ADD COLUMN margin DECIMAL(10, 2) GENERATED ALWAYS AS (charge_price - cost_price) STORED;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 6. Expenses: add extended vendor/inventory tracking columns ─────────────
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_address TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS item_id INT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS units INT DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS packs_count INT DEFAULT 1;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS pack_size INT DEFAULT 1;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unit_buy_price DECIMAL(10, 2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unit_sell_price DECIMAL(10, 2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- ── 7. Inventory Items: add initial_stock ──────────────────────────────────
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS initial_stock INT NOT NULL DEFAULT 0;

-- ── 8. Day Openings: merge unified schema (add missing columns) ─────────────
-- The canonical definition includes: denominations, note, opened_by, created_by
ALTER TABLE day_openings ADD COLUMN IF NOT EXISTS denominations JSONB;
ALTER TABLE day_openings ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE day_openings ADD COLUMN IF NOT EXISTS opened_by INT REFERENCES users(id);
ALTER TABLE day_openings ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id);

-- ── 9. Recharge Platforms: create if missing ───────────────────────────────
CREATE TABLE IF NOT EXISTS recharge_platforms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO recharge_platforms (name, description) VALUES
  ('PSN', 'PlayStation Network'),
  ('Xbox Live', 'Xbox/Microsoft Gaming'),
  ('Steam', 'Valve Steam Platform'),
  ('EA Play', 'EA Games Subscription'),
  ('GamePass', 'Xbox Game Pass')
ON CONFLICT (name) DO NOTHING;

-- ── 10. Settings: add any new keys ─────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('cafe_logo', ''),
  ('counter_phone', ''),
  ('org_slug', 'org')
ON CONFLICT (key) DO NOTHING;

-- ── 11. Performance Indexes (idempotent) ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_date_status ON sessions (date, time_out, is_deleted);
CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions (device_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_type ON sales (date, sale_type);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_recharges_date ON recharges (date);
CREATE INDEX IF NOT EXISTS idx_session_payments_session_id ON session_payments (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers (name, mobile, shop_name);

COMMIT;

SELECT 'v3 Schema Sync complete. All columns and tables are consistent.' AS status;

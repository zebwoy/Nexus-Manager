-- ============================================================================
-- Nexus Manager v2 Migration Script
-- Safe & Idempotent: Run this in your Neon PostgreSQL SQL Editor
-- ============================================================================

-- 1. Create Shift Closings Table (EOD Persisted Ledger)
CREATE TABLE IF NOT EXISTS shift_closings (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    opening_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cash_inflows DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    online_inflows DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cash_expenses DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    expected_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    actual_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    variance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    denominations JSONB,
    note TEXT,
    closed_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Ensure Required Columns & Constraints Exist
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(200);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id);

-- 3. Update Category & Payment Method Constraints (Safe Drop & Re-add)
DO $$
BEGIN
    ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
    ALTER TABLE expenses ADD CONSTRAINT expenses_category_check CHECK (category IN ('Marketing', 'Employee', 'Inventory', 'Cafeteria', 'Other'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_payment_method_check;
    ALTER TABLE sessions ADD CONSTRAINT sessions_payment_method_check CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
    ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Create Recharge Platforms Table if not already present
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

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_date_status ON sessions (date, time_out, is_deleted);
CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions (device_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_type ON sales (date, sale_type);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_recharges_date ON recharges (date);
CREATE INDEX IF NOT EXISTS idx_session_payments_session_id ON session_payments (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers (name, mobile, shop_name);

-- 6. Default Platform Accounts
INSERT INTO users (full_name, username, pin, role) VALUES
  ('Super Administrator', 'superadmin', '9999', 'super_admin'),
  ('Store Administrator', 'admin', '1234', 'admin')
ON CONFLICT (username) DO UPDATE SET pin = EXCLUDED.pin, role = EXCLUDED.role;

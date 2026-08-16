-- Nexus Manager Database Schema
-- Run this once in Neon PostgreSQL to set up the schema.

-- Users / Staff Accounts
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    pin CHAR(4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Device Stations (PCs, PlayStations, Xboxes)
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    label VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('PC', 'XBOX', 'PS')),
    is_active BOOLEAN DEFAULT TRUE
);

-- Session Pricing Rules
CREATE TABLE IF NOT EXISTS pricing (
    id SERIAL PRIMARY KEY,
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('PC', 'XBOX', 'PS')),
    duration_mins INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    UNIQUE (device_type, duration_mins)
);

-- System Configurations (Fees, Limits, Settings)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(255) NOT NULL
);

-- Customers Database
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Gaming Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    device_id INT NOT NULL REFERENCES devices(id),
    duration_mins INT NOT NULL,
    time_in TIMESTAMP WITH TIME ZONE NOT NULL,
    time_out TIMESTAMP WITH TIME ZONE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    controller_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    extra_person_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_received DECIMAL(10, 2),
    credit DECIMAL(10, 2),
    remark TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session Players & Controller/Add-on Logging
CREATE TABLE IF NOT EXISTS session_players (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    player_number INT NOT NULL,
    own_controller BOOLEAN DEFAULT FALSE,
    controller_fee DECIMAL(10, 2) DEFAULT 0.00,
    extra_person_fee DECIMAL(10, 2) DEFAULT 0.00
);

-- PanCafe Sessions (Third-party platform log)
CREATE TABLE IF NOT EXISTS pancafe_sessions (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    pancafe_username VARCHAR(100) NOT NULL,
    device_id INT REFERENCES devices(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_in TIMESTAMP WITH TIME ZONE,
    time_out TIMESTAMP WITH TIME ZONE,
    amount_received DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    amount_spent DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    margin DECIMAL(10, 2) GENERATED ALWAYS AS (amount_received - amount_spent) STORED,
    remark TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- In-game Recharges / Credits
CREATE TABLE IF NOT EXISTS recharges (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    game_platform VARCHAR(100),
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    charge_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    margin DECIMAL(10, 2) GENERATED ALWAYS AS (charge_price - cost_price) STORED,
    payment_received DECIMAL(10, 2),
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Marketing', 'Employee', 'Inventory', 'Other')),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shop Inventory
CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Drinks', 'Snacks', 'Other')),
    buy_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    sell_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock_qty INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Inventory Sales (Invoices)
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES sessions(id) ON DELETE SET NULL,
    customer_id INT REFERENCES customers(id),
    sale_type VARCHAR(20) NOT NULL CHECK (sale_type IN ('walkin', 'session')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_received DECIMAL(10, 2),
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Items inside each Sale
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES inventory_items(id),
    qty INT NOT NULL CHECK (qty > 0),
    unit_price DECIMAL(10, 2) NOT NULL
);


-- ─── SEED DATA ────────────────────────────────────────────────────────

-- Initial Default System Settings
INSERT INTO settings (key, value) VALUES
('controller_fee', '25'),
('extra_person_fee', '15'),
('extra_person_from', '3')
ON CONFLICT (key) DO NOTHING;

-- Initial Setup of Devices
INSERT INTO devices (label, type) VALUES
('PC Station 1', 'PC'),
('PC Station 2', 'PC'),
('PC Station 3', 'PC'),
('Xbox One A', 'XBOX'),
('Xbox One B', 'XBOX'),
('PS5 Console X', 'PS'),
('PS5 Console Y', 'PS')
ON CONFLICT DO NOTHING;

-- Default Users (Trial Admin: trial / PIN: 1234)
INSERT INTO users (full_name, username, pin) VALUES
('Trial Administrator', 'trial', '1234')
ON CONFLICT (username) DO NOTHING;

-- Default Pricing Rules (30m, 60m, 120m, 240m, etc.)
INSERT INTO pricing (device_type, duration_mins, price) VALUES
('PC', 30, 20.00),
('PC', 60, 40.00),
('PC', 90, 60.00),
('PC', 120, 80.00),
('PC', 150, 100.00),
('PC', 180, 120.00),
('PC', 240, 160.00),
('PC', 300, 200.00),
('PC', 360, 240.00),
('PC', 420, 280.00),
('PC', 480, 320.00),
('XBOX', 30, 30.00),
('XBOX', 60, 50.00),
('XBOX', 90, 75.00),
('XBOX', 120, 100.00),
('XBOX', 150, 125.00),
('XBOX', 180, 150.00),
('XBOX', 240, 200.00),
('XBOX', 300, 250.00),
('XBOX', 360, 300.00),
('XBOX', 420, 350.00),
('XBOX', 480, 400.00),
('PS', 30, 40.00),
('PS', 60, 70.00),
('PS', 90, 100.00),
('PS', 120, 130.00),
('PS', 150, 160.00),
('PS', 180, 190.00),
('PS', 240, 250.00),
('PS', 300, 310.00),
('PS', 360, 370.00),
('PS', 420, 430.00),
('PS', 480, 490.00)
ON CONFLICT DO NOTHING;


-- ─── DATABASE VIEWS ───────────────────────────────────────────────────

-- View to compute dashboard snapshot values dynamically
CREATE OR REPLACE VIEW today_snapshot AS
SELECT
  (SELECT COALESCE(SUM(total), 0.00) FROM sessions WHERE date = CURRENT_DATE) AS gaming_revenue,
  (SELECT COALESCE(SUM(total), 0.00) FROM sales WHERE sale_type = 'walkin' AND date = CURRENT_DATE) AS walkin_revenue,
  (SELECT COALESCE(SUM(total), 0.00) FROM sales WHERE sale_type = 'session' AND date = CURRENT_DATE) AS session_sales_revenue,
  (SELECT COALESCE(SUM(charge_price), 0.00) FROM recharges WHERE date = CURRENT_DATE) AS rc_revenue,
  (SELECT COALESCE(SUM(amount_received), 0.00) FROM pancafe_sessions WHERE date = CURRENT_DATE) AS pancafe_revenue,
  (SELECT COALESCE(SUM(credit), 0.00) FROM sessions WHERE credit > 0) AS total_outstanding_credit,
  -- Cash vs Online inflow breakdown for EOD reconciliation (using session_payments)
  (SELECT COALESCE(SUM(amount), 0.00) FROM session_payments WHERE payment_method = 'cash' AND created_at::date = CURRENT_DATE) AS cash_gaming,
  (SELECT COALESCE(SUM(amount), 0.00) FROM session_payments WHERE payment_method = 'online' AND created_at::date = CURRENT_DATE) AS online_gaming,
  (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN payment_received ELSE 0 END), 0.00)
   FROM sales WHERE sale_type = 'walkin' AND date = CURRENT_DATE) AS cash_sales,
  (SELECT COALESCE(SUM(CASE WHEN payment_method = 'online' THEN payment_received ELSE 0 END), 0.00)
   FROM sales WHERE sale_type = 'walkin' AND date = CURRENT_DATE) AS online_sales,
  (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount_received ELSE 0 END), 0.00)
   FROM pancafe_sessions WHERE date = CURRENT_DATE) AS cash_pancafe,
  (SELECT COALESCE(SUM(CASE WHEN payment_method = 'online' THEN amount_received ELSE 0 END), 0.00)
   FROM pancafe_sessions WHERE date = CURRENT_DATE) AS online_pancafe,
  (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0.00)
   FROM expenses WHERE date = CURRENT_DATE) AS cash_expenses,
  -- Active session count
  (SELECT COUNT(*) FROM sessions WHERE date = CURRENT_DATE AND time_out > NOW()) AS active_sessions,
  (SELECT COUNT(*) FROM pancafe_sessions WHERE date = CURRENT_DATE AND time_out IS NULL) AS active_pancafe;


-- ─── PHASE 2 MIGRATIONS ────────────────────────────────────────────────
-- Run these once against your Neon DB if upgrading from Phase 1.

-- 1. User roles
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'operator'
  CHECK (role IN ('admin', 'operator'));
UPDATE users SET role = 'admin' WHERE username = 'trial';

-- 2. Customer enhancements
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shop_name VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pancafe_username VARCHAR(100);

-- 3. Payment method on all transaction tables
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'
  CHECK (payment_method IN ('cash', 'online', 'credit'));
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'
  CHECK (payment_method IN ('cash', 'online', 'mixed', 'credit'));
ALTER TABLE pancafe_sessions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'
  CHECK (payment_method IN ('cash', 'online', 'credit'));
ALTER TABLE recharges ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'
  CHECK (payment_method IN ('cash', 'online'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'
  CHECK (payment_method IN ('cash', 'online'));

-- 4. PanCafe membership plans
CREATE TABLE IF NOT EXISTS pancafe_plans (
    id SERIAL PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    hours DECIMAL(5,2) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_signup_plan BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE pancafe_sessions ADD COLUMN IF NOT EXISTS plan_id INT REFERENCES pancafe_plans(id);

INSERT INTO pancafe_plans (label, hours, price, is_signup_plan) VALUES
  ('Signup Plan (6H)', 6.0, 500.00, TRUE),
  ('Recharge 7H', 7.0, 420.00, FALSE)
ON CONFLICT DO NOTHING;

-- 5. Session payments log (append-only, cash/online split)
CREATE TABLE IF NOT EXISTS session_payments (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'
      CHECK (payment_method IN ('cash', 'online')),
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Day opening balance (BOD cash reconciliation)
CREATE TABLE IF NOT EXISTS day_openings (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


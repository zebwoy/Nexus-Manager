-- Nexus Manager Database Schema
-- Run this once in Neon PostgreSQL to set up the complete schema and indexes.

-- 1. Users / Staff Accounts
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    pin CHAR(4) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Operator Login/Logout Sessions
CREATE TABLE IF NOT EXISTS operator_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    username VARCHAR(100) NOT NULL,
    login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_at TIMESTAMP WITH TIME ZONE
);

-- 3. Audit Logs (Immutable Security Log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Device Stations (PCs, PlayStations, Xboxes)
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    label VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('PC', 'XBOX', 'PS')),
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. Session Pricing Rules
CREATE TABLE IF NOT EXISTS pricing (
    id SERIAL PRIMARY KEY,
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('PC', 'XBOX', 'PS')),
    duration_mins INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    UNIQUE (device_type, duration_mins)
);

-- 6. System Configurations (Fees, Limits, Settings)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(255) NOT NULL
);

-- 7. Customers Database
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20),
    shop_name VARCHAR(100),
    pancafe_username VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Gaming Sessions
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
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Session Players & Controller/Add-on Logging
CREATE TABLE IF NOT EXISTS session_players (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    player_number INT NOT NULL,
    own_controller BOOLEAN DEFAULT FALSE,
    controller_fee DECIMAL(10, 2) DEFAULT 0.00,
    extra_person_fee DECIMAL(10, 2) DEFAULT 0.00
);

-- 10. Session Payments (Append-only Ledger)
CREATE TABLE IF NOT EXISTS session_payments (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online')),
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. PanCafe Membership Plans
CREATE TABLE IF NOT EXISTS pancafe_plans (
    id SERIAL PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    hours DECIMAL(5, 2) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_signup_plan BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. PanCafe Sessions (Third-party platform log)
CREATE TABLE IF NOT EXISTS pancafe_sessions (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    pancafe_username VARCHAR(100) NOT NULL,
    device_id INT REFERENCES devices(id),
    plan_id INT REFERENCES pancafe_plans(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_in TIMESTAMP WITH TIME ZONE,
    time_out TIMESTAMP WITH TIME ZONE,
    amount_received DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    amount_spent DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    margin DECIMAL(10, 2) GENERATED ALWAYS AS (amount_received - amount_spent) STORED,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online', 'credit')),
    remark TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Recharge Platforms Master
CREATE TABLE IF NOT EXISTS recharge_platforms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. In-game Recharges / Digital Top-ups
CREATE TABLE IF NOT EXISTS recharges (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    game_platform VARCHAR(100),
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    charge_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    margin DECIMAL(10, 2) GENERATED ALWAYS AS (charge_price - cost_price) STORED,
    payment_received DECIMAL(10, 2),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online')),
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Daily Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Marketing', 'Employee', 'Inventory', 'Cafeteria', 'Other')),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    vendor_name VARCHAR(200),
    note TEXT,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed')),
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Shop / Cafeteria Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Drinks', 'Snacks', 'Other')),
    buy_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    sell_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock_qty INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT REFERENCES users(id)
);

-- 17. Inventory Sales (Invoices)
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES sessions(id) ON DELETE SET NULL,
    customer_id INT REFERENCES customers(id),
    sale_type VARCHAR(20) NOT NULL CHECK (sale_type IN ('walkin', 'session')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_received DECIMAL(10, 2),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed')),
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Items inside each Sale
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES inventory_items(id),
    qty INT NOT NULL CHECK (qty > 0),
    unit_price DECIMAL(10, 2) NOT NULL
);

-- 19. Day Opening Cash (BOD Balance)
CREATE TABLE IF NOT EXISTS day_openings (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    opening_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. Persisted Shift / EOD Closings
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


-- ─── DATABASE PERFORMANCE INDEXES ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_date_status ON sessions (date, time_out, is_deleted);
CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions (device_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_type ON sales (date, sale_type);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_recharges_date ON recharges (date);
CREATE INDEX IF NOT EXISTS idx_session_payments_session_id ON session_payments (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers (name, mobile, shop_name);


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
INSERT INTO users (full_name, username, pin, role) VALUES
('Trial Administrator', 'trial', '1234', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Default Pricing Rules
INSERT INTO pricing (device_type, duration_mins, price) VALUES
('PC', 30, 20.00), ('PC', 60, 40.00), ('PC', 90, 60.00), ('PC', 120, 80.00),
('PC', 150, 100.00), ('PC', 180, 120.00), ('PC', 240, 160.00), ('PC', 300, 200.00),
('PC', 360, 240.00), ('PC', 420, 280.00), ('PC', 480, 320.00),
('XBOX', 30, 30.00), ('XBOX', 60, 50.00), ('XBOX', 90, 75.00), ('XBOX', 120, 100.00),
('XBOX', 150, 125.00), ('XBOX', 180, 150.00), ('XBOX', 240, 200.00), ('XBOX', 300, 250.00),
('XBOX', 360, 300.00), ('XBOX', 420, 350.00), ('XBOX', 480, 400.00),
('PS', 30, 40.00), ('PS', 60, 70.00), ('PS', 90, 100.00), ('PS', 120, 130.00),
('PS', 150, 160.00), ('PS', 180, 190.00), ('PS', 240, 250.00), ('PS', 300, 310.00),
('PS', 360, 370.00), ('PS', 420, 430.00), ('PS', 480, 490.00)
ON CONFLICT DO NOTHING;

-- Default PanCafe Plans
INSERT INTO pancafe_plans (label, hours, price, is_signup_plan) VALUES
('Signup Plan (6H)', 6.0, 500.00, TRUE),
('Recharge 7H', 7.0, 420.00, FALSE)
ON CONFLICT DO NOTHING;

-- Default Recharge Platforms
INSERT INTO recharge_platforms (name, description) VALUES
('PSN', 'PlayStation Network'),
('Xbox Live', 'Xbox/Microsoft Gaming'),
('Steam', 'Valve Steam Platform'),
('EA Play', 'EA Games Subscription'),
('GamePass', 'Xbox Game Pass')
ON CONFLICT (name) DO NOTHING;

-- Nexus Manager Database Schema — PUBLIC schema
-- Canonical source of truth. Reflects ACTUAL production state.
-- Run once on a fresh Neon DB. For existing DBs, use the migrations/ scripts.
--
-- NOTE on types: The public schema uses text/integer (not varchar/decimal) for
-- historical reasons — this is the production reality and intentional.
-- Tenant schemas use varchar/decimal(10,2) for precision — both work correctly.

-- ─── GLOBAL PLATFORM TABLES ───────────────────────────────────────────────────

-- G1. Registered Tenants (Gaming Cafe Organisations)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    schema_name VARCHAR(100) NOT NULL UNIQUE,
    admin_email VARCHAR(255) NOT NULL,
    admin_name VARCHAR(200),
    admin_clerk_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    plan VARCHAR(50) NOT NULL DEFAULT 'pro',
    max_devices INT NOT NULL DEFAULT 20,
    phone VARCHAR(50),
    logo_url TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- G2. Organisation Staff Invitation Registry
CREATE TABLE IF NOT EXISTS organization_staff (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100),
    schema_name VARCHAR(100) NOT NULL,
    staff_email VARCHAR(255) NOT NULL,
    staff_name VARCHAR(100),
    pin CHAR(4) DEFAULT '1234',
    role VARCHAR(20) DEFAULT 'operator',
    avatar_url TEXT,
    status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended', 'pending_approval', 'declined')),
    invited_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (schema_name, staff_email)
);

-- G3. Super Admin Audit Log
CREATE TABLE IF NOT EXISTS super_admin_audit_logs (
    id SERIAL PRIMARY KEY,
    super_admin_id VARCHAR(255),
    super_admin_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_org_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- G4. Tenant Profile Change Requests (Pending Approval Workflow)
CREATE TABLE IF NOT EXISTS tenant_profile_changes (
    id SERIAL PRIMARY KEY,
    schema_name VARCHAR(100) NOT NULL REFERENCES tenants(schema_name) ON DELETE CASCADE,
    field VARCHAR(50) NOT NULL CHECK (field IN ('cafe_name', 'counter_phone', 'cafe_logo')),
    old_value TEXT,
    new_value TEXT NOT NULL,
    logo_filename VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reject_reason TEXT
);

-- ─── PER-TENANT SHARED / GLOBAL LOOKUP TABLES ─────────────────────────────────

-- 1. Users / Staff Accounts (public schema — global/legacy)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    pin CHAR(4) NOT NULL CHECK (pin ~ '^\d{4}$'),
    role VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('admin', 'operator', 'staff', 'super_admin', 'trial')),
    email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited')),
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

-- 3. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT,
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50),
    details TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Device Stations
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PC', 'XBOX', 'PS')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Session Pricing Rules
CREATE TABLE IF NOT EXISTS pricing (
    id SERIAL PRIMARY KEY,
    device_type TEXT NOT NULL CHECK (device_type IN ('PC', 'XBOX', 'PS')),
    duration_mins INT NOT NULL,
    price INT NOT NULL,
    UNIQUE (device_type, duration_mins)
);

-- 6. System Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 7. Customers & Vendor Registry
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT,
    shop_name VARCHAR(100),
    pancafe_username VARCHAR(100),
    address TEXT,
    client_type VARCHAR(30) DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Gaming Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    device_id INT NOT NULL REFERENCES devices(id),
    duration_mins INT NOT NULL,
    time_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    time_out TIMESTAMP WITH TIME ZONE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    charge INT NOT NULL DEFAULT 0,
    controller_total INT NOT NULL DEFAULT 0,
    extra_person_total INT NOT NULL DEFAULT 0,
    total INT NOT NULL DEFAULT 0,
    payment_received INT,
    credit INT,
    remark TEXT,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Session Players & Controller Logging
CREATE TABLE IF NOT EXISTS session_players (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    player_number INT NOT NULL,
    customer_id INT REFERENCES customers(id),
    player_name VARCHAR(100),
    own_controller BOOLEAN DEFAULT FALSE,
    controller_fee INT DEFAULT 0,
    extra_person_fee INT DEFAULT 0
);

-- 10. Session Payments Ledger
CREATE TABLE IF NOT EXISTS session_payments (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash',
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
    pancafe_username TEXT NOT NULL,
    device_id INT REFERENCES devices(id),
    plan_id INT REFERENCES pancafe_plans(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_in TIMESTAMP WITH TIME ZONE,
    time_out TIMESTAMP WITH TIME ZONE,
    amount_received INT NOT NULL DEFAULT 0,
    amount_spent INT NOT NULL DEFAULT 0,
    margin INT GENERATED ALWAYS AS (amount_received - amount_spent) STORED,
    payment_method VARCHAR(20) DEFAULT 'cash',
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
    game_platform TEXT,
    cost_price INT NOT NULL DEFAULT 0,
    charge_price INT NOT NULL DEFAULT 0,
    margin INT GENERATED ALWAYS AS (charge_price - cost_price) STORED,
    payment_received INT,
    payment_method VARCHAR(20) DEFAULT 'cash',
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Daily Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL CHECK (category IN ('Marketing', 'Employee', 'Inventory', 'Cafeteria', 'Other')),
    amount INT NOT NULL,
    vendor_name VARCHAR(200),
    vendor_address TEXT,
    note TEXT,
    item_id INT,
    units INT DEFAULT 0,
    packs_count INT DEFAULT 1,
    pack_size INT DEFAULT 1,
    unit_buy_price DECIMAL(10, 2),
    unit_sell_price DECIMAL(10, 2),
    receipt_url TEXT,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed')),
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Shop / Cafeteria Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Drinks', 'Snacks', 'Other')),
    buy_price INT NOT NULL DEFAULT 0,
    sell_price INT NOT NULL DEFAULT 0,
    initial_stock INT NOT NULL DEFAULT 0,
    stock_qty INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. Inventory Sales (Invoices)
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES sessions(id),
    customer_id INT REFERENCES customers(id),
    sale_type TEXT NOT NULL DEFAULT 'walkin' CHECK (sale_type IN ('walkin', 'session')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total INT NOT NULL DEFAULT 0,
    payment_received INT,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Items inside each Sale
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES inventory_items(id),
    qty INT NOT NULL DEFAULT 1,
    unit_price INT NOT NULL
);

-- 19. Day Opening Cash (BOD Balance)
CREATE TABLE IF NOT EXISTS day_openings (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    opening_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    denominations JSONB,
    note TEXT,
    opened_by INT REFERENCES users(id),
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


-- ─── VIEWS ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW daily_revenue AS
    SELECT
        date,
        COALESCE(SUM(total), 0) AS gaming_revenue,
        COALESCE(SUM(credit), 0) AS total_credit
    FROM sessions
    GROUP BY date;


-- ─── PERFORMANCE INDEXES ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_date_status ON sessions (date, time_out, is_deleted);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions (date);
CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions (device_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_type ON sales (date, sale_type);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (date);
CREATE INDEX IF NOT EXISTS idx_sales_type ON sales (sale_type);
CREATE INDEX IF NOT EXISTS idx_sales_session_id ON sales (session_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);
CREATE INDEX IF NOT EXISTS idx_recharges_date ON recharges (date);
CREATE INDEX IF NOT EXISTS idx_session_payments_session_id ON session_payments (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers (name, mobile, shop_name);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers (mobile);
CREATE INDEX IF NOT EXISTS idx_pancafe_date ON pancafe_sessions (date);
CREATE INDEX IF NOT EXISTS idx_pancafe_customer_id ON pancafe_sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_session_players_session ON session_players (session_id);


-- ─── SEED DATA ────────────────────────────────────────────────────────────────

INSERT INTO settings (key, value) VALUES
('controller_fee', '25'),
('extra_person_fee', '15'),
('extra_person_from', '3'),
('cafe_name', 'Gaming Lounge'),
('cafe_logo', ''),
('counter_phone', ''),
('org_slug', 'org')
ON CONFLICT (key) DO NOTHING;

INSERT INTO recharge_platforms (name, description) VALUES
('PSN', 'PlayStation Network'),
('Xbox Live', 'Xbox/Microsoft Gaming'),
('Steam', 'Valve Steam Platform'),
('EA Play', 'EA Games Subscription'),
('GamePass', 'Xbox Game Pass')
ON CONFLICT (name) DO NOTHING;

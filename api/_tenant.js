import { getPool } from './_db.js'

export const DEMO_SANDBOX_SCHEMA = 'tenant_demo_sandbox'

/**
 * SQL DDL template executed inside every new tenant schema
 */
export const TENANT_SCHEMA_TEMPLATE = `
-- 1. Users / Staff Accounts
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    pin CHAR(4) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'operator', 'super_admin', 'trial')),
    email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Operator Sessions (Counter check-in/out)
CREATE TABLE IF NOT EXISTS operator_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    username VARCHAR(100) NOT NULL,
    login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_at TIMESTAMP WITH TIME ZONE
);

-- 3. Granular Module Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50),
    details TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Devices (PC Stations, PS5, Xbox)
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

-- 6. System Settings
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(255) NOT NULL
);

-- 7. Customers & Vendor Registry
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20),
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

-- 9. Session Players
CREATE TABLE IF NOT EXISTS session_players (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    player_number INT NOT NULL,
    own_controller BOOLEAN DEFAULT FALSE,
    controller_fee DECIMAL(10, 2) DEFAULT 0.00,
    extra_person_fee DECIMAL(10, 2) DEFAULT 0.00
);

-- 10. Session Payments Ledger
CREATE TABLE IF NOT EXISTS session_payments (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online')),
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. PanCafe Plans
CREATE TABLE IF NOT EXISTS pancafe_plans (
    id SERIAL PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    hours DECIMAL(5, 2) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_signup_plan BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. PanCafe Sessions
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

-- 13. Recharges (In-Game / Mobile RC)
CREATE TABLE IF NOT EXISTS recharges (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    game_platform VARCHAR(100),
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    charge_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_received DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online')),
    note TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Day Openings (EOD Cash Drawer Opening)
CREATE TABLE IF NOT EXISTS day_openings (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    opening_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    denominations JSONB,
    opened_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Marketing', 'Employee', 'Inventory', 'Cafeteria', 'Other')),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
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
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed')),
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Drinks', 'Snacks', 'Other')),
    buy_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    sell_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    initial_stock INT NOT NULL DEFAULT 0,
    stock_qty INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT REFERENCES users(id)
);

-- 17. Sales
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

-- 18. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES inventory_items(id),
    qty INT NOT NULL CHECK (qty > 0),
    unit_price DECIMAL(10, 2) NOT NULL
);

-- 19. Day Openings (BOD)
CREATE TABLE IF NOT EXISTS day_openings (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    opening_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    note TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. Shift Closings (EOD)
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_date_status ON sessions (date, time_out, is_deleted);
CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions (device_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_type ON sales (date, sale_type);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_recharges_date ON recharges (date);
CREATE INDEX IF NOT EXISTS idx_session_payments_session_id ON session_payments (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers (name, mobile, shop_name);

-- Default Settings (org_slug populated by super admin provisioning)
INSERT INTO settings (key, value) VALUES
('controller_fee', '25'),
('extra_person_fee', '15'),
('extra_person_from', '3'),
('cafe_name', 'Gaming Lounge'),
('org_slug', 'org'),
('counter_phone', ''),
('cafe_logo', '')
ON CONFLICT (key) DO NOTHING;

-- Default Devices
INSERT INTO devices (label, type) VALUES
('PC Station 1', 'PC'),
('PC Station 2', 'PC'),
('PC Station 3', 'PC'),
('Xbox One A', 'XBOX'),
('PS5 Console X', 'PS')
ON CONFLICT DO NOTHING;

-- Default Pricing Rules
INSERT INTO pricing (device_type, duration_mins, price) VALUES
('PC', 30, 20.00), ('PC', 60, 40.00), ('PC', 90, 60.00), ('PC', 120, 80.00),
('PC', 150, 100.00), ('PC', 180, 120.00), ('PC', 240, 160.00), ('PC', 300, 200.00),
('XBOX', 30, 30.00), ('XBOX', 60, 50.00), ('XBOX', 90, 75.00), ('XBOX', 120, 100.00),
('XBOX', 150, 125.00), ('XBOX', 180, 150.00), ('XBOX', 240, 200.00), ('XBOX', 300, 250.00),
('PS', 30, 40.00), ('PS', 60, 70.00), ('PS', 90, 100.00), ('PS', 120, 130.00),
('PS', 150, 160.00), ('PS', 180, 190.00), ('PS', 240, 250.00), ('PS', 300, 310.00)
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
`

/**
 * Initialize public global registry tables
 */
export async function ensureGlobalRegistry(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tenants (
        id SERIAL PRIMARY KEY,
        org_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        schema_name VARCHAR(100) UNIQUE NOT NULL,
        admin_email VARCHAR(255) NOT NULL,
        admin_name VARCHAR(200),
        admin_clerk_id VARCHAR(255),
        phone VARCHAR(50),
        logo_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
        plan VARCHAR(50) NOT NULL DEFAULT 'pro',
        max_devices INT NOT NULL DEFAULT 20,
        created_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

    CREATE TABLE IF NOT EXISTS public.organization_staff (
        id SERIAL PRIMARY KEY,
        org_id VARCHAR(100),
        schema_name VARCHAR(100) NOT NULL,
        staff_email VARCHAR(255) NOT NULL,
        staff_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'operator',
        avatar_url TEXT,
        pin CHAR(4) DEFAULT '1234',
        status VARCHAR(30) DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended', 'pending_approval', 'declined')),
        invited_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (schema_name, staff_email)
    );

    ALTER TABLE public.organization_staff ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'operator';
    ALTER TABLE public.organization_staff ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE public.organization_staff DROP CONSTRAINT IF EXISTS organization_staff_status_check;
    ALTER TABLE public.organization_staff ADD CONSTRAINT organization_staff_status_check CHECK (status IN ('invited', 'active', 'suspended', 'pending_approval', 'declined'));

    CREATE TABLE IF NOT EXISTS public.super_admin_audit_logs (
        id SERIAL PRIMARY KEY,
        super_admin_id VARCHAR(255),
        super_admin_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        target_org_id VARCHAR(100),
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Tenant profile change requests (Option B approval flow)
    CREATE TABLE IF NOT EXISTS public.tenant_profile_changes (
        id SERIAL PRIMARY KEY,
        schema_name VARCHAR(100) NOT NULL REFERENCES public.tenants(schema_name) ON DELETE CASCADE,
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

    ALTER TABLE public.tenant_profile_changes ADD COLUMN IF NOT EXISTS logo_filename VARCHAR(255);
  `)
}

/**
 * Provisions a dedicated PostgreSQL schema for an organization
 */
export async function provisionTenantSchema(pool, schemaName) {
  const safeSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${safeSchema}"`)
    await client.query(`SET search_path TO "${safeSchema}", public`)
    await client.query(TENANT_SCHEMA_TEMPLATE)
    await client.query('COMMIT')
    return { success: true, schemaName: safeSchema }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Provisions and seeds a realistic isolated Demo Sandbox schema
 */
export async function provisionDemoSandbox(pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${DEMO_SANDBOX_SCHEMA}"`)
    await client.query(`SET search_path TO "${DEMO_SANDBOX_SCHEMA}", public`)
    await client.query(TENANT_SCHEMA_TEMPLATE)

    // 1. Seed Demo Staff (PIN 0000)
    await client.query(`
      INSERT INTO users (full_name, username, pin, role) VALUES
      ('Demo Operator', 'trial', '0000', 'admin'),
      ('Store Owner', 'admin', '1234', 'admin'),
      ('Shift Staff', 'operator', '5678', 'operator')
      ON CONFLICT (username) DO NOTHING;
    `)

    // 2. Seed Realistic Cafeteria Snacks
    await client.query(`
      INSERT INTO inventory_items (name, category, buy_price, sell_price, stock_qty) VALUES
      ('Red Bull Energy Drink (250ml)', 'Drinks', 95.00, 125.00, 18),
      ('Monster Energy Ultra White', 'Drinks', 105.00, 140.00, 12),
      ('Mountain Dew (300ml)', 'Drinks', 30.00, 40.00, 20),
      ('Doritos Nacho Cheese (60g)', 'Snacks', 35.00, 50.00, 25),
      ('Lays Classic Salted', 'Snacks', 15.00, 20.00, 30),
      ('KitKat Chunky Bar', 'Snacks', 25.00, 40.00, 15)
      ON CONFLICT DO NOTHING;
    `)

    // 3. Seed Customers
    await client.query(`
      INSERT INTO customers (name, mobile) VALUES
      ('Aarav Sharma', '9876543210'),
      ('Rohan Verma', '9123456780'),
      ('Kabir Mehta', '9988776655')
      ON CONFLICT DO NOTHING;
    `)

    // 4. Seed Active Live Gaming Sessions
    const now = new Date()
    const pc1In = new Date(now.getTime() - 30 * 60000).toISOString()
    const pc1Out = new Date(now.getTime() + 30 * 60000).toISOString()
    const psIn = new Date(now.getTime() - 15 * 60000).toISOString()
    const psOut = new Date(now.getTime() + 75 * 60000).toISOString()

    await client.query(`
      INSERT INTO sessions (customer_id, device_id, duration_mins, time_in, time_out, date, charge, total, payment_received, credit, payment_method)
      SELECT c.id, 1, 60, '${pc1In}', '${pc1Out}', CURRENT_DATE, 40.00, 40.00, 40.00, 0.00, 'cash'
      FROM customers c WHERE c.mobile = '9876543210'
      LIMIT 1;

      INSERT INTO sessions (customer_id, device_id, duration_mins, time_in, time_out, date, charge, controller_total, total, payment_received, credit, payment_method)
      SELECT c.id, 5, 90, '${psIn}', '${psOut}', CURRENT_DATE, 100.00, 25.00, 125.00, 125.00, 0.00, 'online'
      FROM customers c WHERE c.mobile = '9123456780'
      LIMIT 1;
    `)

    await client.query('COMMIT')
    return { success: true, schemaName: DEMO_SANDBOX_SCHEMA }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Resolves the tenant schema from request headers or Clerk organization claims
 */
export async function resolveTenantSchema(req, pool) {
  // 1. Check for Demo / Trial sandbox mode (automatically routed to isolated sandbox schema)
  const isTrial = req.headers['x-username'] === 'trial' ||
                  req.headers['x-user-id'] === 'trial' ||
                  req.headers['x-is-trial'] === 'true'

  if (isTrial) {
    try {
      const checkR = await pool.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1",
        [DEMO_SANDBOX_SCHEMA]
      )
      if (checkR.rows.length === 0) {
        await provisionDemoSandbox(pool)
      }
    } catch (e) {
      console.error('Error auto-provisioning sandbox:', e)
    }
    return DEMO_SANDBOX_SCHEMA
  }

  // 2. Check for Super Admin explicit impersonation / schema selection header
  const explicitSchema = req.headers['x-tenant-schema']
  if (explicitSchema && /^[a-zA-Z0-9_]+$/.test(explicitSchema)) {
    return explicitSchema
  }

  // 3. Check for Clerk Org ID or custom x-org-id header
  const orgId = req.headers['x-org-id'] || req.query?.org_id
  if (orgId) {
    const res = await pool.query(
      'SELECT schema_name, status FROM public.tenants WHERE org_id = $1 OR slug = $1',
      [orgId]
    )
    if (res.rows.length > 0) {
      if (res.rows[0].status === 'suspended') {
        throw new Error('TENANT_SUSPENDED: This organization access is temporarily suspended by platform admin.')
      }
      return res.rows[0].schema_name
    }
  }

  // 4. Check for Admin or Authorized Staff Email resolution
  const userEmail = req.headers['x-user-email']
  if (userEmail) {
    // A. Check if user is Cafe Admin
    const adminRes = await pool.query(
      'SELECT schema_name, status FROM public.tenants WHERE admin_email ILIKE $1 ORDER BY id DESC LIMIT 1',
      [userEmail.trim()]
    )
    if (adminRes.rows.length > 0) {
      if (adminRes.rows[0].status === 'suspended') {
        throw new Error('TENANT_SUSPENDED: This organization access is temporarily suspended by platform admin.')
      }
      return adminRes.rows[0].schema_name
    }

    // B. Check if user is Authorized Staff
    const staffRes = await pool.query(
      `SELECT os.schema_name, os.status as staff_status, t.status as tenant_status
       FROM public.organization_staff os
       JOIN public.tenants t ON os.schema_name = t.schema_name
       WHERE os.staff_email ILIKE $1 AND os.status = 'active'
       ORDER BY os.id DESC LIMIT 1`,
      [userEmail.trim()]
    )
    if (staffRes.rows.length > 0) {
      if (staffRes.rows[0].tenant_status === 'suspended') {
        throw new Error('TENANT_SUSPENDED: This organization access is temporarily suspended.')
      }
      if (staffRes.rows[0].staff_status === 'suspended') {
        throw new Error('STAFF_SUSPENDED: Your staff account has been suspended by the cafe admin.')
      }
      return staffRes.rows[0].schema_name
    }
  }

  // Default fallback for single-tenant local mode
  return 'public'
}

/**
 * Acquires a client connection scoped to the caller's private tenant schema
 */
export async function getTenantClient(pool, req) {
  const schemaName = await resolveTenantSchema(req, pool)
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO "${schemaName}", public`)
    await client.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS item_id INT;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS units INT DEFAULT 0;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS packs_count INT DEFAULT 1;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS pack_size INT DEFAULT 1;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unit_buy_price DECIMAL(10, 2);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unit_sell_price DECIMAL(10, 2);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_address TEXT;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS client_type VARCHAR(30) DEFAULT 'customer';
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS initial_stock INT NOT NULL DEFAULT 0;
      UPDATE inventory_items SET initial_stock = 20 WHERE name ILIKE '%lahori%' AND initial_stock = 0;
      UPDATE inventory_items SET initial_stock = stock_qty WHERE initial_stock = 0;
    `).catch(() => {})
    return { client, schemaName }
  } catch (err) {
    client.release()
    throw err
  }
}

/**
 * Executes a callback with an auto-managed tenant database client
 */
export async function withTenantClient(pool, req, res, callback) {
  let tenantSession
  try {
    tenantSession = await getTenantClient(pool, req)
    return await callback(tenantSession.client, tenantSession.schemaName)
  } catch (e) {
    if (e.message?.startsWith('TENANT_SUSPENDED')) {
      return res.status(403).json({ error: e.message })
    }
    console.error('Tenant DB Error:', e)
    return res.status(500).json({ error: e.message || 'Database error' })
  } finally {
    if (tenantSession?.client) {
      tenantSession.client.release()
    }
  }
}

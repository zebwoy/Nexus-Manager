-- ============================================================================
-- Nexus Manager v4 — Global Tables Migration
-- Adds 4 missing global tables + daily_revenue view to the PUBLIC schema
-- Safe & Idempotent: Run this in your Neon PostgreSQL SQL Editor
-- ============================================================================

BEGIN;

-- ── 1. tenants ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    schema_name VARCHAR(100) NOT NULL UNIQUE,
    admin_email VARCHAR(255) NOT NULL,
    admin_name VARCHAR(200),
    admin_clerk_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'pending')),
    plan VARCHAR(50) NOT NULL DEFAULT 'pro',
    max_devices INT NOT NULL DEFAULT 20,
    phone VARCHAR(50),
    logo_url TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. organization_staff ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_staff (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100),
    schema_name VARCHAR(100) NOT NULL,
    staff_email VARCHAR(255) NOT NULL,
    staff_name VARCHAR(100),
    pin CHAR(4) DEFAULT '1234',
    role VARCHAR(20) DEFAULT 'operator',
    avatar_url TEXT,
    status VARCHAR(20) DEFAULT 'invited'
        CHECK (status IN ('invited', 'active', 'suspended', 'pending_approval', 'declined')),
    invited_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (schema_name, staff_email)
);

-- ── 3. super_admin_audit_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admin_audit_logs (
    id SERIAL PRIMARY KEY,
    super_admin_id VARCHAR(255),
    super_admin_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_org_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── 4. tenant_profile_changes ─────────────────────────────────────────────────
-- Note: references tenants.schema_name; create tenants first
CREATE TABLE IF NOT EXISTS tenant_profile_changes (
    id SERIAL PRIMARY KEY,
    schema_name VARCHAR(100) NOT NULL,
    field VARCHAR(50) NOT NULL
        CHECK (field IN ('cafe_name', 'counter_phone', 'cafe_logo')),
    old_value TEXT,
    new_value TEXT NOT NULL,
    logo_filename VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reject_reason TEXT
);

-- Add FK only if tenants table now exists (safe check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tenant_profile_changes_schema_name_fkey'
    ) THEN
        ALTER TABLE tenant_profile_changes
            ADD CONSTRAINT tenant_profile_changes_schema_name_fkey
            FOREIGN KEY (schema_name) REFERENCES tenants(schema_name) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 5. daily_revenue VIEW ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW daily_revenue AS
    SELECT
        date,
        COALESCE(SUM(total), 0) AS gaming_revenue,
        COALESCE(SUM(credit), 0) AS total_credit
    FROM sessions
    GROUP BY date;

-- ── 6. sales.is_deleted (if missing in public schema) ────────────────────────
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 7. audit_logs: module + metadata (public schema) ─────────────────────────
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMIT;

SELECT 'v4 Global Tables migration complete.' AS status;

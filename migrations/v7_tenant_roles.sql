-- ============================================================
-- v7_tenant_roles.sql
-- Establishes per-tenant roles table (admin, operator).
-- Cleans up obsolete 'staff' & 'super_admin' roles from tenant users.
--
-- Target schema: tenant_hgc (or any tenant schema)
-- ============================================================

SET search_path TO tenant_hgc, public;

BEGIN;

-- 1. Create per-tenant roles table
CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(30)  NOT NULL UNIQUE,
    label       VARCHAR(60)  NOT NULL,
    permissions JSONB        NOT NULL DEFAULT '{}',
    is_system   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. Seed canonical tenant roles
INSERT INTO roles (name, label, permissions, is_system) VALUES
  ('admin',    'Cafe Administrator',
   '{"sessions":true,"customers":true,"inventory":true,"reports":true,"staff":true,"settings":true,"recharges":true}',
   TRUE),
  ('operator', 'Counter Operator',
   '{"sessions":true,"customers":true,"sales":true,"recharges":true}',
   TRUE)
ON CONFLICT (name) DO NOTHING;

-- 3. Clean up legacy 'staff' or 'super_admin' roles from tenant users
UPDATE users SET role = 'operator' WHERE role = 'staff';
DELETE FROM users WHERE role = 'super_admin' OR username = 'superadmin';

-- 4. Enforce clean role check constraint on tenant users
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operator', 'trial'));
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'operator';

-- 5. Standardize user handles to <slug>_<role>@<id> convention
DO $$
DECLARE v_slug TEXT;
BEGIN
  SELECT slug INTO v_slug FROM public.tenants WHERE schema_name = 'tenant_hgc';
  IF v_slug IS NOT NULL THEN
    UPDATE users
    SET username = v_slug || '_' || COALESCE(role, 'operator') || '@' || id
    WHERE username NOT SIMILAR TO '[a-z0-9]+_(admin|operator|trial)@[0-9]+'
      AND username NOT IN ('trial', 'superadmin');
  END IF;
END $$;

COMMIT;

-- Verification
SELECT id, username, role, full_name, email, status FROM users ORDER BY id;
SELECT * FROM roles ORDER BY id;

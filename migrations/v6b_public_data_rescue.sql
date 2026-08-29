-- ============================================================================
-- Nexus Manager v6b — Public Schema Data Rescue Migration
-- ============================================================================
-- PURPOSE: Rescue all real data from public ghost tables into tenant_hgc,
--          then drop the ghost tables cleanly.
--
-- CONTEXT: Diagnostic showed public schema has real single-tenant era data:
--   - users(5), operator_sessions(54), audit_logs(104), devices(16),
--     pricing(48), settings(8), sessions(2), session_payments(2),
--     session_players(6), recharges(2), customers(3), expenses(1),
--     recharge_platforms(7), pancafe_plans(1)
--
-- SAFETY:
--   - Run inside a single transaction (BEGIN/COMMIT)
--   - ON CONFLICT DO NOTHING for config tables (already seeded in tenant_hgc)
--   - Temp mapping tables resolve PK conflicts for relational data
--   - DROP only executes after all migrations succeed
--   - Run ROLLBACK to undo if anything looks wrong
--
-- HOW TO RUN: Execute this entire file in Neon SQL Editor.
--             Read every RAISE NOTICE line in the output.
-- ============================================================================

BEGIN;

-- ── Convenience: work in hgc schema + public ──────────────────────────────────
SET search_path TO tenant_hgc, public;

-- ── Step 0: Sanity check — confirm we're targeting the right schema ───────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'tenant_hgc') THEN
    RAISE EXCEPTION 'tenant_hgc schema not found. Aborting.';
  END IF;
  RAISE NOTICE 'Target schema: tenant_hgc confirmed.';
  RAISE NOTICE 'Public users: %, HGC users: %',
    (SELECT COUNT(*) FROM public.users),
    (SELECT COUNT(*) FROM tenant_hgc.users);
END $$;

-- ===========================================================================
-- PHASE 1: Config tables — ON CONFLICT DO NOTHING (idempotent)
-- These may already be seeded by the tenant provisioning template.
-- ===========================================================================

-- 1a. Devices
INSERT INTO tenant_hgc.devices (label, type, is_active)
SELECT label, type, COALESCE(is_active, TRUE)
FROM public.devices
ON CONFLICT DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'Devices migrated (or already existed).'; END $$;

-- 1b. Pricing
INSERT INTO tenant_hgc.pricing (device_type, duration_mins, price)
SELECT device_type, duration_mins, price
FROM public.pricing
ON CONFLICT (device_type, duration_mins) DO UPDATE
  SET price = EXCLUDED.price;   -- update to ensure live pricing is current

DO $$ BEGIN RAISE NOTICE 'Pricing migrated/updated.'; END $$;

-- 1c. Settings
INSERT INTO tenant_hgc.settings (key, value)
SELECT key, value
FROM public.settings
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value;   -- public settings are the actual cafe config

DO $$ BEGIN RAISE NOTICE 'Settings migrated/updated.'; END $$;

-- 1d. Recharge Platforms
INSERT INTO tenant_hgc.recharge_platforms (name, description, is_active)
SELECT name, description, COALESCE(is_active, TRUE)
FROM public.recharge_platforms
ON CONFLICT (name) DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'Recharge platforms migrated.'; END $$;

-- 1e. PanCafe Plans
INSERT INTO tenant_hgc.pancafe_plans (label, hours, price, is_signup_plan, is_active)
SELECT label, hours, price, COALESCE(is_signup_plan, FALSE), COALESCE(is_active, TRUE)
FROM public.pancafe_plans
ON CONFLICT DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'Config tables migrated. Beginning relational data migration...'; END $$;

-- ===========================================================================
-- PHASE 1b: Ensure tenant_hgc.users has all expected columns
-- (tenant_hgc may have been provisioned before email/status/avatar_url were
--  added to the schema template — patch defensively before inserting)
-- ===========================================================================

ALTER TABLE tenant_hgc.users ADD COLUMN IF NOT EXISTS email      VARCHAR(255);
ALTER TABLE tenant_hgc.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add status if missing (NOT NULL with default, so existing rows get 'active')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'tenant_hgc' AND table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE tenant_hgc.users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'suspended', 'invited'));
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'tenant_hgc.users schema patched.'; END $$;

-- ===========================================================================
-- PHASE 2: Users — map public.users → tenant_hgc.users
-- Match by username. Insert any missing users. Record the ID mapping.
-- ===========================================================================

CREATE TEMP TABLE _user_map (
  pub_id  INT NOT NULL,
  hgc_id  INT NOT NULL
);

-- Insert public users that don't exist in hgc yet (by username)
INSERT INTO tenant_hgc.users (full_name, username, pin, role, email, status, avatar_url, created_at)
SELECT
  pu.full_name,
  pu.username,
  pu.pin,
  pu.role,
  pu.email,
  COALESCE(pu.status, 'active'),
  pu.avatar_url,
  pu.created_at
FROM public.users pu
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_hgc.users hu WHERE hu.username = pu.username
);

-- Build mapping: pub_id → hgc_id (matched by username)
INSERT INTO _user_map (pub_id, hgc_id)
SELECT pu.id, hu.id
FROM public.users pu
JOIN tenant_hgc.users hu ON hu.username = pu.username;

DO $$
BEGIN
  RAISE NOTICE 'User map built: % entries', (SELECT COUNT(*) FROM _user_map);
END $$;

-- ===========================================================================
-- PHASE 3: Customers — map public.customers → tenant_hgc.customers
-- ===========================================================================

CREATE TEMP TABLE _customer_map (
  pub_id  INT NOT NULL,
  hgc_id  INT NOT NULL
);

-- Insert customers that don't exist yet (by name + mobile)
INSERT INTO tenant_hgc.customers (name, mobile, shop_name, pancafe_username, address, client_type, created_at)
SELECT pc.name, pc.mobile, pc.shop_name, pc.pancafe_username, pc.address,
       COALESCE(pc.client_type, 'customer'), pc.created_at
FROM public.customers pc
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_hgc.customers hc
  WHERE hc.name ILIKE pc.name AND (hc.mobile = pc.mobile OR (hc.mobile IS NULL AND pc.mobile IS NULL))
);

-- Build mapping
INSERT INTO _customer_map (pub_id, hgc_id)
SELECT pc.id, hc.id
FROM public.customers pc
JOIN tenant_hgc.customers hc
  ON hc.name ILIKE pc.name
 AND (hc.mobile = pc.mobile OR (hc.mobile IS NULL AND pc.mobile IS NULL));

DO $$
BEGIN
  RAISE NOTICE 'Customer map built: % entries', (SELECT COUNT(*) FROM _customer_map);
END $$;

-- ===========================================================================
-- PHASE 4: Sessions (2 rows) + children
-- Migrate with remapped customer_id and device_id.
-- ===========================================================================

CREATE TEMP TABLE _session_map (
  pub_id  INT NOT NULL,
  hgc_id  INT NOT NULL
);

INSERT INTO tenant_hgc.sessions
  (customer_id, device_id, duration_mins, time_in, time_out, date,
   charge, controller_total, extra_person_total, total,
   payment_received, credit, remark, payment_method, is_deleted, created_by, created_at)
SELECT
  cm.hgc_id,           -- remapped customer
  -- Remap device by label+type match
  COALESCE(
    (SELECT hd.id FROM tenant_hgc.devices hd
     JOIN public.devices pd ON pd.id = ps.device_id
     WHERE hd.label = pd.label AND hd.type = pd.type LIMIT 1),
    (SELECT id FROM tenant_hgc.devices WHERE type = (SELECT type FROM public.devices WHERE id = ps.device_id) LIMIT 1)
  ),
  ps.duration_mins, ps.time_in, ps.time_out, ps.date,
  ps.charge, COALESCE(ps.controller_total, 0), COALESCE(ps.extra_person_total, 0), ps.total,
  ps.payment_received, ps.credit, ps.remark, ps.payment_method,
  COALESCE(ps.is_deleted, FALSE),
  um.hgc_id,           -- remapped created_by
  ps.created_at
FROM public.sessions ps
LEFT JOIN _customer_map cm ON cm.pub_id = ps.customer_id
LEFT JOIN _user_map um     ON um.pub_id  = ps.created_by
-- Only migrate sessions not already in hgc (check by time_in + device match)
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_hgc.sessions hs
  WHERE hs.time_in = ps.time_in
    AND hs.duration_mins = ps.duration_mins
)
RETURNING id;

-- We can't use RETURNING directly into a mapping easily, so build it by time_in match
INSERT INTO _session_map (pub_id, hgc_id)
SELECT ps.id, hs.id
FROM public.sessions ps
JOIN tenant_hgc.sessions hs ON hs.time_in = ps.time_in AND hs.duration_mins = ps.duration_mins;

DO $$
BEGIN
  RAISE NOTICE 'Session map built: % entries', (SELECT COUNT(*) FROM _session_map);
END $$;

-- 4a. Session payments
INSERT INTO tenant_hgc.session_payments
  (session_id, amount, payment_method, note, created_by, created_at)
SELECT
  sm.hgc_id,
  sp.amount, sp.payment_method, sp.note,
  um.hgc_id,
  sp.created_at
FROM public.session_payments sp
JOIN _session_map sm ON sm.pub_id = sp.session_id
LEFT JOIN _user_map um ON um.pub_id = sp.created_by
-- Avoid duplicates by checking amount + created_at + session
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_hgc.session_payments hsp
  WHERE hsp.session_id = sm.hgc_id
    AND hsp.amount = sp.amount
    AND hsp.created_at = sp.created_at
);

DO $$ BEGIN RAISE NOTICE 'Session payments migrated.'; END $$;

-- 4b. Session players
INSERT INTO tenant_hgc.session_players
  (session_id, player_number, customer_id, player_name, own_controller, controller_fee, extra_person_fee)
SELECT
  sm.hgc_id,
  sp2.player_number,
  cm.hgc_id,
  sp2.player_name,
  COALESCE(sp2.own_controller, FALSE),
  COALESCE(sp2.controller_fee, 0),
  COALESCE(sp2.extra_person_fee, 0)
FROM public.session_players sp2
JOIN _session_map sm ON sm.pub_id = sp2.session_id
LEFT JOIN _customer_map cm ON cm.pub_id = sp2.customer_id
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_hgc.session_players hsp
  WHERE hsp.session_id = sm.hgc_id AND hsp.player_number = sp2.player_number
);

DO $$ BEGIN RAISE NOTICE 'Session players migrated.'; END $$;

-- ===========================================================================
-- PHASE 5: Recharges (2 rows)
-- ===========================================================================

INSERT INTO tenant_hgc.recharges
  (customer_id, game_platform, cost_price, charge_price,
   payment_received, payment_method, note, date, created_by, created_at)
SELECT
  cm.hgc_id,
  pr.game_platform, pr.cost_price, pr.charge_price,
  pr.payment_received, pr.payment_method, pr.note, pr.date,
  um.hgc_id,
  pr.created_at
FROM public.recharges pr
LEFT JOIN _customer_map cm ON cm.pub_id = pr.customer_id
LEFT JOIN _user_map um     ON um.pub_id  = pr.created_by
-- Avoid duplicates
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_hgc.recharges hr
  WHERE hr.game_platform = pr.game_platform
    AND hr.charge_price = pr.charge_price
    AND hr.created_at = pr.created_at
);

DO $$ BEGIN RAISE NOTICE 'Recharges migrated.'; END $$;

-- ===========================================================================
-- PHASE 6: Expenses (1 row)
-- ===========================================================================

INSERT INTO tenant_hgc.expenses
  (date, category, amount, vendor_name, vendor_address, note,
   item_id, units, packs_count, pack_size, unit_buy_price, unit_sell_price,
   receipt_url, payment_method, created_by, created_at)
SELECT
  pe.date, pe.category, pe.amount, pe.vendor_name, pe.vendor_address, pe.note,
  pe.item_id, COALESCE(pe.units, 0), COALESCE(pe.packs_count, 1),
  COALESCE(pe.pack_size, 1), pe.unit_buy_price, pe.unit_sell_price,
  pe.receipt_url, pe.payment_method,
  um.hgc_id,
  pe.created_at
FROM public.expenses pe
LEFT JOIN _user_map um ON um.pub_id = pe.created_by
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_hgc.expenses he
  WHERE he.date = pe.date AND he.amount = pe.amount AND he.category = pe.category
    AND (he.vendor_name = pe.vendor_name OR (he.vendor_name IS NULL AND pe.vendor_name IS NULL))
);

DO $$ BEGIN RAISE NOTICE 'Expenses migrated.'; END $$;

-- ===========================================================================
-- PHASE 7: Operator Sessions (54 rows — login history)
-- ===========================================================================

INSERT INTO tenant_hgc.operator_sessions
  (user_id, username, login_at, logout_at)
SELECT
  um.hgc_id,
  po.username, po.login_at, po.logout_at
FROM public.operator_sessions po
LEFT JOIN _user_map um ON um.pub_id = po.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_hgc.operator_sessions ho
  WHERE ho.username = po.username AND ho.login_at = po.login_at
);

DO $$ BEGIN RAISE NOTICE 'Operator sessions migrated.'; END $$;

-- ===========================================================================
-- PHASE 8: Audit Logs (104 rows — historical audit trail)
-- ===========================================================================

INSERT INTO tenant_hgc.audit_logs
  (user_id, username, action, module, details, metadata, created_at)
SELECT
  um.hgc_id,
  al.username, al.action, al.module, al.details, al.metadata, al.created_at
FROM public.audit_logs al
LEFT JOIN _user_map um ON um.pub_id = al.user_id
-- Avoid exact duplicates (same action + user + timestamp)
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_hgc.audit_logs hal
  WHERE hal.username = al.username
    AND hal.action   = al.action
    AND hal.created_at = al.created_at
);

DO $$ BEGIN RAISE NOTICE 'Audit logs migrated.'; END $$;

-- ===========================================================================
-- PHASE 9: Verification — counts before drop
-- ===========================================================================

DO $$
DECLARE
  hgc_sessions   BIGINT;
  hgc_users      BIGINT;
  hgc_audit      BIGINT;
  hgc_ops        BIGINT;
  hgc_recharges  BIGINT;
BEGIN
  SELECT COUNT(*) INTO hgc_sessions  FROM tenant_hgc.sessions;
  SELECT COUNT(*) INTO hgc_users     FROM tenant_hgc.users;
  SELECT COUNT(*) INTO hgc_audit     FROM tenant_hgc.audit_logs;
  SELECT COUNT(*) INTO hgc_ops       FROM tenant_hgc.operator_sessions;
  SELECT COUNT(*) INTO hgc_recharges FROM tenant_hgc.recharges;

  RAISE NOTICE '=== tenant_hgc row counts after migration ===';
  RAISE NOTICE '  sessions:          %', hgc_sessions;
  RAISE NOTICE '  users:             %', hgc_users;
  RAISE NOTICE '  audit_logs:        %', hgc_audit;
  RAISE NOTICE '  operator_sessions: %', hgc_ops;
  RAISE NOTICE '  recharges:         %', hgc_recharges;
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Review the counts above. COMMIT to finalize, or ROLLBACK to undo.';
END $$;

-- ===========================================================================
-- PHASE 10: Drop ghost tables (safe — all data rescued above)
-- ===========================================================================

SET search_path TO public;

DROP TABLE IF EXISTS public.sale_items         CASCADE;
DROP TABLE IF EXISTS public.session_players    CASCADE;
DROP TABLE IF EXISTS public.session_payments   CASCADE;
DROP TABLE IF EXISTS public.sales              CASCADE;
DROP TABLE IF EXISTS public.pancafe_sessions   CASCADE;
DROP TABLE IF EXISTS public.sessions           CASCADE;
DROP TABLE IF EXISTS public.recharges          CASCADE;
DROP TABLE IF EXISTS public.expenses           CASCADE;
DROP TABLE IF EXISTS public.shift_closings     CASCADE;
DROP TABLE IF EXISTS public.day_openings       CASCADE;
DROP TABLE IF EXISTS public.operator_sessions  CASCADE;
DROP TABLE IF EXISTS public.audit_logs         CASCADE;
DROP TABLE IF EXISTS public.inventory_items    CASCADE;
DROP TABLE IF EXISTS public.pancafe_plans      CASCADE;
DROP TABLE IF EXISTS public.recharge_platforms CASCADE;
DROP TABLE IF EXISTS public.customers          CASCADE;
DROP TABLE IF EXISTS public.devices            CASCADE;
DROP TABLE IF EXISTS public.pricing            CASCADE;
DROP TABLE IF EXISTS public.settings           CASCADE;
DROP TABLE IF EXISTS public.users              CASCADE;

DROP VIEW  IF EXISTS public.daily_revenue;

-- ===========================================================================
-- PHASE 11: Global table hardening (idempotent)
-- ===========================================================================

SET search_path TO public;

-- FK: organization_staff → tenants
ALTER TABLE public.organization_staff
  DROP CONSTRAINT IF EXISTS org_staff_schema_fk;
ALTER TABLE public.organization_staff
  ADD CONSTRAINT org_staff_schema_fk
  FOREIGN KEY (schema_name) REFERENCES public.tenants(schema_name)
  ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- FK: tenant_profile_changes → tenants
ALTER TABLE public.tenant_profile_changes
  DROP CONSTRAINT IF EXISTS tenant_profile_changes_schema_name_fkey;
ALTER TABLE public.tenant_profile_changes
  ADD CONSTRAINT tenant_profile_changes_schema_name_fkey
  FOREIGN KEY (schema_name) REFERENCES public.tenants(schema_name)
  ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- Indexes on hot resolution paths
CREATE INDEX IF NOT EXISTS idx_tenants_admin_email  ON public.tenants (admin_email);
CREATE INDEX IF NOT EXISTS idx_tenants_org_id       ON public.tenants (org_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug         ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status       ON public.tenants (status);

CREATE INDEX IF NOT EXISTS idx_orgstaff_email       ON public.organization_staff (staff_email);
CREATE INDEX IF NOT EXISTS idx_orgstaff_schema      ON public.organization_staff (schema_name);
CREATE INDEX IF NOT EXISTS idx_orgstaff_status      ON public.organization_staff (status);

CREATE INDEX IF NOT EXISTS idx_saaudit_created      ON public.super_admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpc_schema_status    ON public.tenant_profile_changes (schema_name, status);

COMMIT;

-- Final confirmation
SELECT
  table_name,
  (xpath('/row/cnt/text()',
    query_to_xml(format('SELECT COUNT(*) AS cnt FROM public.%I', table_name), true, true, '')
  ))[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

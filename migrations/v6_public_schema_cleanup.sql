-- ============================================================================
-- Nexus Manager v6 — Public Schema Cleanup & ACID Enforcement
-- ============================================================================
-- PURPOSE: Remove ghost operational tables from public schema that leaked
--          from the single-tenant era. Only 4 tables legitimately belong in
--          public: tenants, organization_staff, super_admin_audit_logs,
--          tenant_profile_changes.
--
-- USAGE:
--   STEP 1 — Run the DIAGNOSTIC block below first (read-only, safe)
--   STEP 2 — Verify all ghost tables show 0 rows
--   STEP 3 — Run the CLEANUP block in a transaction
--
-- ⚠ If any ghost table shows rows > 0, STOP and contact dev team.
--   Data must be migrated to the correct tenant schema before dropping.
-- ============================================================================

-- ============================================================================
-- STEP 1: DIAGNOSTIC — Run this first, read the output before proceeding
-- ============================================================================

SELECT
  table_name,
  CASE
    WHEN table_name IN ('tenants','organization_staff','super_admin_audit_logs','tenant_profile_changes')
    THEN '✅ LEGITIMATE — keep'
    ELSE '❌ GHOST — should be 0 rows'
  END AS classification,
  (xpath('/row/cnt/text()',
    query_to_xml(format('SELECT COUNT(*) AS cnt FROM public.%I', table_name), true, true, '')
  ))[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY classification, table_name;

-- Also check for the ghost view
SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname = 'daily_revenue';

-- ============================================================================
-- STEP 2: CLEANUP — Run only after confirming 0 rows in ghost tables above
-- ============================================================================

BEGIN;

-- ── Drop ghost view ──────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.daily_revenue;

-- ── Drop ghost operational tables (safe — only if empty) ────────────────────
-- Order: children first, then parents. CASCADE as safety net.

DO $$
DECLARE
  ghost_tables TEXT[] := ARRAY[
    'sale_items', 'session_players', 'session_payments',
    'sales', 'pancafe_sessions', 'sessions',
    'recharges', 'expenses', 'shift_closings', 'day_openings',
    'audit_logs', 'inventory_items',
    'pancafe_plans', 'recharge_platforms',
    'customers', 'devices', 'pricing', 'settings', 'users'
  ];
  tbl TEXT;
  cnt BIGINT;
BEGIN
  FOREACH tbl IN ARRAY ghost_tables LOOP
    -- Only drop if the table exists in public
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', tbl) INTO cnt;

      IF cnt > 0 THEN
        RAISE EXCEPTION
          'ABORT: public.% has % rows. Migrate data to correct tenant schema before dropping.',
          tbl, cnt;
      END IF;

      EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', tbl);
      RAISE NOTICE 'Dropped public.%', tbl;
    ELSE
      RAISE NOTICE 'Skipped public.% (does not exist)', tbl;
    END IF;
  END LOOP;
END $$;

-- ── Harden: organization_staff → tenants FK ──────────────────────────────────
-- Ensures every staff row maps to a real tenant. DEFERRABLE so provisioning
-- can insert staff before committing the tenant row in the same transaction.
ALTER TABLE public.organization_staff
  DROP CONSTRAINT IF EXISTS org_staff_schema_fk;

ALTER TABLE public.organization_staff
  ADD CONSTRAINT org_staff_schema_fk
  FOREIGN KEY (schema_name)
  REFERENCES public.tenants(schema_name)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- ── Harden: tenant_profile_changes → tenants FK ─────────────────────────────
ALTER TABLE public.tenant_profile_changes
  DROP CONSTRAINT IF EXISTS tenant_profile_changes_schema_name_fkey;

ALTER TABLE public.tenant_profile_changes
  ADD CONSTRAINT tenant_profile_changes_schema_name_fkey
  FOREIGN KEY (schema_name)
  REFERENCES public.tenants(schema_name)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- ── Harden: tenants table constraints ────────────────────────────────────────
ALTER TABLE public.tenants
  ALTER COLUMN admin_email SET NOT NULL,
  ALTER COLUMN slug         SET NOT NULL,
  ALTER COLUMN schema_name  SET NOT NULL,
  ALTER COLUMN name         SET NOT NULL;

-- Ensure unique constraints exist (safe with IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_slug_key') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_schema_name_key') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_schema_name_key UNIQUE (schema_name);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_org_id_key') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_org_id_key UNIQUE (org_id);
  END IF;
END $$;

-- ── Add missing indexes on global tables ─────────────────────────────────────
-- These make resolveTenantSchema() fast — it runs on every API request
CREATE INDEX IF NOT EXISTS idx_tenants_status       ON public.tenants (status);
CREATE INDEX IF NOT EXISTS idx_tenants_admin_email  ON public.tenants (admin_email);
CREATE INDEX IF NOT EXISTS idx_tenants_org_id       ON public.tenants (org_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug         ON public.tenants (slug);

CREATE INDEX IF NOT EXISTS idx_orgstaff_email       ON public.organization_staff (staff_email);
CREATE INDEX IF NOT EXISTS idx_orgstaff_schema      ON public.organization_staff (schema_name);
CREATE INDEX IF NOT EXISTS idx_orgstaff_status      ON public.organization_staff (status);

CREATE INDEX IF NOT EXISTS idx_saaudit_created      ON public.super_admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saaudit_target_org   ON public.super_admin_audit_logs (target_org_id);

CREATE INDEX IF NOT EXISTS idx_tpc_schema_status    ON public.tenant_profile_changes (schema_name, status);
CREATE INDEX IF NOT EXISTS idx_tpc_requested_at     ON public.tenant_profile_changes (requested_at DESC);

COMMIT;

SELECT
  'v6 cleanup complete. Public schema now contains:' AS status,
  COUNT(*) AS remaining_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

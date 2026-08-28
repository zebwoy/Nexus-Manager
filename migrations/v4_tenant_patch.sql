-- ============================================================================
-- Nexus Manager v4 — Tenant Schema Patch
-- Patches ALL existing tenant schemas to match the canonical TENANT_SCHEMA_TEMPLATE
-- Safe & Idempotent — run once per tenant schema, or use the DO block below
--
-- HOW TO RUN:
--   Option A — Run for ALL tenants automatically (recommended):
--     Just execute this entire script. The DO block at the bottom iterates
--     over all tenant schemas found in the `tenants` table.
--
--   Option B — Run for a single tenant manually:
--     SET search_path TO tenant_hgc;          -- or tenant_demo_sandbox, etc.
--     [then run just the ALTER TABLE statements from the "Per-Schema Fixes" block]
-- ============================================================================

-- ── Per-Schema Fixes (template — applied via loop below) ─────────────────────
-- The following changes are needed for every tenant schema:
--
-- 1. users: add avatar_url (present in tenant_hgc, missing in tenant_demo_sandbox)
-- 2. users: fix role check in tenant_demo_sandbox (only had admin + operator)
-- 3. users: add status column if missing (tenant_demo_sandbox missing it)
-- 4. users: add email column if missing
-- 5. session_players: add customer_id, player_name (tenant_demo_sandbox missing)
-- 6. day_openings: add denominations, opened_by (both tenants missing)
-- 7. audit_logs: add module, metadata (tenant_demo_sandbox missing)
-- 8. sales: add is_deleted (tenant_demo_sandbox had it, template now has it)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    tenant_schema TEXT;
    schemas TEXT[] := ARRAY['tenant_demo_sandbox', 'tenant_hgc'];
    -- Add any additional schemas here as they are provisioned
    -- OR replace with: SELECT array_agg(schema_name) FROM tenants
BEGIN
    -- Try to auto-detect schemas from tenants table if it exists
    BEGIN
        SELECT array_agg(schema_name) INTO schemas FROM tenants WHERE status = 'active';
        IF schemas IS NULL OR array_length(schemas, 1) = 0 THEN
            schemas := ARRAY['tenant_demo_sandbox', 'tenant_hgc'];
        END IF;
    EXCEPTION WHEN OTHERS THEN
        schemas := ARRAY['tenant_demo_sandbox', 'tenant_hgc'];
    END;

    FOREACH tenant_schema IN ARRAY schemas LOOP
        RAISE NOTICE 'Patching schema: %', tenant_schema;

        -- ── users: avatar_url ─────────────────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS avatar_url TEXT',
            tenant_schema
        );

        -- ── users: email ──────────────────────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS email VARCHAR(255)',
            tenant_schema
        );

        -- ── users: status ─────────────────────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT ''active''',
            tenant_schema
        );

        -- ── users: fix role check (expand to full set) ────────────────────
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I.users DROP CONSTRAINT IF EXISTS users_role_check',
                tenant_schema
            );
            EXECUTE format(
                'ALTER TABLE %I.users ADD CONSTRAINT users_role_check
                 CHECK (role IN (''admin'', ''staff'', ''operator'', ''super_admin'', ''trial''))',
                tenant_schema
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not update role check on %.users: %', tenant_schema, SQLERRM;
        END;

        -- ── session_players: customer_id ──────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.session_players ADD COLUMN IF NOT EXISTS customer_id INT',
            tenant_schema
        );

        -- ── session_players: player_name ──────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.session_players ADD COLUMN IF NOT EXISTS player_name VARCHAR(100)',
            tenant_schema
        );

        -- ── day_openings: denominations ───────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.day_openings ADD COLUMN IF NOT EXISTS denominations JSONB',
            tenant_schema
        );

        -- ── day_openings: opened_by ───────────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.day_openings ADD COLUMN IF NOT EXISTS opened_by INT',
            tenant_schema
        );

        -- ── audit_logs: module ────────────────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(50)',
            tenant_schema
        );

        -- ── audit_logs: metadata ──────────────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB',
            tenant_schema
        );

        -- ── sales: is_deleted ─────────────────────────────────────────────
        EXECUTE format(
            'ALTER TABLE %I.sales ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE',
            tenant_schema
        );

        RAISE NOTICE 'Schema % patched successfully.', tenant_schema;
    END LOOP;
END $$;

SELECT 'v4 Tenant Patch complete. All tenant schemas are now consistent.' AS status;

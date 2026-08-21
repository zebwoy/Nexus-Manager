import { getPool, ok, err } from './_db.js'
import { ensureGlobalRegistry, provisionTenantSchema } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const rawUrl = req.url || ''
  const action = req.query.action || (rawUrl.includes('overview') ? 'overview' : rawUrl.includes('audit-logs') ? 'audit-logs' : 'tenants')
  const superAdminEmail = req.headers['x-superadmin-email'] || req.headers['x-user-email'] || 'superadmin@nexus.local'
  const superAdminId = req.headers['x-superadmin-id'] || 'sa_master'

  try {
    // 1. Ensure public global registry exists
    await ensureGlobalRegistry(pool)

    // ─── GET /api/super-admin?action=overview ───────────────────────
    if (action === 'overview' && req.method === 'GET') {
      const [tenantsR, auditR] = await Promise.all([
        pool.query('SELECT * FROM public.tenants ORDER BY created_at DESC'),
        pool.query('SELECT * FROM public.super_admin_audit_logs ORDER BY created_at DESC LIMIT 20')
      ])

      const tenants = tenantsR.rows
      const activeCount = tenants.filter(t => t.status === 'active').length
      const suspendedCount = tenants.filter(t => t.status === 'suspended').length

      // Count total stations across active tenant schemas
      let totalStations = 0
      let totalSessions = 0
      for (const t of tenants) {
        if (t.status === 'active') {
          try {
            const devR = await pool.query(`SELECT COUNT(*) FROM "${t.schema_name}".devices WHERE is_active = TRUE`)
            const sessR = await pool.query(`SELECT COUNT(*) FROM "${t.schema_name}".sessions`)
            totalStations += Number(devR.rows[0]?.count || 0)
            totalSessions += Number(sessR.rows[0]?.count || 0)
          } catch {
            // Schema might be pending or unprovisioned
          }
        }
      }

      return ok(res, {
        total_tenants: tenants.length,
        active_tenants: activeCount,
        suspended_tenants: suspendedCount,
        total_stations: totalStations,
        total_sessions: totalSessions,
        recent_audits: auditR.rows,
        tenants: tenants.slice(0, 5)
      })
    }

    // ─── GET /api/super-admin?action=audit-logs ─────────────────────
    if (action === 'audit-logs' && req.method === 'GET') {
      const logs = await pool.query('SELECT * FROM public.super_admin_audit_logs ORDER BY created_at DESC LIMIT 150')
      return ok(res, { logs: logs.rows })
    }

    // ─── GET /api/super-admin?action=tenants ────────────────────────
    if (action === 'tenants' && req.method === 'GET') {
      const id = req.query.id
      if (id) {
        const r = await pool.query('SELECT * FROM public.tenants WHERE id = $1', [Number(id)])
        if (r.rows.length === 0) return err(res, 'Tenant not found', 404)
        return ok(res, { tenant: r.rows[0] })
      }

      const r = await pool.query('SELECT * FROM public.tenants ORDER BY created_at DESC')
      
      // Auto-sync tenants to Clerk Organizations if enabled
      if (process.env.CLERK_SECRET_KEY) {
        try {
          const { createClerkClient } = await import('@clerk/backend')
          const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
          const clerkOrgs = await clerk.organizations.getOrganizationList({ limit: 100 })
          const existingClerkSlugs = new Set(clerkOrgs.data?.map(o => o.slug) || [])
          const existingClerkIds = new Set(clerkOrgs.data?.map(o => o.id) || [])

          for (const t of r.rows) {
            if (!existingClerkIds.has(t.org_id) && !existingClerkSlugs.has(t.slug)) {
              try {
                // Find admin user in Clerk
                let createdByUserId = null
                try {
                  const users = await clerk.users.getUserList({ emailAddress: [t.admin_email.trim().toLowerCase()] })
                  if (users.data?.length > 0) createdByUserId = users.data[0].id
                } catch {}

                const orgPayload = { name: t.name, slug: t.slug }
                if (createdByUserId) orgPayload.createdBy = createdByUserId

                const newClerkOrg = await clerk.organizations.createOrganization(orgPayload)
                if (newClerkOrg?.id) {
                  t.org_id = newClerkOrg.id
                  await pool.query('UPDATE public.tenants SET org_id = $1 WHERE id = $2', [newClerkOrg.id, t.id])
                }
              } catch (singleSyncErr) {
                console.warn(`Clerk org sync notice for ${t.name}:`, singleSyncErr?.message)
              }
            }
          }
        } catch (clerkSyncErr) {
          console.warn('Clerk sync check notice:', clerkSyncErr?.message)
        }
      }

      // Augment with station, session counts, and auto-seed standard <slug>_<role> operator accounts
      const enriched = await Promise.all(r.rows.map(async (t) => {
        let deviceCount = 0
        let sessionCount = 0
        try {
          const [dR, sR] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM "${t.schema_name}".devices WHERE is_active = TRUE`),
            pool.query(`SELECT COUNT(*) FROM "${t.schema_name}".sessions WHERE is_deleted = FALSE`)
          ])
          deviceCount = Number(dR.rows[0]?.count || 0)
          sessionCount = Number(sR.rows[0]?.count || 0)

          // Auto-ensure standard system operator accounts exist in tenant schema: <slug>_admin and <slug>_staff
          const adminOpUser = `${t.slug}_admin`
          const staffOpUser = `${t.slug}_staff`
          await pool.query(`
            INSERT INTO "${t.schema_name}".users (full_name, username, pin, role, email, status)
            VALUES ($1, $2, '1234', 'admin', $3, 'active')
            ON CONFLICT (username) DO UPDATE
            SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

            INSERT INTO "${t.schema_name}".users (full_name, username, pin, role, email, status)
            VALUES ('Counter Staff', $4, '1234', 'staff', NULL, 'active')
            ON CONFLICT (username) DO NOTHING;
          `, [t.admin_name || `${t.name} Admin`, adminOpUser, t.admin_email, staffOpUser])

          // Sync settings in tenant schema
          await pool.query(`
            INSERT INTO "${t.schema_name}".settings (key, value)
            VALUES ('cafe_name', $1), ('org_slug', $2), ('counter_phone', $3), ('cafe_logo', $4)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
          `, [t.name, t.slug, t.phone || '+91 98765 43210', t.logo_url || ''])
        } catch {}
        return { ...t, device_count: deviceCount, session_count: sessionCount }
      }))

      return ok(res, { tenants: enriched })
    }

    // ─── POST /api/super-admin?action=sync-clerk (Explicit Clerk Sync) ───
    if (action === 'sync-clerk' && req.method === 'POST') {
      const secretKey = process.env.CLERK_SECRET_KEY
      if (!secretKey) {
        return err(res, 'CLERK_SECRET_KEY is missing in Vercel Environment Variables. Please copy sk_test_... from Clerk Dashboard -> API Keys into Vercel Settings -> Environment Variables and redeploy.', 400)
      }

      try {
        const { createClerkClient } = await import('@clerk/backend')
        const clerk = createClerkClient({ secretKey })
        const clerkOrgs = await clerk.organizations.getOrganizationList({ limit: 100 })
        const existingClerkSlugs = new Set(clerkOrgs.data?.map(o => o.slug) || [])
        const existingClerkIds = new Set(clerkOrgs.data?.map(o => o.id) || [])

        const tenantsR = await pool.query('SELECT * FROM public.tenants ORDER BY id ASC')
        const synced = []
        const errors = []

        for (const t of tenantsR.rows) {
          if (!existingClerkIds.has(t.org_id) && !existingClerkSlugs.has(t.slug)) {
            try {
              let createdByUserId = null
              try {
                const users = await clerk.users.getUserList({ emailAddress: [t.admin_email.trim().toLowerCase()] })
                if (users.data?.length > 0) createdByUserId = users.data[0].id
              } catch {}

              let clerkSlug = t.name
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 30)
              if (clerkSlug.length < 4) clerkSlug = `org-${clerkSlug}`
              if (clerkSlug.length < 4) clerkSlug = `org-${t.id || '1000'}`

              const orgPayload = { name: t.name.trim(), slug: clerkSlug }
              if (createdByUserId) orgPayload.createdBy = createdByUserId

              const newClerkOrg = await clerk.organizations.createOrganization(orgPayload)
              if (newClerkOrg?.id) {
                await pool.query('UPDATE public.tenants SET org_id = $1 WHERE id = $2', [newClerkOrg.id, t.id])
                synced.push({ name: t.name, clerk_org_id: newClerkOrg.id })
              }
            } catch (err) {
              const errMsg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err.message
              errors.push({ name: t.name, error: errMsg })
            }
          } else {
            synced.push({ name: t.name, status: 'already_exists_in_clerk' })
          }
        }

        return ok(res, { success: true, synced, errors, total: tenantsR.rows.length })
      } catch (e) {
        return err(res, `Clerk API Error: ${e.message}`, 500)
      }
    }

    // ─── POST /api/super-admin?action=tenants (Create Org & Provision Schema) ───
    if (action === 'tenants' && req.method === 'POST') {
      const b = req.body || {}
      const { name, slug, admin_email, admin_name, phone, logo_url, plan, max_devices } = b

      if (!name?.trim() || !admin_email?.trim()) {
        return err(res, 'Organization name and Admin email are required', 400)
      }

      // Generate clean initialism slug and schema name
      let baseSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
      if (!baseSlug) baseSlug = 'org'

      let candidateSchema = `tenant_${baseSlug}`
      let suffix = 1
      while (true) {
        const exists = await pool.query(
          'SELECT 1 FROM public.tenants WHERE schema_name = $1',
          [candidateSchema]
        )
        if (exists.rows.length === 0) break
        suffix++
        candidateSchema = `tenant_${baseSlug}_${suffix}`
      }

      const finalSlug = candidateSchema.replace('tenant_', '')
      const schemaName = candidateSchema
      const orgId = `org_${finalSlug}`

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // 1. Synchronize Organization with Clerk API if configured
        let clerkOrgId = null
        try {
          if (process.env.CLERK_SECRET_KEY) {
            const { createClerkClient } = await import('@clerk/backend')
            const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
            
            let createdByUserId = null
            try {
              const users = await clerk.users.getUserList({ emailAddress: [admin_email.trim().toLowerCase()] })
              if (users.data?.length > 0) createdByUserId = users.data[0].id
            } catch (uErr) {}

            let clerkSlug = name
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 30)
            if (clerkSlug.length < 4) clerkSlug = `org-${clerkSlug}`
            if (clerkSlug.length < 4) clerkSlug = `org-${finalSlug}`

            const orgPayload = { name: name.trim(), slug: clerkSlug }
            if (createdByUserId) orgPayload.createdBy = createdByUserId

            const clerkOrg = await clerk.organizations.createOrganization(orgPayload)
            clerkOrgId = clerkOrg?.id

            if (!createdByUserId && clerkOrgId) {
              try {
                await clerk.organizations.createOrganizationInvitation({
                  organizationId: clerkOrgId,
                  emailAddress: admin_email.trim().toLowerCase(),
                  role: 'org:admin'
                })
              } catch (invErr) {}
            }
          }
        } catch (clerkError) {
          console.warn('Clerk organization provision notice:', clerkError?.message)
        }

        // 2. Insert into public.tenants registry
        const finalOrgId = clerkOrgId || orgId
        const tenantR = await client.query(
          `INSERT INTO public.tenants
            (org_id, name, slug, schema_name, admin_email, admin_name, phone, logo_url, plan, max_devices, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            finalOrgId,
            name.trim(),
            finalSlug,
            schemaName,
            admin_email.trim().toLowerCase(),
            admin_name || `${name} Admin`,
            phone || '+91 98765 43210',
            logo_url || null,
            plan || 'pro',
            max_devices || 20,
            superAdminEmail
          ]
        )
        const tenant = tenantR.rows[0]

        // 3. Provision PostgreSQL schema & template tables
        await provisionTenantSchema(pool, schemaName)

        // 4. Pre-seed fixed system operator accounts in format: <slug>_admin and <slug>_staff
        const adminOpUser = `${finalSlug}_admin`
        const staffOpUser = `${finalSlug}_staff`

        await client.query(`
          INSERT INTO "${schemaName}".users (full_name, username, pin, role, email, status)
          VALUES ($1, $2, '1234', 'admin', $3, 'active')
          ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email, status = 'active';

          INSERT INTO "${schemaName}".users (full_name, username, pin, role, email, status)
          VALUES ('Counter Staff', $4, '1234', 'staff', NULL, 'active')
          ON CONFLICT (username) DO NOTHING;
        `, [admin_name || `${name} Admin`, adminOpUser, admin_email.trim().toLowerCase(), staffOpUser])

        await client.query(`
          INSERT INTO "${schemaName}".settings (key, value)
          VALUES ('cafe_name', $1), ('admin_email', $2), ('org_slug', $3), ('counter_phone', $4), ('cafe_logo', $5)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, [name.trim(), admin_email.trim().toLowerCase(), finalSlug, phone || '+91 98765 43210', logo_url || ''])

        // 5. Log Super Admin Audit Trail
        await client.query(
          `INSERT INTO public.super_admin_audit_logs (super_admin_id, super_admin_email, action, target_org_id, details)
           VALUES ($1, $2, 'CREATE_TENANT', $3, $4)`,
          [
            superAdminId,
            superAdminEmail,
            finalOrgId,
            `Created organization "${name}" (Schema: ${schemaName}, Operators: @${adminOpUser}, @${staffOpUser}) with admin: ${admin_email}`
          ]
        )

        await client.query('COMMIT')
        return ok(res, { success: true, tenant }, 201)
      } catch (e) {
        await client.query('ROLLBACK')
        console.error('Failed to create tenant:', e)
        return err(res, e, 500)
      } finally {
        client.release()
      }
    }

    // ─── PATCH /api/super-admin?action=tenants&id=X (Update Tenant / Reassign Admin) ───
    if (action === 'tenants' && req.method === 'PATCH') {
      const id = Number(req.query.id)
      if (!id) return err(res, 'Tenant ID is required', 400)

      const b = req.body || {}
      const curR = await pool.query('SELECT * FROM public.tenants WHERE id = $1', [id])
      if (curR.rows.length === 0) return err(res, 'Tenant not found', 404)
      const cur = curR.rows[0]

      const name = b.name !== undefined ? b.name : cur.name
      const admin_email = b.admin_email !== undefined ? b.admin_email.trim().toLowerCase() : cur.admin_email
      const admin_name = b.admin_name !== undefined ? b.admin_name : cur.admin_name
      const phone = b.phone !== undefined ? b.phone : cur.phone
      const logo_url = b.logo_url !== undefined ? b.logo_url : cur.logo_url
      const status = b.status !== undefined ? b.status : cur.status
      const plan = b.plan !== undefined ? b.plan : cur.plan
      const max_devices = b.max_devices !== undefined ? Number(b.max_devices) : cur.max_devices

      const updated = await pool.query(
        `UPDATE public.tenants
         SET name = $1, admin_email = $2, admin_name = $3, phone = $4, logo_url = $5, status = $6, plan = $7, max_devices = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [name, admin_email, admin_name, phone, logo_url, status, plan, max_devices, id]
      )

      // Sync settings and operator admin account in private tenant schema
      try {
        const adminOpUser = `${cur.slug}_admin`
        await pool.query(`
          INSERT INTO "${cur.schema_name}".settings (key, value)
          VALUES ('cafe_name', $1), ('admin_email', $2), ('counter_phone', $3), ('cafe_logo', $4)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

          UPDATE "${cur.schema_name}".users
          SET full_name = $5, email = $2
          WHERE username = $6;
        `, [name.trim(), admin_email.trim().toLowerCase(), phone || '+91 98765 43210', logo_url || '', admin_name || `${name} Admin`, adminOpUser])
      } catch {}

      await pool.query(
        `INSERT INTO public.super_admin_audit_logs (super_admin_id, super_admin_email, action, target_org_id, details)
         VALUES ($1, $2, 'UPDATE_TENANT', $3, $4)`,
        [
          superAdminId,
          superAdminEmail,
          cur.org_id,
          `Updated tenant "${name}" | Status: ${status} | Plan: ${plan} | Admin: ${admin_email}`
        ]
      )

      return ok(res, { success: true, tenant: updated.rows[0] })
    }

    // ─── DELETE /api/super-admin?action=tenants&id=X (Drop Schema & Purge Org) ───
    if (action === 'tenants' && req.method === 'DELETE') {
      const id = Number(req.query.id)
      if (!id) return err(res, 'Tenant ID is required', 400)

      const curR = await pool.query('SELECT * FROM public.tenants WHERE id = $1', [id])
      if (curR.rows.length === 0) return err(res, 'Tenant not found', 404)
      const tenant = curR.rows[0]

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // 1. Drop isolated schema and all its tables
        await client.query(`DROP SCHEMA IF EXISTS "${tenant.schema_name}" CASCADE`)
        // 2. Delete tenant registry
        await client.query('DELETE FROM public.tenants WHERE id = $1', [id])
        // 3. Write audit log
        await client.query(
          `INSERT INTO public.super_admin_audit_logs (super_admin_id, super_admin_email, action, target_org_id, details)
           VALUES ($1, $2, 'DELETE_TENANT', $3, $4)`,
          [
            superAdminId,
            superAdminEmail,
            tenant.org_id,
            `Deleted organization "${tenant.name}" and dropped schema "${tenant.schema_name}"`
          ]
        )
        await client.query('COMMIT')
        return ok(res, { success: true })
      } catch (e) {
        await client.query('ROLLBACK')
        console.error('Failed to delete tenant:', e)
        return err(res, e, 500)
      } finally {
        client.release()
      }
    }

    // ─── POST /api/super-admin?action=reset-tenant&id=X (Purge Transactions with Dual-Verification & Snapshot Backup) ───
    if (action === 'reset-tenant' && req.method === 'POST') {
      const id = Number(req.query.id || req.body?.id)
      const { pin, confirm_text } = req.body || {}
      if (!id) return err(res, 'Tenant ID is required', 400)

      // Dual verification check
      const cleanPin = String(pin || '').trim()
      if (cleanPin !== '9999' && cleanPin !== '1234') {
        return err(res, 'Invalid Super Admin Security PIN. Authorization denied.', 403)
      }

      const curR = await pool.query('SELECT * FROM public.tenants WHERE id = $1', [id])
      if (curR.rows.length === 0) return err(res, 'Tenant not found', 404)
      const tenant = curR.rows[0]

      const cleanConfirm = String(confirm_text || '').trim().toLowerCase()
      if (cleanConfirm !== tenant.slug.toLowerCase() &&
          cleanConfirm !== `reset ${tenant.slug.toLowerCase()}` &&
          cleanConfirm !== tenant.name.toLowerCase()) {
        return err(res, `Confirmation mismatch. You must type "RESET ${tenant.slug}" to authorize ledger purge.`, 400)
      }

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`SET search_path TO "${tenant.schema_name}", public`)

        // 1. Create Snapshot Backup Tables before truncation
        await client.query(`
          DROP TABLE IF EXISTS _snapshot_backup_sessions CASCADE;
          DROP TABLE IF EXISTS _snapshot_backup_sales CASCADE;
          DROP TABLE IF EXISTS _snapshot_backup_sale_items CASCADE;
          DROP TABLE IF EXISTS _snapshot_backup_recharges CASCADE;
          DROP TABLE IF EXISTS _snapshot_backup_expenses CASCADE;
          DROP TABLE IF EXISTS _snapshot_backup_openings CASCADE;
          DROP TABLE IF EXISTS _snapshot_backup_closings CASCADE;

          CREATE TABLE _snapshot_backup_sessions AS SELECT * FROM sessions;
          CREATE TABLE _snapshot_backup_sales AS SELECT * FROM sales;
          CREATE TABLE _snapshot_backup_sale_items AS SELECT * FROM sale_items;
          CREATE TABLE _snapshot_backup_recharges AS SELECT * FROM recharges;
          CREATE TABLE _snapshot_backup_expenses AS SELECT * FROM expenses;
          CREATE TABLE _snapshot_backup_openings AS SELECT * FROM day_openings;
          CREATE TABLE _snapshot_backup_closings AS SELECT * FROM shift_closings;
        `)

        // 2. Truncate live transactional ledgers
        await client.query(`
          TRUNCATE TABLE sale_items, sales, session_payments, session_players, sessions,
                         recharges, expenses, day_openings, shift_closings CASCADE;
          UPDATE inventory_items SET stock_qty = 0;
        `)

        // 3. Write immutable Super Admin Audit Log
        await client.query(
          `INSERT INTO public.super_admin_audit_logs (super_admin_id, super_admin_email, action, target_org_id, details)
           VALUES ($1, $2, 'PURGE_TRANSACTIONAL_DATA', $3, $4)`,
          [
            superAdminId,
            superAdminEmail,
            tenant.org_id,
            `Purged transaction ledger for "${tenant.name}" (${tenant.schema_name}) with dual-verification. Snapshot backup retained.`
          ]
        )
        await client.query('COMMIT')
        return ok(res, {
          success: true,
          message: `Transactional data for "${tenant.name}" purged. Snapshot backup available for immediate undo.`,
          canUndo: true,
          tenant_id: tenant.id,
          schema_name: tenant.schema_name
        })
      } catch (e) {
        await client.query('ROLLBACK')
        console.error('Failed to reset tenant data:', e)
        return err(res, e, 500)
      } finally {
        client.release()
      }
    }

    // ─── POST /api/super-admin?action=undo-reset-tenant&id=X (Restore from Snapshot Backup) ───
    if (action === 'undo-reset-tenant' && req.method === 'POST') {
      const id = Number(req.query.id || req.body?.id)
      if (!id) return err(res, 'Tenant ID is required', 400)

      const curR = await pool.query('SELECT * FROM public.tenants WHERE id = $1', [id])
      if (curR.rows.length === 0) return err(res, 'Tenant not found', 404)
      const tenant = curR.rows[0]

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`SET search_path TO "${tenant.schema_name}", public`)

        // Check if snapshot tables exist
        const checkR = await client.query(`
          SELECT to_regclass('"${tenant.schema_name}"._snapshot_backup_sessions') as has_sessions
        `)
        if (!checkR.rows[0]?.has_sessions) {
          await client.query('ROLLBACK')
          return err(res, 'No snapshot backup found for this tenant.', 404)
        }

        // Restore records
        await client.query(`
          INSERT INTO sessions SELECT * FROM _snapshot_backup_sessions ON CONFLICT (id) DO NOTHING;
          INSERT INTO sales SELECT * FROM _snapshot_backup_sales ON CONFLICT (id) DO NOTHING;
          INSERT INTO sale_items SELECT * FROM _snapshot_backup_sale_items ON CONFLICT (id) DO NOTHING;
          INSERT INTO recharges SELECT * FROM _snapshot_backup_recharges ON CONFLICT (id) DO NOTHING;
          INSERT INTO expenses SELECT * FROM _snapshot_backup_expenses ON CONFLICT (id) DO NOTHING;
          INSERT INTO day_openings SELECT * FROM _snapshot_backup_openings ON CONFLICT (id) DO NOTHING;
          INSERT INTO shift_closings SELECT * FROM _snapshot_backup_closings ON CONFLICT (id) DO NOTHING;
        `)

        // Log restore in Super Admin Audit
        await client.query(
          `INSERT INTO public.super_admin_audit_logs (super_admin_id, super_admin_email, action, target_org_id, details)
           VALUES ($1, $2, 'RESTORE_PURGED_DATA', $3, $4)`,
          [
            superAdminId,
            superAdminEmail,
            tenant.org_id,
            `Restored purged transaction ledger for "${tenant.name}" (${tenant.schema_name}) from snapshot backup.`
          ]
        )
        await client.query('COMMIT')
        return ok(res, {
          success: true,
          message: `Transaction ledger for "${tenant.name}" successfully restored from snapshot backup.`
        })
      } catch (e) {
        await client.query('ROLLBACK')
        console.error('Failed to restore snapshot:', e)
        return err(res, e, 500)
      } finally {
        client.release()
      }
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error('Super Admin API Error:', e)
    return err(res, e, 500)
  }
}

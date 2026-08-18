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
      
      // Augment with station and session counts
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
        } catch {}
        return { ...t, device_count: deviceCount, session_count: sessionCount }
      }))

      return ok(res, { tenants: enriched })
    }

    // ─── POST /api/super-admin?action=tenants (Create Org & Provision Schema) ───
    if (action === 'tenants' && req.method === 'POST') {
      const b = req.body || {}
      const { name, slug, admin_email, admin_name, plan, max_devices } = b

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

        // 1. Insert into public.tenants registry
        const tenantR = await client.query(
          `INSERT INTO public.tenants
            (org_id, name, slug, schema_name, admin_email, plan, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            orgId,
            name.trim(),
            finalSlug,
            schemaName,
            admin_email.trim().toLowerCase(),
            plan || 'pro',
            superAdminEmail
          ]
        )
        const tenant = tenantR.rows[0]

        // 2. Provision PostgreSQL schema & template tables
        await provisionTenantSchema(pool, schemaName)

        // 3. Pre-seed admin user in the newly provisioned tenant schema
        const adminUsername = admin_email.trim().toLowerCase().split('@')[0]
        await client.query(`
          INSERT INTO "${schemaName}".users (full_name, username, pin, role)
          VALUES ('Cafe Administrator', $1, '1234', 'admin')
          ON CONFLICT (username) DO NOTHING
        `, [adminUsername])

        // 4. Log Super Admin Audit Trail
        await client.query(
          `INSERT INTO public.super_admin_audit_logs (super_admin_id, super_admin_email, action, target_org_id, details)
           VALUES ($1, $2, 'CREATE_TENANT', $3, $4)`,
          [
            superAdminId,
            superAdminEmail,
            orgId,
            `Created organization "${name}" (Schema: ${schemaName}) with admin: ${admin_email}`
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
      const status = b.status !== undefined ? b.status : cur.status
      const plan = b.plan !== undefined ? b.plan : cur.plan
      const max_devices = b.max_devices !== undefined ? Number(b.max_devices) : cur.max_devices

      const updated = await pool.query(
        `UPDATE public.tenants
         SET name = $1, admin_email = $2, admin_name = $3, status = $4, plan = $5, max_devices = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [name, admin_email, admin_name, status, plan, max_devices, id]
      )

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

    // ─── POST /api/super-admin?action=reset-tenant&id=X (Purge Test Data in Schema) ───
    if (action === 'reset-tenant' && req.method === 'POST') {
      const id = Number(req.query.id)
      const curR = await pool.query('SELECT * FROM public.tenants WHERE id = $1', [id])
      if (curR.rows.length === 0) return err(res, 'Tenant not found', 404)
      const tenant = curR.rows[0]

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`SET search_path TO "${tenant.schema_name}", public`)
        await client.query(`
          TRUNCATE TABLE sale_items, sales, session_payments, session_players, sessions,
                         recharges, expenses, day_openings, shift_closings CASCADE;
          UPDATE inventory_items SET stock_qty = 0;
        `)
        await client.query(
          `INSERT INTO public.super_admin_audit_logs (super_admin_id, super_admin_email, action, target_org_id, details)
           VALUES ($1, $2, 'RESET_TENANT_DATA', $3, $4)`,
          [
            superAdminId,
            superAdminEmail,
            tenant.org_id,
            `Reset all test transactions for tenant "${tenant.name}" in schema "${tenant.schema_name}"`
          ]
        )
        await client.query('COMMIT')
        return ok(res, { success: true })
      } catch (e) {
        await client.query('ROLLBACK')
        console.error('Failed to reset tenant data:', e)
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

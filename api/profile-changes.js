import { getPool, ok, err } from './_db.js'
import { withTenantClient, ensureGlobalRegistry } from './_tenant.js'

/**
 * /api/profile-changes
 *
 * GET  — List current pending/historical changes for this tenant
 * POST — Submit a new profile change request (cafe_name / counter_phone / cafe_logo)
 *
 * Only org admins can submit change requests.
 * Changes are NOT applied immediately — they go into a pending queue for Super Admin approval.
 */
export default async function handler(req, res) {
  const pool = getPool()
  try {
    await ensureGlobalRegistry(pool)
  } catch (e) {
    console.error('ensureGlobalRegistry error:', e)
  }

  return withTenantClient(pool, req, res, async (client, schemaName) => {
    const callerUsername = req.headers['x-username'] || 'admin'
    const callerEmail = req.headers['x-user-email'] || ''

    // GET — fetch this tenant's change history
    if (req.method === 'GET') {
      const statusFilter = req.query.status || 'all'
      const changesR = await pool.query(`
        SELECT * FROM public.tenant_profile_changes
        WHERE schema_name = $1
        ${statusFilter !== 'all' ? 'AND status = $2' : ''}
        ORDER BY requested_at DESC
        LIMIT 30
      `, statusFilter !== 'all' ? [schemaName, statusFilter] : [schemaName])

      return ok(res, { changes: changesR.rows })
    }

    // POST — submit a new change request
    if (req.method === 'POST') {
      const { field, new_value } = req.body || {}
      const ALLOWED_FIELDS = ['cafe_name', 'counter_phone', 'cafe_logo']

      if (!field || !ALLOWED_FIELDS.includes(field)) {
        return err(res, 'Invalid field. Must be one of: cafe_name, counter_phone, cafe_logo', 400)
      }
      if (!new_value?.toString().trim()) {
        return err(res, 'New value is required', 400)
      }

      // Validate field-specific constraints
      if (field === 'cafe_name' && new_value.trim().length < 2) {
        return err(res, 'Cafe name must be at least 2 characters', 400)
      }
      if (field === 'counter_phone' && new_value.trim().length < 7) {
        return err(res, 'Phone number must be at least 7 characters', 400)
      }
      if (field === 'cafe_logo' && !new_value.startsWith('https://')) {
        return err(res, 'Logo must be a valid HTTPS URL (upload via the logo uploader first)', 400)
      }

      // Get the current value for this field
      let oldValue = ''
      try {
        if (field === 'cafe_name' || field === 'counter_phone' || field === 'cafe_logo') {
          const curR = await client.query('SELECT value FROM settings WHERE key = $1', [field])
          oldValue = curR.rows[0]?.value || ''
        }
      } catch {}

      // Check if there is already a pending request for this field
      const existingR = await pool.query(
        `SELECT id FROM public.tenant_profile_changes
         WHERE schema_name = $1 AND field = $2 AND status = 'pending'`,
        [schemaName, field]
      )
      if (existingR.rows.length > 0) {
        return err(res, `A pending change request for "${field}" already exists. Please wait for Super Admin review.`, 409)
      }

      // Insert the change request
      const insertR = await pool.query(
        `INSERT INTO public.tenant_profile_changes
           (schema_name, field, old_value, new_value, requested_by, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [schemaName, field, oldValue, new_value.toString().trim(), callerUsername || callerEmail]
      )

      // Audit it in the tenant's own audit log
      try {
        await client.query(
          `INSERT INTO audit_logs (username, action, module, details, metadata)
           VALUES ($1, 'REQUEST_PROFILE_CHANGE', 'staff', $2, $3)`,
          [
            callerUsername,
            `Submitted profile change request: "${field}" → "${new_value}" (pending Super Admin approval)`,
            JSON.stringify({ field, old_value: oldValue, new_value, schema_name: schemaName })
          ]
        )
      } catch {}

      return ok(res, { success: true, change: insertR.rows[0] }, 201)
    }

    // DELETE — cancel a pending request (by the requesting admin, before it's reviewed)
    if (req.method === 'DELETE') {
      const id = Number(req.query.id)
      if (!id) return err(res, 'Change request ID is required', 400)

      const existing = await pool.query(
        `SELECT * FROM public.tenant_profile_changes WHERE id = $1 AND schema_name = $2`,
        [id, schemaName]
      )
      if (existing.rows.length === 0) return err(res, 'Change request not found', 404)
      if (existing.rows[0].status !== 'pending') return err(res, 'Only pending requests can be cancelled', 400)

      await pool.query('DELETE FROM public.tenant_profile_changes WHERE id = $1', [id])
      return ok(res, { success: true, message: 'Change request cancelled' })
    }

    return err(res, 'Method not allowed', 405)
  })
}

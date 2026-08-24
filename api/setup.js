import { getPool, ok, err } from './_db.js'
import { withTenantClient, ensureGlobalRegistry } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const rawUrl = req.url || ''
  const resource = req.query.resource || (
    rawUrl.includes('blob-upload') ? 'blob-upload' :
    rawUrl.includes('profile-changes') ? 'profile-changes' :
    rawUrl.includes('devices') ? 'devices' :
    rawUrl.includes('platforms') ? 'platforms' :
    rawUrl.includes('pricing') ? 'pricing' :
    rawUrl.includes('settings') ? 'settings' :
    rawUrl.includes('purge') ? 'purge' : null
  )

  return withTenantClient(pool, req, res, async (client, schemaName) => {
    // ─── BLOB UPLOAD (Logo Storage) ───────────────────────────
    if (resource === 'blob-upload') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return err(res, 'Vercel Blob is not configured. Please add BLOB_READ_WRITE_TOKEN to your environment variables.', 503)
      }

      const filename = req.headers['x-filename'] || 'receipt.png'
      const contentType = req.headers['x-content-type'] || 'image/png'
      const orgSchema = req.headers['x-schema-name'] || schemaName || 'org'
      const folder = req.headers['x-folder'] || req.query?.folder || 'receipts'

      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
      if (!allowedTypes.includes(contentType)) {
        return err(res, 'Only PNG, JPEG, WebP, and SVG files are allowed.', 400)
      }

      try {
        const { put } = await import('@vercel/blob')
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
        const blobPath = `${folder}/${orgSchema}/${Date.now()}-${safeName}`
        let fileBuffer = null
        if (Buffer.isBuffer(req.body) && req.body.length > 0) {
          fileBuffer = req.body
        } else if (typeof req.body === 'string' && req.body.length > 0) {
          fileBuffer = Buffer.from(req.body, 'binary')
        } else {
          try {
            const chunks = []
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'binary') : chunk)
            }
            if (chunks.length > 0) {
              fileBuffer = Buffer.concat(chunks)
            }
          } catch (streamErr) {
            console.warn('Stream read failed:', streamErr)
          }
        }

        if (!fileBuffer || fileBuffer.length === 0) {
          return err(res, 'No file data received', 400)
        }

        let blob
        try {
          blob = await put(blobPath, fileBuffer, {
            access: 'public',
            contentType,
            token: process.env.BLOB_READ_WRITE_TOKEN,
            addRandomSuffix: false,
          })
        } catch (putErr) {
          if (putErr.message && (putErr.message.includes('private') || putErr.message.includes('store is configured with private'))) {
            blob = await put(blobPath, fileBuffer, {
              access: 'private',
              contentType,
              token: process.env.BLOB_READ_WRITE_TOKEN,
              addRandomSuffix: false,
            })
          } else {
            throw putErr
          }
        }

        return ok(res, { url: blob.url, downloadUrl: blob.downloadUrl, pathname: blob.pathname })
      } catch (e) {
        console.error('Blob upload error:', e)
        return err(res, 'Upload failed: ' + (e.message || 'Unknown error'), 500)
      }
    }

    // ─── PROFILE CHANGES (Admin Requests) ─────────────────────
    if (resource === 'profile-changes') {
      try {
        await ensureGlobalRegistry(pool)
      } catch (e) {}

      const callerUsername = req.headers['x-username'] || 'admin'
      const callerEmail = req.headers['x-user-email'] || ''

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

      if (req.method === 'POST') {
        const { field, new_value } = req.body || {}
        const ALLOWED_FIELDS = ['cafe_name', 'counter_phone', 'cafe_logo']
        if (!field || !ALLOWED_FIELDS.includes(field)) {
          return err(res, 'Invalid field. Must be one of: cafe_name, counter_phone, cafe_logo', 400)
        }
        if (!new_value?.toString().trim()) {
          return err(res, 'New value is required', 400)
        }
        if (field === 'cafe_name' && new_value.trim().length < 2) {
          return err(res, 'Cafe name must be at least 2 characters', 400)
        }
        if (field === 'counter_phone' && new_value.trim().length < 7) {
          return err(res, 'Phone number must be at least 7 characters', 400)
        }
        if (field === 'cafe_logo' && !new_value.startsWith('https://')) {
          return err(res, 'Logo must be a valid HTTPS URL (upload via the logo uploader first)', 400)
        }

        let oldValue = ''
        try {
          const curR = await client.query('SELECT value FROM settings WHERE key = $1', [field])
          oldValue = curR.rows[0]?.value || ''
        } catch {}

        const existingR = await pool.query(
          `SELECT id FROM public.tenant_profile_changes
           WHERE schema_name = $1 AND field = $2 AND status = 'pending'`,
          [schemaName, field]
        )
        if (existingR.rows.length > 0) {
          return err(res, `A pending change request for "${field}" already exists. Please wait for Super Admin review.`, 409)
        }

        const insertR = await pool.query(
          `INSERT INTO public.tenant_profile_changes
             (schema_name, field, old_value, new_value, requested_by, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           RETURNING *`,
          [schemaName, field, oldValue, new_value.toString().trim(), callerUsername || callerEmail]
        )

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
    }

    // ─── DEVICES ───────────────────────────────────────────────
    if (resource === 'devices') {
      if (req.method === 'GET') {
        const r = await client.query('SELECT * FROM devices WHERE is_active = TRUE ORDER BY type, id')
        return ok(res, { devices: r.rows })
      }
      if (req.method === 'POST') {
        if (req.query.action === 'restore') {
          const id = Number(req.query.id || req.body?.id)
          if (!id) return err(res, 'Device ID required', 400)
          await client.query('UPDATE devices SET is_active = TRUE WHERE id = $1', [id])
          return ok(res, { success: true })
        }
        const b = req.body || {}
        if (!b.label || !b.type) return err(res, 'Label and type are required', 400)
        const r = await client.query(
          `INSERT INTO devices (label, type) VALUES ($1, $2) RETURNING *`,
          [b.label.trim(), b.type]
        )
        return ok(res, { device: r.rows[0] }, 201)
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const b = req.body || {}
        const id = Number(b.id || req.query.id)
        if (!id) return err(res, 'Device ID required', 400)
        const cols = []; const vals = []; let i = 1
        if (b.label !== undefined)     { cols.push(`label = $${i++}`);     vals.push(b.label.trim()) }
        if (b.type !== undefined)      { cols.push(`type = $${i++}`);      vals.push(b.type) }
        if (b.is_active !== undefined) { cols.push(`is_active = $${i++}`); vals.push(!!b.is_active) }
        if (cols.length === 0) return err(res, 'Nothing to update', 400)
        vals.push(id)
        const r = await client.query(`UPDATE devices SET ${cols.join(', ')} WHERE id = $${i} RETURNING *`, vals)
        return ok(res, { device: r.rows[0] })
      }
      if (req.method === 'DELETE') {
        const id = Number(req.query.id)
        if (!id) return err(res, 'Device ID required', 400)
        await client.query('UPDATE devices SET is_active = FALSE WHERE id = $1', [id])
        return ok(res, { success: true })
      }
    }

    // ─── PLATFORMS ────────────────────────────────────────────
    if (resource === 'platforms') {
      if (req.method === 'GET') {
        const r = await client.query('SELECT * FROM recharge_platforms WHERE is_active = TRUE ORDER BY name')
        return ok(res, { platforms: r.rows })
      }
      if (req.method === 'POST') {
        const b = req.body || {}
        if (!b.name?.trim()) return err(res, 'Platform name is required', 400)
        const r = await client.query(
          `INSERT INTO recharge_platforms (name, description) VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET is_active = TRUE RETURNING *`,
          [b.name.trim(), b.description || null]
        )
        return ok(res, { platform: r.rows[0] }, 201)
      }
      if (req.method === 'DELETE') {
        const id = Number(req.query.id)
        if (!id) return err(res, 'Platform ID required', 400)
        await client.query('UPDATE recharge_platforms SET is_active = FALSE WHERE id = $1', [id])
        return ok(res, { success: true })
      }
    }

    // ─── PRICING ───────────────────────────────────────────────
    if (resource === 'pricing') {
      if (req.method === 'GET') {
        const r = await client.query('SELECT * FROM pricing ORDER BY device_type, duration_mins')
        return ok(res, { pricing: r.rows })
      }
      if (req.method === 'POST') {
        const b = req.body || {}
        if (b.hourly_rates) {
          const DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 480]
          for (const [device_type, rate] of Object.entries(b.hourly_rates)) {
            const hRate = Number(rate) || 0
            if (hRate <= 0) continue
            const halfHourRate = Math.round((hRate * 0.65) / 5) * 5
            for (const d of DURATIONS) {
              const fullHours = Math.floor(d / 60)
              const hasHalfHour = (d % 60) === 30
              const price = (fullHours * hRate) + (hasHalfHour ? halfHourRate : 0)
              await client.query(`
                INSERT INTO pricing (device_type, duration_mins, price)
                VALUES ($1, $2, $3)
                ON CONFLICT (device_type, duration_mins) DO UPDATE
                  SET price = EXCLUDED.price
              `, [device_type, d, price])
            }
          }
        } else {
          const rules = b.pricing || (Array.isArray(b) ? b : [b])
          for (const rule of rules) {
            if (!rule.device_type || !rule.duration_mins || rule.price === undefined) continue
            await client.query(`
              INSERT INTO pricing (device_type, duration_mins, price)
              VALUES ($1, $2, $3)
              ON CONFLICT (device_type, duration_mins) DO UPDATE
                SET price = EXCLUDED.price
            `, [rule.device_type, Number(rule.duration_mins), Number(rule.price)])
          }
        }
        const r = await client.query('SELECT * FROM pricing ORDER BY device_type, duration_mins')
        return ok(res, { pricing: r.rows })
      }
    }

    // ─── SETTINGS ──────────────────────────────────────────────
    if (resource === 'settings') {
      if (req.method === 'GET') {
        // Auto-sync real organization name and admin email from public.tenants if available
        try {
          const tRes = await pool.query('SELECT name, admin_email FROM public.tenants WHERE schema_name = $1', [schemaName])
          if (tRes.rows.length > 0 && tRes.rows[0].name) {
            const orgName = tRes.rows[0].name
            const curSetting = await client.query("SELECT value FROM settings WHERE key = 'cafe_name'")
            if (curSetting.rows.length === 0 || curSetting.rows[0].value === 'Nexus Gaming Lounge' || !curSetting.rows[0].value) {
              await client.query(`
                INSERT INTO settings (key, value)
                VALUES ('cafe_name', $1)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
              `, [orgName])
            }
          }
        } catch (e) {
          console.error('Error syncing organization name to settings:', e)
        }

        const r = await client.query('SELECT * FROM settings ORDER BY key')
        return ok(res, { settings: r.rows })
      }
      if (req.method === 'POST') {
        const b = req.body || {}
        const list = Array.isArray(b.settings) ? b.settings : []
        for (const s of list) {
          await client.query(`
            INSERT INTO settings (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE
              SET value = EXCLUDED.value
          `, [s.key, String(s.value)])
        }

        // If cafe_name was updated by admin, sync back to public.tenants
        const updatedName = list.find(s => s.key === 'cafe_name')?.value
        if (updatedName) {
          try {
            await pool.query('UPDATE public.tenants SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE schema_name = $2', [String(updatedName).trim(), schemaName])
          } catch (e) {}
        }

        const r = await client.query('SELECT * FROM settings ORDER BY key')
        return ok(res, { settings: r.rows })
      }
    }

    // Purge is strictly forbidden on tenant endpoint; only platform Super Admin can perform resets.
    if (resource === 'purge') {
      return err(res, 'Access Denied: Only Super Admin is authorized to purge or reset tenant transaction ledgers.', 403)
    }

    return err(res, 'Unknown resource or method', 400)
  })
}

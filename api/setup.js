import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const resource = req.query.resource

  return withTenantClient(pool, req, res, async (client) => {
    // ─── DEVICES ───────────────────────────────────────────────
    if (resource === 'devices') {
      if (req.method === 'GET') {
        const r = await client.query('SELECT * FROM devices WHERE is_active = TRUE ORDER BY type, id')
        return ok(res, { devices: r.rows })
      }
      if (req.method === 'POST') {
        const b = req.body || {}
        if (!b.label || !b.type) return err(res, 'Label and type are required', 400)
        const r = await client.query(
          `INSERT INTO devices (label, type) VALUES ($1, $2) RETURNING *`,
          [b.label.trim(), b.type]
        )
        return ok(res, { device: r.rows[0] }, 201)
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
        const r = await client.query('SELECT * FROM pricing ORDER BY device_type, duration_mins')
        return ok(res, { pricing: r.rows })
      }
    }

    // ─── SETTINGS ──────────────────────────────────────────────
    if (resource === 'settings') {
      if (req.method === 'GET') {
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
        const r = await client.query('SELECT * FROM settings ORDER BY key')
        return ok(res, { settings: r.rows })
      }
    }

    // ─── PURGE TRANSACTIONAL TEST DATA ─────────────────────────
    if (resource === 'purge' && req.method === 'POST') {
      await client.query('BEGIN')
      try {
        await client.query(`
          TRUNCATE TABLE sale_items, sales, session_payments, session_players, sessions,
                         recharges, expenses, day_openings, shift_closings CASCADE;
          UPDATE inventory_items SET stock_qty = 0;
        `)
        await client.query('COMMIT')
        return ok(res, { success: true, message: 'All transactional data purged successfully' })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    return err(res, 'Unknown resource or method', 400)
  })
}

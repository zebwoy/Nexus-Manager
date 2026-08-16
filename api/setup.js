import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const resource = req.query.resource || (req.url.includes('devices') ? 'devices' : req.url.includes('pricing') ? 'pricing' : 'settings')

  try {
    // ─── DEVICES ─────────────────────────────────────────────
    if (resource === 'devices') {
      const r = await pool.query('SELECT * FROM devices ORDER BY type, label')
      return ok(res, { devices: r.rows })
    }

    // ─── PRICING ─────────────────────────────────────────────
    if (resource === 'pricing') {
      const r = await pool.query('SELECT * FROM pricing ORDER BY device_type, duration_mins')
      return ok(res, { pricing: r.rows })
    }

    // ─── SETTINGS ────────────────────────────────────────────
    if (resource === 'settings') {
      if (req.method === 'GET') {
        const r = await pool.query('SELECT * FROM settings')
        return ok(res, { settings: r.rows })
      }
      if (req.method === 'POST') {
        const { settings } = req.body || {}
        if (Array.isArray(settings)) {
          for (const s of settings) {
            await pool.query('UPDATE settings SET value = $1 WHERE key = $2', [s.value, s.key])
          }
        }
        return ok(res, { success: true })
      }
    // ─── PURGE TEST DATA ─────────────────────────────────────
    if (resource === 'purge' || req.url.includes('purge')) {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
      await pool.query(`
        TRUNCATE TABLE session_payments, pancafe_sessions, sale_items, sales, recharges, expenses, day_openings, sessions CASCADE;
        DELETE FROM customers WHERE id NOT IN (SELECT DISTINCT customer_id FROM sales WHERE customer_id IS NOT NULL);
      `)
      return ok(res, { success: true, message: 'All transactional test data successfully purged.' })
    }

    return err(res, 'Invalid setup resource', 400)

  } catch (e) {
    console.error(e)
    return err(res, 'Server error', 500)
  }
}

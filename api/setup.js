import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  try {
    const pool = getPool()
    const userId = req.headers['x-user-id']
    const resource = req.query.resource || (req.url.includes('devices') ? 'devices' : req.url.includes('pricing') ? 'pricing' : 'settings')

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

    // ─── PLATFORMS ────────────────────────────────────────────
    if (resource === 'platforms') {
      if (req.method === 'GET') {
        const r = await pool.query('SELECT * FROM recharge_platforms WHERE is_active = TRUE ORDER BY name')
        return ok(res, { platforms: r.rows })
      }
      if (req.method === 'POST') {
        const b = req.body || {}
        if (!b.name?.trim()) return err(res, 'Platform name is required', 400)
        const r = await pool.query(
          `INSERT INTO recharge_platforms (name, description) VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET is_active = TRUE RETURNING *`,
          [b.name.trim(), b.description || null]
        )
        return ok(res, { platform: r.rows[0] }, 201)
      }
      if (req.method === 'DELETE') {
        const id = req.query.id
        await pool.query(`UPDATE recharge_platforms SET is_active = FALSE WHERE id = $1`, [Number(id)])
        return ok(res, { success: true })
      }
      return err(res, 'Method not allowed', 405)
    }

    // ─── SETTINGS ────────────────────────────────────────────
    if (resource === 'settings') {
      if (req.method === 'GET') {
        const r = await pool.query('SELECT * FROM settings')
        return ok(res, { settings: r.rows })
      }
      if (req.method === 'POST') {
        const { settings } = req.body || {}
        const currentOperator = req.headers['x-username']
        
        // Trial users: simulate the config update without writing to DB
        if (currentOperator === 'trial') {
          await pool.query(
            `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,$3,$4)`,
            [userId || null, 'trial', 'UPDATE_SETTINGS', '[SIMULATED] Attempted settings update']
          )
          return ok(res, { success: true })
        }

        if (Array.isArray(settings)) {
          for (const s of settings) {
            await pool.query('UPDATE settings SET value = $1 WHERE key = $2', [s.value, s.key])
          }
        }
        await pool.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,$3,$4)`,
          [userId || null, req.headers['x-username'] || 'system', 'UPDATE_SETTINGS', 'Updated configurations']
        )
        return ok(res, { success: true })
      }
      return err(res, 'Method not allowed', 405)
    }

    // ─── PURGE TEST DATA ─────────────────────────────────────
    if (resource === 'purge' || req.url.includes('purge')) {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
      
      const isTrialOperator = req.headers['x-username'] === 'trial'
      
      if (isTrialOperator) {
        const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
        const trialUserId = trialUserRes.rows[0]?.id
        
        if (trialUserId) {
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            await client.query(`DELETE FROM session_payments WHERE session_id IN (SELECT id FROM sessions WHERE created_by = $1)`, [trialUserId])
            await client.query(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE created_by = $1)`, [trialUserId])
            await client.query(`DELETE FROM sales WHERE created_by = $1`, [trialUserId])
            await client.query(`DELETE FROM sessions WHERE created_by = $1`, [trialUserId])
            await client.query(`DELETE FROM pancafe_sessions WHERE created_by = $1`, [trialUserId])
            await client.query(`DELETE FROM recharges WHERE created_by = $1`, [trialUserId])
            await client.query(`DELETE FROM expenses WHERE created_by = $1`, [trialUserId])
            await client.query(`DELETE FROM day_openings WHERE created_by = $1`, [trialUserId])
            await client.query(`DELETE FROM inventory_items WHERE created_by = $1`, [trialUserId])
            // Only delete customers that are no longer referenced by ANY table with a FK to customers
            await client.query(`
              DELETE FROM customers
              WHERE id NOT IN (SELECT DISTINCT customer_id FROM sales          WHERE customer_id IS NOT NULL)
              AND   id NOT IN (SELECT DISTINCT customer_id FROM sessions       WHERE customer_id IS NOT NULL)
              AND   id NOT IN (SELECT DISTINCT customer_id FROM recharges      WHERE customer_id IS NOT NULL)
              AND   id NOT IN (SELECT DISTINCT customer_id FROM pancafe_sessions WHERE customer_id IS NOT NULL)
            `)
            await client.query('COMMIT')
          } catch (e) {
            await client.query('ROLLBACK')
            throw e
          } finally {
            client.release()
          }
        }
        
        await pool.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,$3,$4)`,
          [userId || null, 'trial', 'PURGE_DATA', 'Purged trial operator session data']
        )
        return ok(res, { success: true, message: 'Trial session data successfully purged.' })
      } else {
        // Full production purge (only triggered by real production admin)
        await pool.query(`
          TRUNCATE TABLE session_payments, pancafe_sessions, sale_items, sales, recharges, expenses, day_openings, sessions, inventory_items CASCADE;
          DELETE FROM customers WHERE id NOT IN (SELECT DISTINCT customer_id FROM sales WHERE customer_id IS NOT NULL)
                                 AND id NOT IN (SELECT DISTINCT customer_id FROM sessions WHERE customer_id IS NOT NULL);
        `)
        await pool.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,$3,$4)`,
          [userId || null, req.headers['x-username'] || 'system', 'PURGE_DATA', 'Purged all test data']
        )
        return ok(res, { success: true, message: 'All transactional test data successfully purged.' })
      }
    }

    return err(res, 'Invalid setup resource', 400)
  } catch (e) {
    console.error(e)
    return err(res, e, 500)
  }
}


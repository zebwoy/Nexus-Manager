import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const userId = req.headers['x-user-id']
  const username = req.headers['x-username']

  // ─── Route: /api/recharges/:id (PATCH & DELETE) ──────────────
  const rawUrl = req.url || ''
  const idMatch = rawUrl.match(/\/recharges\/(\d+)/) || String(req.query.path || '').match(/^(\d+)/)
  const rechargeId = idMatch ? Number(idMatch[1]) : null

  if (rechargeId) {
    if (req.method === 'PATCH') {
      try {
        const b = req.body || {}
        const updates = []
        const vals = []
        let idx = 1
        if (b.game_platform !== undefined) { updates.push(`game_platform = $${idx++}`); vals.push(b.game_platform) }
        if (b.cost_price    !== undefined) { updates.push(`cost_price    = $${idx++}`); vals.push(Number(b.cost_price)) }
        if (b.charge_price  !== undefined) { updates.push(`charge_price  = $${idx++}`); vals.push(Number(b.charge_price)) }
        if (b.payment_received !== undefined) { updates.push(`payment_received = $${idx++}`); vals.push(Number(b.payment_received)) }
        if (b.note          !== undefined) { updates.push(`note          = $${idx++}`); vals.push(b.note) }
        if (b.date          !== undefined) { updates.push(`date          = $${idx++}`); vals.push(b.date) }
        if (updates.length === 0) return err(res, 'No fields to update', 400)

        vals.push(rechargeId)
        await pool.query(`UPDATE recharges SET ${updates.join(', ')} WHERE id = $${idx}`, vals)

        // Audit
        await pool.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,'RECHARGE_EDIT',$3)`,
          [Number(userId), username || 'system', `Edited recharge #${rechargeId}`]
        )
        return ok(res, { success: true })
      } catch (e) {
        console.error(e)
        return err(res, e, 500)
      }
    }

    if (req.method === 'DELETE') {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const rR = await client.query(
          `SELECT r.*, c.name AS customer_name FROM recharges r LEFT JOIN customers c ON c.id = r.customer_id WHERE r.id = $1`,
          [rechargeId]
        )
        if (rR.rowCount === 0) { await client.query('ROLLBACK'); return err(res, 'Recharge not found', 404) }
        const rc = rR.rows[0]

        await client.query(`DELETE FROM recharges WHERE id = $1`, [rechargeId])
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,'RECHARGE_DELETE',$3)`,
          [Number(userId), username || 'system',
           `Deleted recharge #${rechargeId} | Customer: ${rc.customer_name || 'N/A'} | Platform: ${rc.game_platform} | Charge: ₹${rc.charge_price}`]
        )
        await client.query('COMMIT')
        return ok(res, { success: true })
      } catch (e) {
        await client.query('ROLLBACK')
        console.error(e)
        return err(res, e, 500)
      } finally { client.release() }
    }
  }

  // ─── Base Collection Routes ───────────────────────────────────
  try {

    if (req.method === 'GET') {
      const date = req.query.date
      const currentOperator = req.headers['x-username']
      let q = `SELECT r.*, (COALESCE(r.charge_price, 0) - COALESCE(r.cost_price, 0)) AS margin,
                      c.name, u.username AS created_by_username
               FROM recharges r LEFT JOIN customers c ON c.id = r.customer_id
               LEFT JOIN users u ON u.id = r.created_by`
      const vals = []
      const clauses = []

      if (currentOperator === 'trial') {
        clauses.push(`u.username = 'trial'`)
      } else {
        clauses.push(`(u.username IS NULL OR u.username <> 'trial')`)
      }

      if (date) {
        clauses.push(`r.date = $${vals.length + 1}`)
        vals.push(date)
      }

      if (clauses.length > 0) q += ` WHERE ` + clauses.join(' AND ')
      q += ` ORDER BY r.created_at DESC`
      const r = await pool.query(q, vals)
      return ok(res, { recharges: r.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      let cid = b.customer_id
      if (!cid && b.name) {
        const ex = await pool.query('SELECT id FROM customers WHERE name ILIKE $1', [b.name.trim()])
        if (ex.rows.length > 0) cid = ex.rows[0].id
        else {
          const nc = await pool.query('INSERT INTO customers (name, mobile) VALUES ($1,$2) RETURNING id', [b.name.trim(), b.mobile || null])
          cid = nc.rows[0].id
        }
      }
      await pool.query(
        `INSERT INTO recharges (customer_id, date, game_platform, cost_price, charge_price, payment_received, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [cid, b.date, b.game_platform || null, b.cost_price, b.charge_price, b.payment_received || null, b.note || null, userId || null]
      )
      return ok(res, { success: true }, 201)
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err(res, 'Server error', 500)
  }
}

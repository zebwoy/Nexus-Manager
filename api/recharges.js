import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const userId = req.headers['x-user-id']

  try {
    if (req.method === 'GET') {
      const date = req.query.date
      let q = `SELECT r.*, c.name, u.username AS created_by_username
               FROM recharges r LEFT JOIN customers c ON c.id = r.customer_id
               LEFT JOIN users u ON u.id = r.created_by`
      const vals = []
      if (date) { q += ` WHERE r.date = $1`; vals.push(date) }
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

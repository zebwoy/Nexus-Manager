import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const userId = req.headers['x-user-id']

  try {
    if (req.method === 'GET') {
      const date = req.query.date
      let q = `SELECT e.*, u.username AS created_by_username FROM expenses e LEFT JOIN users u ON u.id = e.created_by`
      const vals = []
      if (date) { q += ` WHERE e.date = $1`; vals.push(date) }
      q += ` ORDER BY e.created_at DESC`
      const r = await pool.query(q, vals)
      return ok(res, { expenses: r.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      await pool.query(
        `INSERT INTO expenses (date, category, amount, note, payment_method, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [b.date, b.category, b.amount, b.note || null, b.payment_method || 'cash', userId || null]
      )
      return ok(res, { success: true }, 201)
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err(res, 'Server error', 500)
  }
}

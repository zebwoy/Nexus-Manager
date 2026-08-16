import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  try {
    const pool = getPool()
    const result = await pool.query('SELECT NOW()')
    return ok(res, { success: true, time: result.rows[0].now })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, stack: e.stack })
  }
}

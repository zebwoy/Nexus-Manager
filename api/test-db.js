import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  try {
    const pool = getPool()
    const timeRes = await pool.query('SELECT NOW()')
    const usersRes = await pool.query('SELECT id, full_name, username, role, created_at FROM users')
    const settingsRes = await pool.query('SELECT * FROM settings')
    return ok(res, {
      success: true,
      time: timeRes.rows[0].now,
      users: usersRes.rows,
      settings: settingsRes.rows
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, stack: e.stack })
  }
}


import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  try {
    const pool = getPool()
    const action = req.query.action

    // ─── LOGIN: POST /api/auth-login ──────────────────────────────
    if (action === 'login' || req.url.includes('auth-login')) {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
      const { username, pin } = req.body || {}
      if (!username || !pin) return err(res, 'Username and PIN required')

      let result
      try {
        result = await pool.query(
          'SELECT id, full_name, username, COALESCE(role, \'operator\') AS role FROM users WHERE username = $1 AND pin = $2',
          [String(username).toLowerCase().trim(), String(pin)]
        )
      } catch {
        result = await pool.query(
          'SELECT id, full_name, username FROM users WHERE username = $1 AND pin = $2',
          [String(username).toLowerCase().trim(), String(pin)]
        )
        if (result.rows[0]) {
          result.rows[0].role = result.rows[0].username === 'trial' ? 'admin' : 'operator'
        }
      }
      
      if (result.rows.length === 0) return err(res, 'Invalid username or PIN', 401)
      return ok(res, { user: result.rows[0] })
    }

    // ─── USERS: GET, POST, DELETE /api/users ─────────────────────
    if (req.method === 'GET') {
      let result
      try {
        result = await pool.query('SELECT id, full_name, username, COALESCE(role, \'operator\') AS role, created_at FROM users ORDER BY created_at')
      } catch {
        result = await pool.query('SELECT id, full_name, username, created_at FROM users ORDER BY created_at')
        result.rows = result.rows.map(u => ({ ...u, role: u.username === 'trial' ? 'admin' : 'operator' }))
      }
      return ok(res, { users: result.rows })
    }

    if (req.method === 'POST') {
      const { full_name, username, pin, role } = req.body || {}
      if (!full_name || !username || !pin) return err(res, 'All fields required')
      if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) return err(res, 'PIN must be exactly 4 digits')

      const existing = await pool.query('SELECT id FROM users WHERE username = $1', [String(username).toLowerCase()])
      if (existing.rows.length > 0) return err(res, 'Username already taken')

      let result
      try {
        result = await pool.query(
          'INSERT INTO users (full_name, username, pin, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, username, role',
          [String(full_name).trim(), String(username).toLowerCase().trim(), String(pin), role || 'operator']
        )
      } catch {
        result = await pool.query(
          'INSERT INTO users (full_name, username, pin) VALUES ($1, $2, $3) RETURNING id, full_name, username',
          [String(full_name).trim(), String(username).toLowerCase().trim(), String(pin)]
        )
        if (result.rows[0]) result.rows[0].role = role || 'operator'
      }
      return ok(res, { user: result.rows[0] }, 201)
    }

    if (req.method === 'PUT') {
      const id = req.query.id
      const { pin } = req.body || {}
      if (!id || !pin) return err(res, 'User ID and PIN are required')
      if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) return err(res, 'PIN must be exactly 4 digits')
      await pool.query('UPDATE users SET pin = $1 WHERE id = $2', [String(pin), Number(id)])
      return ok(res, { success: true, message: 'Security PIN reset successfully.' })
    }

    if (req.method === 'DELETE') {
      const id = req.query.id
      if (!id) return err(res, 'User ID required')
      await pool.query('DELETE FROM users WHERE id = $1', [Number(id)])
      return ok(res, { success: true })
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err(res, e, 500)
  }
}




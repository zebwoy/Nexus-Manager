import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const action = req.query.action

  // ─── LOGIN: POST /api/auth-login ──────────────────────────────
  if (action === 'login' || req.url.includes('auth-login')) {
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
    try {
      const { username, pin } = req.body || {}
      if (!username || !pin) return err(res, 'Username and PIN required')

      const result = await pool.query(
        'SELECT id, full_name, username, role FROM users WHERE username = $1 AND pin = $2',
        [String(username).toLowerCase().trim(), String(pin)]
      )
      if (result.rows.length === 0) return err(res, 'Invalid username or PIN', 401)
      return ok(res, { user: result.rows[0] })
    } catch (e) {
      console.error(e)
      return err(res, e, 500)
    }
  }

  // ─── USERS: GET, POST, DELETE /api/users ─────────────────────
  try {
    if (req.method === 'GET') {
      const result = await pool.query('SELECT id, full_name, username, role, created_at FROM users ORDER BY created_at')
      return ok(res, { users: result.rows })
    }

    if (req.method === 'POST') {
      const { full_name, username, pin, role } = req.body || {}
      if (!full_name || !username || !pin) return err(res, 'All fields required')
      if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) return err(res, 'PIN must be exactly 4 digits')

      const existing = await pool.query('SELECT id FROM users WHERE username = $1', [String(username).toLowerCase()])
      if (existing.rows.length > 0) return err(res, 'Username already taken')

      const result = await pool.query(
        'INSERT INTO users (full_name, username, pin, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, username, role',
        [String(full_name).trim(), String(username).toLowerCase().trim(), String(pin), role || 'staff']
      )
      return ok(res, { user: result.rows[0] }, 201)
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


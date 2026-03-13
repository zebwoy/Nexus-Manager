import { getPool, ok, err, cors } from './_db.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()

  try {
    if (event.httpMethod === 'GET') {
      const result = await pool.query('SELECT id, full_name, username, created_at FROM users ORDER BY created_at')
      return ok({ users: result.rows })
    }

    if (event.httpMethod === 'POST') {
      const { full_name, username, pin } = JSON.parse(event.body || '{}')
      if (!full_name || !username || !pin) return err('All fields required')
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return err('PIN must be exactly 4 digits')

      const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()])
      if (existing.rows.length > 0) return err('Username already taken')

      const result = await pool.query(
        'INSERT INTO users (full_name, username, pin) VALUES ($1, $2, $3) RETURNING id, full_name, username',
        [full_name.trim(), username.toLowerCase().trim(), pin]
      )
      return ok({ user: result.rows[0] }, 201)
    }

    return err('Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err('Server error', 500)
  }
}

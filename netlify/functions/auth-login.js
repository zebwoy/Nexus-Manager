import { getPool, ok, err, cors } from './_db.js'

// POST /api/auth-login
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()

  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  try {
    const { username, pin } = JSON.parse(event.body || '{}')
    if (!username || !pin) return err('Username and PIN required')

    const pool = getPool()
    const result = await pool.query(
      'SELECT id, full_name, username FROM users WHERE username = $1 AND pin = $2',
      [username.toLowerCase().trim(), pin]
    )

    if (result.rows.length === 0) return err('Invalid username or PIN', 401)

    return ok({ user: result.rows[0] })
  } catch (e) {
    console.error(e)
    return err('Server error', 500)
  }
}

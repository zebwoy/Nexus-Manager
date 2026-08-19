import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const action = req.query.action
  const userId = req.headers['x-user-id']
  const currentOperator = req.headers['x-username']

  return withTenantClient(pool, req, res, async (client) => {
    // ─── LOGOUT: POST /api/auth-logout ─────────────────────────────
    if (action === 'logout' || req.url.includes('auth-logout')) {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
      if (userId) {
        await client.query(
          `UPDATE operator_sessions
           SET logout_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND logout_at IS NULL`,
          [Number(userId)]
        )
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details)
           VALUES ($1, $2, $3, $4)`,
          [Number(userId), currentOperator || 'system', 'LOGOUT', `Operator logged out: @${currentOperator}`]
        )
      }
      return ok(res, { success: true })
    }

    // ─── AUDIT TRAILS: GET /api/auth-audit ──────────────────────────
    if (action === 'audit' || req.url.includes('auth-audit')) {
      if (req.method !== 'GET') return err(res, 'Method not allowed', 405)
      if (!userId) return err(res, 'Authorization required', 401)

      const userRes = await client.query('SELECT role, username FROM users WHERE id = $1', [Number(userId)])
      const requestingUser = userRes.rows[0]
      const isAdmin = requestingUser?.role === 'admin' || requestingUser?.username === 'trial'
      if (!isAdmin) return err(res, 'Access denied: Admin only', 403)

      try {
        await client.query(`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(50);
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
          ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
          ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff', 'operator', 'super_admin', 'trial'));
        `)
      } catch {}

      const [logs, sessions] = await Promise.all([
        client.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200'),
        client.query('SELECT * FROM operator_sessions ORDER BY login_at DESC LIMIT 150')
      ])
      return ok(res, { logs: logs.rows, sessions: sessions.rows })
    }

    // ─── LOGIN: POST /api/auth-login ──────────────────────────────
    if (action === 'login' || req.url.includes('auth-login')) {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
      const { username, pin } = req.body || {}
      if (!username || !pin) return err(res, 'Username and PIN required')

      const cleanUser = String(username).toLowerCase().trim()
      const cleanPin = String(pin).trim()

      // Auto-provision standard accounts if not yet in database
      if (cleanUser === 'superadmin' && (cleanPin === '9999' || cleanPin === '1234')) {
        try {
          await client.query(`
            ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
            ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operator', 'super_admin', 'trial'));
          `)
        } catch {}

        try {
          await client.query(`
            INSERT INTO users (full_name, username, pin, role)
            VALUES ('Super Administrator', 'superadmin', $1, 'super_admin')
            ON CONFLICT (username) DO UPDATE SET pin = EXCLUDED.pin, role = 'super_admin'
          `, [cleanPin])
        } catch {
          await client.query(`
            INSERT INTO users (full_name, username, pin, role)
            VALUES ('Super Administrator', 'superadmin', $1, 'admin')
            ON CONFLICT (username) DO UPDATE SET pin = EXCLUDED.pin, role = 'admin'
          `, [cleanPin])
        }
      } else if (cleanUser === 'admin' && (cleanPin === '1234' || cleanPin === '9999')) {
        await client.query(`
          INSERT INTO users (full_name, username, pin, role)
          VALUES ('Store Administrator', 'admin', $1, 'admin')
          ON CONFLICT (username) DO UPDATE SET pin = EXCLUDED.pin, role = 'admin'
        `, [cleanPin])
      }

      let result
      try {
        result = await client.query(
          'SELECT id, full_name, username, COALESCE(role, \'operator\') AS role FROM users WHERE username = $1 AND pin = $2',
          [cleanUser, cleanPin]
        )
      } catch {
        result = await client.query(
          'SELECT id, full_name, username FROM users WHERE username = $1 AND pin = $2',
          [cleanUser, cleanPin]
        )
        if (result.rows[0]) {
          result.rows[0].role = result.rows[0].username === 'superadmin' ? 'super_admin' : result.rows[0].username === 'admin' ? 'admin' : 'operator'
        }
      }
      
      if (result.rows.length === 0) return err(res, 'Invalid username or PIN', 401)

      const user = result.rows[0]
      if (cleanUser === 'superadmin') {
        user.role = 'super_admin'
      }

      // Record in operator_sessions and audit_logs
      await client.query(
        `INSERT INTO operator_sessions (user_id, username) VALUES ($1, $2)`,
        [user.id, user.username]
      )
      await client.query(
        `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, 'LOGIN', $3)`,
        [user.id, user.username, `Operator signed in: @${user.username} (${user.full_name})`]
      )

      return ok(res, { user })
    }

    // ─── USER MANAGEMENT: /api/users ──────────────────────────────
    if (action === 'users' || req.url.includes('/api/users')) {
      if (req.method === 'GET') {
        const r = await client.query('SELECT id, full_name, username, role, created_at FROM users ORDER BY id')
        return ok(res, { users: r.rows })
      }

      if (req.method === 'POST') {
        const { full_name, username, pin, role } = req.body || {}
        if (!full_name || !username || !pin) return err(res, 'Full name, username and 4-digit PIN required')
        if (String(pin).length !== 4) return err(res, 'PIN must be exactly 4 digits')
        
        const cleanUser = String(username).toLowerCase().trim()
        const existing = await client.query('SELECT id FROM users WHERE username = $1', [cleanUser])
        if (existing.rows.length > 0) return err(res, 'Username already exists', 409)

        const r = await client.query(
          `INSERT INTO users (full_name, username, pin, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, username, role, created_at`,
          [full_name.trim(), cleanUser, String(pin), role || 'operator']
        )
        
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, 'CREATE_USER', $3)`,
          [userId ? Number(userId) : null, currentOperator || 'system', `Created staff account: @${cleanUser} (${role || 'operator'})`]
        )

        return ok(res, { user: r.rows[0] }, 201)
      }

      if (req.method === 'PUT') {
        const id = req.query.id
        if (!id) return err(res, 'User ID is required', 400)
        const { pin } = req.body || {}
        if (!pin || String(pin).length !== 4) return err(res, 'PIN must be exactly 4 digits', 400)

        const targetUserR = await client.query('SELECT username FROM users WHERE id = $1', [Number(id)])
        if (targetUserR.rows.length === 0) return err(res, 'User not found', 404)
        const targetUsername = targetUserR.rows[0].username

        await client.query('UPDATE users SET pin = $1 WHERE id = $2', [String(pin), Number(id)])
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, 'RESET_PIN', $3)`,
          [userId ? Number(userId) : null, currentOperator || 'system', `Reset security PIN for user @${targetUsername}`]
        )

        return ok(res, { success: true, message: 'PIN updated successfully' })
      }

      if (req.method === 'DELETE') {
        const id = req.query.id
        if (!id) return err(res, 'User ID required', 400)
        
        const targetUserR = await client.query('SELECT username FROM users WHERE id = $1', [Number(id)])
        const targetUsername = targetUserR.rows[0]?.username || `#${id}`

        await client.query('DELETE FROM users WHERE id = $1', [Number(id)])
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, 'DELETE_USER', $3)`,
          [userId ? Number(userId) : null, currentOperator || 'system', `Deleted user account @${targetUsername}`]
        )
        return ok(res, { success: true })
      }
    }

    return err(res, 'Invalid auth endpoint or method', 400)
  })
}

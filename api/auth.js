import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  try {
    const pool = getPool()
    const action = req.query.action
    const userId = req.headers['x-user-id']
    const currentOperator = req.headers['x-username']

    // ─── INITIALIZATION / MIGRATIONS ─────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          user_id INT,
          username VARCHAR(100),
          action VARCHAR(100) NOT NULL,
          details TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS operator_sessions (
          id SERIAL PRIMARY KEY,
          user_id INT,
          username VARCHAR(100) NOT NULL,
          login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          logout_at TIMESTAMP WITH TIME ZONE
      );
      CREATE TABLE IF NOT EXISTS recharge_platforms (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `)
    // Seed default platforms if empty
    await pool.query(`
      INSERT INTO recharge_platforms (name, description) VALUES
        ('PSN', 'PlayStation Network'),
        ('Xbox Live', 'Xbox/Microsoft Gaming'),
        ('Steam', 'Valve Steam Platform'),
        ('EA Play', 'EA Games Subscription'),
        ('GamePass', 'Xbox Game Pass')
      ON CONFLICT (name) DO NOTHING;
    `)

    try {
      await pool.query(`
        ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
        ALTER TABLE expenses ADD CONSTRAINT expenses_category_check CHECK (category IN ('Marketing', 'Employee', 'Inventory', 'Other', 'Cafeteria'));
        ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id);

        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

        ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_payment_method_check;
        ALTER TABLE sessions ADD CONSTRAINT sessions_payment_method_check CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed'));

        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
        ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('cash', 'online', 'credit', 'split', 'mixed'));
      `)
    } catch (e) {
      console.error('Failed to update constraints:', e)
    }

    // ─── LOGOUT: POST /api/auth-logout ─────────────────────────────
    if (action === 'logout' || req.url.includes('auth-logout')) {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
      if (userId) {
        await pool.query(
          `UPDATE operator_sessions
           SET logout_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND logout_at IS NULL`,
          [Number(userId)]
        )
        await pool.query(
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

      const userRes = await pool.query('SELECT role, username FROM users WHERE id = $1', [Number(userId)])
      const requestingUser = userRes.rows[0]
      const isAdmin = requestingUser?.role === 'admin' || requestingUser?.username === 'trial'
      if (!isAdmin) return err(res, 'Access denied: Admin only', 403)

      const [logs, sessions] = await Promise.all([
        pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 150'),
        pool.query('SELECT * FROM operator_sessions ORDER BY login_at DESC LIMIT 150')
      ])
      return ok(res, { logs: logs.rows, sessions: sessions.rows })
    }

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
      
      const loggedUser = result.rows[0]
      // Record login session
      await pool.query(
        'INSERT INTO operator_sessions (user_id, username) VALUES ($1, $2)',
        [loggedUser.id, loggedUser.username]
      )
      // Record audit log
      await pool.query(
        'INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
        [loggedUser.id, loggedUser.username, 'LOGIN', `Operator logged in: @${loggedUser.username}`]
      )

      return ok(res, { user: loggedUser })
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

      if (currentOperator === 'trial') {
        await pool.query(
          'INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
          [userId || null, 'trial', 'CREATE_USER', `[SIMULATED] Created staff account: @${username}`]
        )
        return ok(res, { user: { id: 999, full_name, username, role: role || 'operator' } }, 201)
      }

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

      await pool.query(
        'INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
        [userId || null, currentOperator || 'system', 'CREATE_USER', `Created staff account: @${username}`]
      )

      return ok(res, { user: result.rows[0] }, 201)
    }

    if (req.method === 'PUT') {
      const id = req.query.id
      const { pin } = req.body || {}
      if (!id || !pin) return err(res, 'User ID and PIN are required')
      if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) return err(res, 'PIN must be exactly 4 digits')
      
      const userToReset = await pool.query('SELECT username FROM users WHERE id = $1', [Number(id)])
      
      if (currentOperator === 'trial') {
        await pool.query(
          'INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
          [userId || null, 'trial', 'RESET_PIN', `[SIMULATED] Reset PIN for staff: @${userToReset.rows[0]?.username || id}`]
        )
        return ok(res, { success: true, message: 'Security PIN reset successfully.' })
      }

      await pool.query('UPDATE users SET pin = $1 WHERE id = $2', [String(pin), Number(id)])

      await pool.query(
        'INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
        [userId || null, currentOperator || 'system', 'RESET_PIN', `Reset PIN for staff: @${userToReset.rows[0]?.username || id}`]
      )

      return ok(res, { success: true, message: 'Security PIN reset successfully.' })
    }

    if (req.method === 'DELETE') {
      const id = req.query.id
      if (!id) return err(res, 'User ID required')
      
      const userToDelete = await pool.query('SELECT username FROM users WHERE id = $1', [Number(id)])

      if (currentOperator === 'trial') {
        await pool.query(
          'INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
          [userId || null, 'trial', 'DELETE_USER', `[SIMULATED] Deleted staff account: @${userToDelete.rows[0]?.username || id}`]
        )
        return ok(res, { success: true })
      }

      await pool.query('DELETE FROM users WHERE id = $1', [Number(id)])

      await pool.query(
        'INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
        [userId || null, currentOperator || 'system', 'DELETE_USER', `Deleted staff account: @${userToDelete.rows[0]?.username || id}`]
      )

      return ok(res, { success: true })
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err(res, e, 500)
  }
}




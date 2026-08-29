import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const action = req.query.action

  // ── Login is schema-self-resolving: extract before withTenantClient ──────────
  // At login time there are NO auth headers (no schema, no email, no org-id).
  // We parse the org slug from the username itself: hgc_operator@3 → slug 'hgc'
  // → query public.tenants → schema_name → query that schema.
  if (action === 'login' || req.url.includes('auth-login')) {
    return handleLogin(pool, req, res)
  }

  const userId = req.headers['x-user-id']
  const currentOperator = req.headers['x-username']

  return withTenantClient(pool, req, res, async (client) => {
    // ─── LOGOUT ───────────────────────────────────────────────────────────────
    if (action === 'logout' || req.url.includes('auth-logout')) {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
      if (userId) {
        await client.query(
          `UPDATE operator_sessions SET logout_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND logout_at IS NULL`,
          [Number(userId)]
        )
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
          [Number(userId), currentOperator || 'system', 'LOGOUT', `Operator logged out: @${currentOperator}`]
        )
      }
      return ok(res, { success: true })
    }

    // ─── AUDIT TRAILS ─────────────────────────────────────────────────────────
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
          ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operator', 'trial'));
        `)
      } catch {}

      const [logs, sessions] = await Promise.all([
        client.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200'),
        client.query('SELECT * FROM operator_sessions ORDER BY login_at DESC LIMIT 150')
      ])
      return ok(res, { logs: logs.rows, sessions: sessions.rows })
    }

    // ─── USER MANAGEMENT ──────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// handleLogin — SaaS-aware, no headers required
//
// Username convention: <slug>_<role>@<user_id>  e.g.  hgc_operator@3
// The slug is parsed from the username, used to look up the tenant schema,
// and the login query is scoped to that schema. Works for any tenant.
// ─────────────────────────────────────────────────────────────────────────────
async function handleLogin(pool, req, res) {
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405)
  const { username, pin } = req.body || {}
  if (!username || !pin) return err(res, 'Username and PIN required')

  const cleanUser = String(username).toLowerCase().trim()
  const cleanPin = String(pin).trim()

  // ── Platform super-admin bypass (no schema) ────────────────────────────────
  if (cleanUser === 'superadmin' && (cleanPin === '9999' || cleanPin === '1234')) {
    return ok(res, {
      user: {
        id: 0,
        full_name: 'Platform Super Administrator',
        username: 'superadmin',
        role: 'super_admin'
      }
    })
  }

  // ── Trial / sandbox user bypass ────────────────────────────────────────────
  if (cleanUser === 'trial' && cleanPin === '0000') {
    const { getTenantClient, DEMO_SANDBOX_SCHEMA, provisionDemoSandbox } = await import('./_tenant.js')
    const client2 = await pool.connect()
    try {
      await client2.query(`SET search_path TO "${DEMO_SANDBOX_SCHEMA}", public`)
      const r = await client2.query(
        `SELECT id, full_name, username, role, status FROM users WHERE username = 'trial' AND pin = '0000' LIMIT 1`
      )
      if (r.rows.length === 0) {
        // Provision sandbox first time
        client2.release()
        await provisionDemoSandbox(pool)
        // Re-fetch
        const client3 = await pool.connect()
        await client3.query(`SET search_path TO "${DEMO_SANDBOX_SCHEMA}", public`)
        const r2 = await client3.query(
          `SELECT id, full_name, username, role FROM users WHERE username = 'trial' LIMIT 1`
        )
        client3.release()
        const trialUser = r2.rows[0] || { id: 0, full_name: 'Demo Operator', username: 'trial', role: 'admin' }
        return ok(res, { user: { ...trialUser, schema_name: DEMO_SANDBOX_SCHEMA } })
      }
      return ok(res, { user: { ...r.rows[0], schema_name: DEMO_SANDBOX_SCHEMA } })
    } finally {
      try { client2.release() } catch {}
    }
  }

  // ── Parse slug from username: hgc_admin@1 → 'hgc' ─────────────────────
  const slugMatch = cleanUser.match(/^([a-z0-9_\-]+)_/)
  const parsedSlug = slugMatch ? slugMatch[1].toLowerCase() : ''

  // ── Resolve schema from slug / tenant registry ─────────────────────────────
  let tenantInfo = null
  let schemaName = null
  try {
    let tenantR
    if (parsedSlug) {
      tenantR = await pool.query(
        `SELECT name, slug, logo_url, schema_name, status
         FROM public.tenants
         WHERE slug = $1
            OR schema_name = $2
            OR schema_name = $1
            OR replace(slug, '-', '_') = $1
            OR org_id = $1
            OR slug ILIKE $1 || '%'
         ORDER BY CASE WHEN slug = $1 THEN 1 WHEN schema_name = $2 THEN 2 ELSE 3 END
         LIMIT 1`,
        [parsedSlug, `tenant_${parsedSlug}`]
      )
    }

    // If no match by slug, fallback to first active tenant (covers single-tenant deployments)
    if (!tenantR || tenantR.rows.length === 0) {
      tenantR = await pool.query(
        `SELECT name, slug, logo_url, schema_name, status FROM public.tenants WHERE status = 'active' ORDER BY id ASC LIMIT 1`
      )
    }

    if (tenantR.rows.length === 0) {
      return err(res, 'Organization not found. Check your username handle.', 401)
    }

    tenantInfo = tenantR.rows[0]
    if (tenantInfo.status === 'suspended') {
      return err(res, 'This organization account is suspended. Contact support.', 403)
    }
    schemaName = tenantInfo.schema_name
  } catch (e) {
    console.error('Tenant resolution error during login:', e)
    return err(res, 'Database connection error during organization lookup: ' + e.message, 500)
  }

  // ── Query the correct tenant schema ───────────────────────────────────────
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO "${schemaName}", public`)

    // Patch missing columns defensively (safe no-op if already exist)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
    `).catch(() => {})

    const result = await client.query(
      `SELECT id, full_name, username, COALESCE(role, 'operator') AS role, COALESCE(status, 'active') AS status
       FROM users
       WHERE (username = $1 OR username ILIKE '%' || $1 OR username = $2) AND pin = $3
       ORDER BY id ASC LIMIT 1`,
      [cleanUser, `${tenantInfo.slug || parsedSlug}_admin@1`, cleanPin]
    )

    if (result.rows.length === 0) {
      return err(res, 'Invalid username or PIN', 401)
    }

    const user = result.rows[0]
    if (user.status === 'suspended') {
      return err(res, 'Account suspended. Contact your cafe administrator.', 403)
    }

    // Record login in operator_sessions and audit_logs
    await client.query(
      `INSERT INTO operator_sessions (user_id, username) VALUES ($1, $2)`,
      [user.id, user.username]
    ).catch(() => {})
    await client.query(
      `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, 'LOGIN', $3)`,
      [user.id, user.username, `Operator signed in: @${user.username} (${user.full_name})`]
    ).catch(() => {})

    // Return tenant info so frontend stores it for branding and header display
    return ok(res, {
      user: {
        ...user,
        schema_name: schemaName,
        tenant_name: tenantInfo.name || '',
        tenant_logo: tenantInfo.logo_url || '',
        org_slug: tenantInfo.slug || parsedSlug
      }
    })
  } catch (e) {
    console.error('Tenant schema query error during login:', e)
    return err(res, 'Database error during authentication: ' + e.message, 500)
  } finally {
    client.release()
  }
}


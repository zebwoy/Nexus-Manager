import { getPool, ok, err } from './_db.js'
import { withTenantClient, resolveTenantSchema, ensureGlobalRegistry } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const action = req.query?.action

  // Ensure global tables exist
  try {
    await ensureGlobalRegistry(pool)
  } catch (e) {
    console.error('Error ensuring global registry:', e)
  }

  // ─── 1. Staff Member checking pending invites for their Clerk email ───
  if (action === 'my-invites' && req.method === 'GET') {
    const userEmail = req.headers['x-user-email'] || req.query?.email
    if (!userEmail) return err(res, 'User email is required', 400)

    try {
      // Check if user is already an admin of an active tenant
      const adminR = await pool.query(
        'SELECT org_id, name, slug, schema_name, status, plan FROM public.tenants WHERE admin_email ILIKE $1 AND status = $2',
        [userEmail.trim(), 'active']
      )

      // Check for staff memberships / invites
      const staffR = await pool.query(
        `SELECT os.id as invite_id, os.org_id, os.schema_name, os.staff_email, os.staff_name, os.status as membership_status, os.invited_by,
                t.name as tenant_name, t.slug as tenant_slug, t.status as tenant_status
         FROM public.organization_staff os
         JOIN public.tenants t ON os.schema_name = t.schema_name
         WHERE os.staff_email ILIKE $1
         ORDER BY os.id DESC`,
        [userEmail.trim()]
      )

      return ok(res, {
        admin_organizations: adminR.rows,
        staff_invites: staffR.rows
      })
    } catch (e) {
      console.error('Error fetching my-invites:', e)
      return err(res, e, 500)
    }
  }

  // ─── 2. Staff Member accepting an invite ───
  if (action === 'accept-invite' && req.method === 'POST') {
    const userEmail = req.headers['x-user-email']
    const { schema_name } = req.body || {}

    if (!userEmail || !schema_name) {
      return err(res, 'User email and schema name are required', 400)
    }

    try {
      const updateR = await pool.query(
        `UPDATE public.organization_staff
         SET status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE staff_email ILIKE $1 AND schema_name = $2
         RETURNING *`,
        [userEmail.trim(), schema_name]
      )

      if (updateR.rows.length === 0) {
        return err(res, 'No matching invitation found for this email', 404)
      }

      // Update tenant schema's users table
      await pool.query(`
        UPDATE "${schema_name}".users
        SET status = 'active'
        WHERE email ILIKE $1 OR username ILIKE $2
      `, [userEmail.trim(), userEmail.trim().split('@')[0]])

      // Fetch tenant details
      const tenantR = await pool.query('SELECT name, slug, schema_name FROM public.tenants WHERE schema_name = $1', [schema_name])
      const tenant = tenantR.rows[0] || { name: schema_name, schema_name }

      return ok(res, { success: true, message: `Joined ${tenant.name}!`, tenant })
    } catch (e) {
      console.error('Error accepting invite:', e)
      return err(res, e, 500)
    }
  }

  // ─── 3. Tenant-Scoped Staff Management (Admin Only) ───
  return withTenantClient(pool, req, res, async (client, schemaName) => {
    const callerUser = req.headers['x-username'] || 'admin'

    // GET /api/staff - List all staff accounts (strictly excluding platform superadmin)
    if (req.method === 'GET') {
      try {
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT")
      } catch {}

      // Purge any accidental superadmin from tenant users
      try {
        await client.query("DELETE FROM users WHERE role = 'super_admin' OR username = 'superadmin'")
      } catch {}

      // Auto-sync real admin name, correct handle (<slug>_admin), and avatar from Clerk/Google
      try {
        const tenantR = await pool.query('SELECT name, slug, admin_name, admin_email FROM public.tenants WHERE schema_name = $1', [schemaName])
        if (tenantR.rows.length > 0 && tenantR.rows[0].admin_email) {
          const t = tenantR.rows[0]
          const targetAdminUsername = `${t.slug}_admin`
          const targetOperatorUsername = `${t.slug}_operator`
          const incomingFullName = req.headers['x-user-fullname'] || req.headers['x-user-name']
          const incomingAvatar = req.headers['x-user-avatar']
          const emailPrefix = t.admin_email.split('@')[0].replace(/[^a-z0-9_]/gi, '')

          let realFullName = incomingFullName
          if (!realFullName || realFullName === 'Cafe Administrator' || realFullName.toLowerCase() === emailPrefix.toLowerCase()) {
            realFullName = t.admin_name && t.admin_name !== 'Cafe Administrator' && t.admin_name.toLowerCase() !== emailPrefix.toLowerCase()
              ? t.admin_name
              : (incomingFullName || t.admin_name || 'Cafe Administrator')
          }

          // Update public.tenants if real name is now known
          if (realFullName && realFullName !== 'Cafe Administrator' && realFullName !== t.admin_name) {
            await pool.query('UPDATE public.tenants SET admin_name = $1 WHERE schema_name = $2', [realFullName, schemaName])
          }

          // Check for existing admin rows in tenant schema
          const curAdminR = await client.query("SELECT id, username, full_name, email FROM users WHERE role = 'admin' ORDER BY id ASC")
          if (curAdminR.rows.length > 0) {
            const primaryAdmin = curAdminR.rows[0]
            await client.query(`
              UPDATE users
              SET username = $1,
                  full_name = $2,
                  email = $3,
                  avatar_url = COALESCE($4, avatar_url),
                  status = 'active'
              WHERE id = $5
            `, [targetAdminUsername, realFullName, t.admin_email, incomingAvatar || null, primaryAdmin.id])

            // If any duplicate admin rows were created with legacy usernames (e.g. 'imanriyaj' or 'admin'), delete them
            if (curAdminR.rows.length > 1) {
              const extraIds = curAdminR.rows.slice(1).map(r => r.id)
              await client.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [extraIds])
            }
          } else {
            // Also check if an account with matching email exists as non-admin
            const matchEmailR = await client.query("SELECT id FROM users WHERE email ILIKE $1", [t.admin_email])
            if (matchEmailR.rows.length > 0) {
              await client.query(`
                UPDATE users
                SET username = $1,
                    full_name = $2,
                    role = 'admin',
                    avatar_url = COALESCE($3, avatar_url),
                    status = 'active'
                WHERE id = $4
              `, [targetAdminUsername, realFullName, incomingAvatar || null, matchEmailR.rows[0].id])
            } else {
              // Insert standard admin account
              await client.query(`
                INSERT INTO users (full_name, username, pin, role, email, status, avatar_url)
                VALUES ($1, $2, '1234', 'admin', $3, 'active', $4)
                ON CONFLICT (username) DO UPDATE
                SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
              `, [realFullName, targetAdminUsername, t.admin_email, incomingAvatar || null])
            }
          }

          // Ensure standard operator account exists
          await client.query(`
            INSERT INTO users (full_name, username, pin, role, email, status)
            VALUES ('Counter Operator', $1, '1234', 'operator', NULL, 'active')
            ON CONFLICT (username) DO NOTHING;
          `, [targetOperatorUsername])

          // Clean up legacy placeholder accounts like 'staff' or '<slug>_staff'
          await client.query(`
            DELETE FROM users 
            WHERE username = 'staff' OR username = '${t.slug}_staff'
          `)
        }
      } catch (e) {
        console.error('Error syncing admin user:', e)
      }

      const usersR = await client.query(
        "SELECT id, full_name, username, pin, role, email, status, avatar_url, created_at FROM users WHERE role != 'super_admin' AND username != 'superadmin' ORDER BY id ASC"
      )
      const staffRegistryR = await pool.query(
        'SELECT * FROM public.organization_staff WHERE schema_name = $1',
        [schemaName]
      )

      return ok(res, {
        users: usersR.rows,
        invites: staffRegistryR.rows,
        schemaName
      })
    }

    // POST /api/staff - Invite a new staff member
    if (req.method === 'POST') {
      const { email, full_name, pin, role } = req.body || {}
      if (!email?.trim() || !full_name?.trim()) {
        return err(res, 'Staff full name and email are required', 400)
      }

      const cleanPin = pin && /^\d{4}$/.test(pin) ? pin : '1234'
      const username = email.trim().toLowerCase().split('@')[0].replace(/[^a-z0-9_]/g, '')
      const assignedRole = role === 'admin' ? 'admin' : 'operator'

      // 1. Insert/update in private tenant schema users table
      const userR = await client.query(
        `INSERT INTO users (full_name, username, pin, role, email, status)
         VALUES ($1, $2, $3, $4, $5, 'invited')
         ON CONFLICT (username) DO UPDATE
         SET full_name = EXCLUDED.full_name, pin = EXCLUDED.pin, role = EXCLUDED.role, email = EXCLUDED.email, status = 'invited'
         RETURNING *`,
        [full_name.trim(), username, cleanPin, assignedRole, email.trim().toLowerCase()]
      )

      // 2. Insert/update in public organization_staff registry
      await pool.query(
        `INSERT INTO public.organization_staff (schema_name, staff_email, staff_name, pin, status, invited_by)
         VALUES ($1, $2, $3, $4, 'invited', $5)
         ON CONFLICT (schema_name, staff_email) DO UPDATE
         SET staff_name = EXCLUDED.staff_name, pin = EXCLUDED.pin, status = 'invited', updated_at = CURRENT_TIMESTAMP`,
        [schemaName, email.trim().toLowerCase(), full_name.trim(), cleanPin, callerUser]
      )

      // 3. Log Granular Audit Trail
      await client.query(
        `INSERT INTO audit_logs (username, action, module, details, metadata)
         VALUES ($1, 'INVITE_STAFF', 'staff', $2, $3)`,
        [
          callerUser,
          `Invited staff member "${full_name}" (${email}) with 4-digit PIN`,
          JSON.stringify({ staff_email: email, full_name, role: assignedRole })
        ]
      )

      return ok(res, { success: true, user: userR.rows[0] }, 201)
    }

    // PATCH /api/staff?id=X - Update staff info, PIN, or toggle status
    if (req.method === 'PATCH') {
      const id = Number(req.query.id)
      if (!id) return err(res, 'User ID is required', 400)

      const { full_name, pin, role, status } = req.body || {}
      const curR = await client.query('SELECT * FROM users WHERE id = $1', [id])
      if (curR.rows.length === 0) return err(res, 'User not found', 404)
      const current = curR.rows[0]
      if (current.role === 'super_admin' || current.username === 'superadmin') {
        return err(res, 'Access denied: Cannot modify platform super administrator accounts', 403)
      }

      // Access control: operators can only update their own PIN, admins can update anyone
      const callerRole = req.headers['x-role'] || 'operator'
      const callerUsername = req.headers['x-username'] || ''
      const isCallerAdmin = callerRole === 'admin' || callerUsername.endsWith('_admin')
      if (!isCallerAdmin && current.username !== callerUsername) {
        return err(res, 'Access denied: You can only update your own PIN', 403)
      }

      const nextName = full_name || current.full_name
      const nextPin = pin && /^\d{4}$/.test(pin) ? pin : current.pin
      const nextRole = role || current.role
      const nextStatus = status || current.status

      const updateR = await client.query(
        `UPDATE users
         SET full_name = $1, pin = $2, role = $3, status = $4
         WHERE id = $5
         RETURNING *`,
        [nextName, nextPin, nextRole, nextStatus, id]
      )

      // Sync with public.organization_staff if email exists
      if (current.email) {
        await pool.query(
          `UPDATE public.organization_staff
           SET staff_name = $1, pin = $2, status = $3, updated_at = CURRENT_TIMESTAMP
           WHERE schema_name = $4 AND staff_email ILIKE $5`,
          [nextName, nextPin, nextStatus, schemaName, current.email]
        )
      }

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (username, action, module, details, metadata)
         VALUES ($1, 'UPDATE_STAFF', 'staff', $2, $3)`,
        [
          callerUser,
          `Updated staff account "${nextName}" (@${current.username}) — Status: ${nextStatus}, Role: ${nextRole}`,
          JSON.stringify({ id, previous: current, updated: updateR.rows[0] })
        ]
      )

      return ok(res, { success: true, user: updateR.rows[0] })
    }

    // DELETE /api/staff?id=X - Revoke staff authorization
    if (req.method === 'DELETE') {
      const id = Number(req.query.id)
      if (!id) return err(res, 'User ID is required', 400)

      const curR = await client.query('SELECT * FROM users WHERE id = $1', [id])
      if (curR.rows.length === 0) return err(res, 'User not found', 404)
      const current = curR.rows[0]

      if (current.role === 'super_admin' || current.username === 'superadmin') {
        return err(res, 'Access denied: Cannot delete platform super administrator accounts', 403)
      }

      // Admin cannot delete themselves
      const callerRole2 = req.headers['x-role'] || 'operator'
      const callerUsername2 = req.headers['x-username'] || ''
      const isCallerAdmin2 = callerRole2 === 'admin' || callerUsername2.endsWith('_admin')
      if (current.username === callerUsername2) {
        if (current.role === 'admin') {
          return err(res, 'Admins cannot delete their own account. Contact your Super Admin.', 403)
        }
        // Operators can delete themselves — allowed, fall through
      } else if (!isCallerAdmin2) {
        // Non-admin trying to delete someone else
        return err(res, 'Access denied: You can only delete your own account', 403)
      }
      if (current.role === 'admin' && current.username === 'admin') {
        return err(res, 'Cannot delete the primary cafe admin account', 400)
      }

      await client.query('DELETE FROM users WHERE id = $1', [id])

      if (current.email) {
        await pool.query(
          'DELETE FROM public.organization_staff WHERE schema_name = $1 AND staff_email ILIKE $2',
          [schemaName, current.email]
        )
      }

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (username, action, module, details, metadata)
         VALUES ($1, 'REVOKE_STAFF', 'staff', $2, $3)`,
        [
          callerUser,
          `Revoked staff access for "${current.full_name}" (@${current.username})`,
          JSON.stringify({ deleted_user: current })
        ]
      )

      return ok(res, { success: true, message: `Revoked access for ${current.full_name}` })
    }

    return err(res, 'Method not allowed', 405)
  })
}

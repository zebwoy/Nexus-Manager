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

  // ─── 1. Staff Member checking pending invites & available organizations ───
  if (action === 'available-orgs' && req.method === 'GET') {
    const userEmail = req.headers['x-user-email'] || req.query?.email || ''
    try {
      const orgsR = await pool.query(`
        SELECT id, org_id, name, slug, schema_name, logo_url, phone, status
        FROM public.tenants
        WHERE status = 'active'
        ORDER BY name ASC
      `)

      let myRequests = []
      if (userEmail) {
        const reqsR = await pool.query(`
          SELECT os.*, t.name as tenant_name, t.slug as tenant_slug, t.logo_url as tenant_logo
          FROM public.organization_staff os
          JOIN public.tenants t ON t.schema_name = os.schema_name
          WHERE os.staff_email ILIKE $1
          ORDER BY os.id DESC
        `, [userEmail.trim()])
        myRequests = reqsR.rows
      }

      return ok(res, { organizations: orgsR.rows, my_requests: myRequests })
    } catch (e) {
      console.error('Error fetching available orgs:', e)
      return err(res, e, 500)
    }
  }

  // ─── 2. Staff Member submitting a request to join an organization ───
  if (action === 'request-join' && req.method === 'POST') {
    const userEmail = req.headers['x-user-email']
    const incomingFullName = req.headers['x-user-fullname'] || req.headers['x-user-name']
    const incomingAvatar = req.headers['x-user-avatar']
    const { schema_name } = req.body || {}

    if (!userEmail || !schema_name) {
      return err(res, 'User email and schema name are required', 400)
    }

    try {
      // Check tenant exists
      const tenantR = await pool.query('SELECT name, slug FROM public.tenants WHERE schema_name = $1 AND status = $2', [schema_name, 'active'])
      if (tenantR.rows.length === 0) return err(res, 'Organization not found or inactive', 404)
      const tenant = tenantR.rows[0]

      // Check if already an admin or already member
      const existingR = await pool.query(
        'SELECT * FROM public.organization_staff WHERE schema_name = $1 AND staff_email ILIKE $2',
        [schema_name, userEmail.trim()]
      )
      if (existingR.rows.length > 0 && existingR.rows[0].status === 'active') {
        return err(res, 'You are already an active member of this organization', 400)
      }

      const cleanName = incomingFullName || userEmail.split('@')[0]
      const insertR = await pool.query(`
        INSERT INTO public.organization_staff (schema_name, staff_email, staff_name, role, avatar_url, status)
        VALUES ($1, $2, $3, 'operator', $4, 'pending_approval')
        ON CONFLICT (schema_name, staff_email) DO UPDATE
        SET staff_name = EXCLUDED.staff_name, avatar_url = EXCLUDED.avatar_url, status = 'pending_approval', updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [schema_name, userEmail.trim().toLowerCase(), cleanName, incomingAvatar || null])

      return ok(res, { success: true, message: `Join request submitted to ${tenant.name}! Awaiting admin approval.`, request: insertR.rows[0] }, 201)
    } catch (e) {
      console.error('Error submitting join request:', e)
      return err(res, e, 500)
    }
  }

  // ─── 3. Staff Member checking pending invites for their Clerk email ───
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
        `SELECT os.id as invite_id, os.org_id, os.schema_name, os.staff_email, os.staff_name, os.status as membership_status, os.role, os.invited_by,
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

  // ─── 4. Staff Member accepting an invite ───
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

  // ─── 5. Tenant-Scoped Staff Management (Admin Only) ───
  return withTenantClient(pool, req, res, async (client, schemaName) => {
    const callerUser = req.headers['x-username'] || 'admin'
    const callerRole = req.headers['x-role'] || 'operator'

    // POST /api/staff?action=review-join-request - Admin accepts or declines join request
    if (action === 'review-join-request' && req.method === 'POST') {
      const { request_id, decision, pin, role } = req.body || {}
      if (!request_id || !['accept', 'decline'].includes(decision)) {
        return err(res, 'Request ID and valid decision (accept or decline) required', 400)
      }

      const reqR = await pool.query(
        'SELECT * FROM public.organization_staff WHERE id = $1 AND schema_name = $2',
        [Number(request_id), schemaName]
      )
      if (reqR.rows.length === 0) return err(res, 'Join request not found', 404)
      const joinReq = reqR.rows[0]

      if (decision === 'accept') {
        const cleanPin = pin && /^\d{4}$/.test(pin) ? pin : '1234'
        const assignedRole = role === 'admin' ? 'admin' : 'operator'
        const username = joinReq.staff_email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase()

        await pool.query(`
          UPDATE public.organization_staff
          SET status = 'active', pin = $1, role = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [cleanPin, assignedRole, joinReq.id])

        // Insert / activate user in tenant users table
        await client.query(`
          INSERT INTO users (full_name, username, pin, role, email, status, avatar_url)
          VALUES ($1, $2, $3, $4, $5, 'active', $6)
          ON CONFLICT (username) DO UPDATE
          SET full_name = EXCLUDED.full_name, pin = EXCLUDED.pin, role = EXCLUDED.role, email = EXCLUDED.email, status = 'active', avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
        `, [joinReq.staff_name || username, username, cleanPin, assignedRole, joinReq.staff_email, joinReq.avatar_url || null])

        try {
          await client.query(`
            INSERT INTO audit_logs (username, action, module, details, metadata)
            VALUES ($1, 'ACCEPT_STAFF', 'staff', $2, $3)
          `, [
            callerUser,
            `Accepted staff join request for ${joinReq.staff_name || joinReq.staff_email} as ${assignedRole}`,
            JSON.stringify({ staff_email: joinReq.staff_email, role: assignedRole })
          ])
        } catch {}

        return ok(res, { success: true, message: `Accepted ${joinReq.staff_name || joinReq.staff_email} to staff team!` })
      } else {
        await pool.query(`
          UPDATE public.organization_staff
          SET status = 'declined', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [joinReq.id])

        try {
          await client.query(`
            INSERT INTO audit_logs (username, action, module, details, metadata)
            VALUES ($1, 'DECLINE_STAFF', 'staff', $2, $3)
          `, [
            callerUser,
            `Declined staff join request for ${joinReq.staff_name || joinReq.staff_email}`,
            JSON.stringify({ staff_email: joinReq.staff_email })
          ])
        } catch {}

        return ok(res, { success: true, message: 'Join request declined.' })
      }
    }

    // GET /api/staff - List all genuine staff accounts (strictly excluding platform superadmin)
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
          const incomingFullName = req.headers['x-user-fullname'] || req.headers['x-user-name']
          const incomingAvatar = req.headers['x-user-avatar']
          const emailPrefix = t.admin_email.split('@')[0].replace(/[^a-z0-9_]/gi, '')

          let realFullName = incomingFullName
          if (!realFullName || realFullName === 'Cafe Administrator' || realFullName.toLowerCase() === emailPrefix.toLowerCase()) {
            realFullName = t.admin_name && t.admin_name !== 'Cafe Administrator' && t.admin_name.toLowerCase() !== emailPrefix.toLowerCase()
              ? t.admin_name
              : (incomingFullName || t.admin_name || 'Cafe Administrator')
          }

          if (realFullName && realFullName !== 'Cafe Administrator' && realFullName !== t.admin_name) {
            await pool.query('UPDATE public.tenants SET admin_name = $1 WHERE schema_name = $2', [realFullName, schemaName])
          }

          // Sync the primary admin row
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

            if (curAdminR.rows.length > 1) {
              const extraIds = curAdminR.rows.slice(1).map(r => r.id)
              await client.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [extraIds])
            }
          } else {
            await client.query(`
              INSERT INTO users (full_name, username, pin, role, email, status, avatar_url)
              VALUES ($1, $2, '1234', 'admin', $3, 'active', $4)
              ON CONFLICT (username) DO UPDATE
              SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
            `, [realFullName, targetAdminUsername, t.admin_email, incomingAvatar || null])
          }

          // Clean up legacy placeholder/dummy accounts
          await client.query(`
            DELETE FROM users 
            WHERE (full_name = 'Counter Operator' AND email IS NULL)
               OR (full_name = 'Counter Staff' AND email IS NULL)
               OR username = 'staff'
               OR username = '${t.slug}_staff'
               OR username = '${t.slug}_operator' AND email IS NULL
          `)
        }
      } catch (e) {
        console.error('Error syncing admin user:', e)
      }

      const usersR = await client.query(
        "SELECT id, full_name, username, pin, role, email, status, avatar_url, created_at FROM users WHERE role != 'super_admin' AND username != 'superadmin' ORDER BY id ASC"
      )
      const staffRegistryR = await pool.query(
        'SELECT * FROM public.organization_staff WHERE schema_name = $1 ORDER BY id DESC',
        [schemaName]
      )

      const joinRequests = staffRegistryR.rows.filter(r => r.status === 'pending_approval')
      const invites = staffRegistryR.rows.filter(r => r.status === 'invited')

      return ok(res, {
        users: usersR.rows,
        invites,
        join_requests: joinRequests,
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

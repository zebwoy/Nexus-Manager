import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const userId = req.headers['x-user-id']
  const rawUrl = req.url || ''
  const subPath = String(req.query.path || rawUrl.replace(/^\/api\/pancafe\/?/, ''))
  const isPlans = req.query.resource === 'plans' || rawUrl.includes('pancafe-plans')

  return withTenantClient(pool, req, res, async (client) => {
    // ─── PANCAFE PLANS ──────────────────────────────────────────
    if (isPlans) {
      if (req.method === 'GET') {
        const r = await client.query('SELECT * FROM pancafe_plans ORDER BY is_signup_plan DESC, price ASC')
        return ok(res, { plans: r.rows })
      }

      if (req.method === 'POST') {
        const b = req.body || {}
        if (!b.label || !b.hours || !b.price) return err(res, 'label, hours, and price are required')
        const r = await client.query(
          `INSERT INTO pancafe_plans (label, hours, price, is_signup_plan)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [b.label, Number(b.hours), Number(b.price), !!b.is_signup_plan]
        )
        return ok(res, { plan: r.rows[0] }, 201)
      }

      const planIdMatch = rawUrl.match(/\/pancafe-plans\/(\d+)/) || (req.query.id ? [null, req.query.id] : null)
      if (planIdMatch && req.method === 'PATCH') {
        const id = Number(planIdMatch[1])
        const b = req.body || {}
        const cols = []; const vals = []; let i = 1
        if (b.label !== undefined)          { cols.push(`label = $${i++}`);          vals.push(b.label) }
        if (b.hours !== undefined)          { cols.push(`hours = $${i++}`);          vals.push(Number(b.hours)) }
        if (b.price !== undefined)          { cols.push(`price = $${i++}`);          vals.push(Number(b.price)) }
        if (b.is_active !== undefined)      { cols.push(`is_active = $${i++}`);      vals.push(!!b.is_active) }
        if (b.is_signup_plan !== undefined) { cols.push(`is_signup_plan = $${i++}`); vals.push(!!b.is_signup_plan) }
        if (cols.length === 0) return err(res, 'Nothing to update')
        vals.push(id)
        const r = await client.query(`UPDATE pancafe_plans SET ${cols.join(', ')} WHERE id = $${i} RETURNING *`, vals)
        return ok(res, { plan: r.rows[0] })
      }

      return err(res, 'Method not allowed', 405)
    }

    // ─── PANCAFE SESSIONS ───────────────────────────────────────
    const idMatch = subPath.match(/^(\d+)/) || rawUrl.match(/\/pancafe\/(\d+)/)
    if (idMatch && req.method === 'PATCH') {
      const id = Number(idMatch[1])
      const b = req.body || {}
      const cols = []; const vals = []; let i = 1
      if (b.time_out !== undefined)       { cols.push(`time_out = $${i++}`);         vals.push(b.time_out) }
      if (b.amount_received !== undefined){ cols.push(`amount_received = $${i++}`);  vals.push(Number(b.amount_received)) }
      if (b.payment_method !== undefined) { cols.push(`payment_method = $${i++}`);   vals.push(b.payment_method) }
      if (cols.length === 0) return err(res, 'Nothing to update')
      vals.push(id)
      const r = await client.query(`UPDATE pancafe_sessions SET ${cols.join(', ')} WHERE id = $${i} RETURNING *`, vals)
      return ok(res, { session: r.rows[0] })
    }

    if (req.method === 'GET') {
      const date = req.query.date
      const currentOperator = req.headers['x-username']
      let query = `
        SELECT ps.*, c.name, c.mobile, c.shop_name,
               d.label AS device_label,
               pp.label AS plan_label, pp.hours AS plan_hours,
               u.username AS created_by_username
        FROM pancafe_sessions ps
        LEFT JOIN customers c ON c.id = ps.customer_id
        LEFT JOIN devices d ON d.id = ps.device_id
        LEFT JOIN pancafe_plans pp ON pp.id = ps.plan_id
        LEFT JOIN users u ON u.id = ps.created_by
      `
      const vals = []
      const clauses = []

      if (date) {
        clauses.push(`ps.date = $${vals.length + 1}`)
        vals.push(date)
      }

      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(' AND ')
      }

      query += ` ORDER BY ps.time_in DESC`
      const result = await client.query(query, vals)
      return ok(res, { sessions: result.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      const {
        customer_id, name, mobile, shop_name, pancafe_username,
        device_id, plan_id, date, time_in, time_out,
        amount_received, remark, payment_method,
      } = b

      if (!pancafe_username) return err(res, 'PanCafe username is required')

      await client.query('BEGIN')
      try {
        let cid = customer_id
        if (!cid && name) {
          const existing = await client.query(
            'SELECT id FROM customers WHERE name ILIKE $1 AND (mobile = $2 OR mobile IS NULL)',
            [name.trim(), mobile || null]
          )
          if (existing.rows.length > 0) {
            cid = existing.rows[0].id
            await client.query(
              'UPDATE customers SET pancafe_username = COALESCE($1, pancafe_username), shop_name = COALESCE($2, shop_name) WHERE id = $3',
              [pancafe_username, shop_name || null, cid]
            )
          } else {
            const newC = await client.query(
              'INSERT INTO customers (name, mobile, shop_name, pancafe_username) VALUES ($1,$2,$3,$4) RETURNING id',
              [name.trim(), mobile || null, shop_name || null, pancafe_username]
            )
            cid = newC.rows[0].id
          }
        }

        const r = await client.query(
          `INSERT INTO pancafe_sessions
            (customer_id, pancafe_username, device_id, plan_id, date, time_in, time_out,
             amount_received, amount_spent, remark, payment_method, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11)
           RETURNING id`,
          [
            cid || null,
            pancafe_username,
            device_id || null,
            plan_id || null,
            date || new Date().toISOString().slice(0, 10),
            time_in || null,
            time_out || null,
            Number(amount_received || 0),
            remark || null,
            payment_method || 'cash',
            userId
          ]
        )

        await client.query('COMMIT')
        return ok(res, { id: r.rows[0].id }, 201)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    return err(res, 'Method not allowed', 405)
  })
}

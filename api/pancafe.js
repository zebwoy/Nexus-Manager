import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const userId = req.headers['x-user-id']
  const rawUrl = req.url || ''
  const subPath = String(req.query.path || rawUrl.replace(/^\/api\/pancafe\/?/, ''))
  const isPlans = req.query.resource === 'plans' || rawUrl.includes('pancafe-plans')

  // ─── PANCAFE PLANS ──────────────────────────────────────────
  if (isPlans) {
    try {
      if (req.method === 'GET') {
        const r = await pool.query('SELECT * FROM pancafe_plans ORDER BY is_signup_plan DESC, price ASC')
        return ok(res, { plans: r.rows })
      }

      if (req.method === 'POST') {
        const b = req.body || {}
        if (!b.label || !b.hours || !b.price) return err(res, 'label, hours, and price are required')
        const r = await pool.query(
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
        const r = await pool.query(`UPDATE pancafe_plans SET ${cols.join(', ')} WHERE id = $${i} RETURNING *`, vals)
        return ok(res, { plan: r.rows[0] })
      }

      return err(res, 'Method not allowed', 405)
    } catch (e) {
      console.error(e)
      return err(res, e, 500)
    }
  }

  // ─── PANCAFE SESSIONS ───────────────────────────────────────
  const idMatch = subPath.match(/^(\d+)/) || rawUrl.match(/\/pancafe\/(\d+)/)
  if (idMatch && req.method === 'PATCH') {
    const id = Number(idMatch[1])
    try {
      const b = req.body || {}
      const cols = []; const vals = []; let i = 1
      if (b.time_out !== undefined)       { cols.push(`time_out = $${i++}`);         vals.push(b.time_out) }
      if (b.amount_received !== undefined){ cols.push(`amount_received = $${i++}`);  vals.push(Number(b.amount_received)) }
      if (b.amount_spent !== undefined)   { cols.push(`amount_spent = $${i++}`);     vals.push(Number(b.amount_spent)) }
      if (b.payment_method !== undefined) { cols.push(`payment_method = $${i++}`);   vals.push(b.payment_method) }
      if (b.remark !== undefined)         { cols.push(`remark = $${i++}`);           vals.push(b.remark) }
      if (cols.length === 0) return err(res, 'Nothing to update')
      vals.push(id)
      const r = await pool.query(`UPDATE pancafe_sessions SET ${cols.join(', ')} WHERE id = $${i} RETURNING *`, vals)
      return ok(res, { session: r.rows[0] })
    } catch (e) {
      console.error(e)
      return err(res, e, 500)
    }
  }

  try {
    if (req.method === 'GET') {
      const date = req.query.date
      const activeOnly = req.query.active === 'true'
      let q = `SELECT ps.*, c.name, c.shop_name, d.label AS device_label,
                      u.username AS created_by_username,
                      pp.label AS plan_label, pp.hours AS plan_hours
               FROM pancafe_sessions ps
               LEFT JOIN customers c ON c.id = ps.customer_id
               LEFT JOIN devices d ON d.id = ps.device_id
               LEFT JOIN users u ON u.id = ps.created_by
               LEFT JOIN pancafe_plans pp ON pp.id = ps.plan_id`
      const vals = []
      const where = []
      if (date) { where.push(`ps.date = $${vals.length + 1}`); vals.push(date) }
      if (activeOnly) { where.push(`ps.time_out IS NULL`) }
      if (where.length) q += ` WHERE ${where.join(' AND ')}`
      q += ` ORDER BY ps.created_at DESC`
      const r = await pool.query(q, vals)
      return ok(res, { sessions: r.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      let cid = b.customer_id
      if (!cid && b.name) {
        const ex = await pool.query('SELECT id FROM customers WHERE name ILIKE $1', [b.name.trim()])
        if (ex.rows.length > 0) cid = ex.rows[0].id
        else {
          const nc = await pool.query(
            'INSERT INTO customers (name, mobile, shop_name, pancafe_username) VALUES ($1,$2,$3,$4) RETURNING id',
            [b.name.trim(), b.mobile || null, b.shop_name || null, b.pancafe_username || null]
          )
          cid = nc.rows[0].id
        }
      }
      if (cid && b.pancafe_username) {
        await pool.query(
          'UPDATE customers SET pancafe_username = COALESCE(pancafe_username, $1) WHERE id = $2',
          [b.pancafe_username, cid]
        )
      }
      await pool.query(
        `INSERT INTO pancafe_sessions
           (customer_id, pancafe_username, device_id, plan_id, date, time_in, time_out,
            amount_received, amount_spent, payment_method, remark, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [cid, b.pancafe_username, b.device_id || null, b.plan_id || null,
         b.date, b.time_in || null, b.time_out || null,
         b.amount_received, b.amount_spent || 0, b.payment_method || 'cash',
         b.remark || null, userId || null]
      )
      return ok(res, { success: true }, 201)
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err(res, e, 500)
  }
}

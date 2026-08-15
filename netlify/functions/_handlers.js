import { getPool, ok, err, cors } from './_db.js'

// ─── DEVICES ──────────────────────────────────────────────────
export const devicesHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  try {
    const r = await pool.query('SELECT * FROM devices ORDER BY type, label')
    return ok({ devices: r.rows })
  } catch (e) { return err('Server error', 500) }
}

// ─── PRICING ──────────────────────────────────────────────────
export const pricingHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  try {
    const r = await pool.query('SELECT * FROM pricing ORDER BY device_type, duration_mins')
    return ok({ pricing: r.rows })
  } catch (e) { return err('Server error', 500) }
}

// ─── SETTINGS ─────────────────────────────────────────────────
export const settingsHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  try {
    if (event.httpMethod === 'GET') {
      const r = await pool.query('SELECT * FROM settings')
      return ok({ settings: r.rows })
    }
    if (event.httpMethod === 'POST') {
      const { settings } = JSON.parse(event.body || '{}')
      for (const s of settings) {
        await pool.query('UPDATE settings SET value = $1 WHERE key = $2', [s.value, s.key])
      }
      return ok({ success: true })
    }
    return err('Method not allowed', 405)
  } catch (e) { return err('Server error', 500) }
}

// ─── CUSTOMERS ────────────────────────────────────────────────
export const customersHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  const userId = event.headers['x-user-id']
  try {
    const params = event.queryStringParameters || {}
    if (params.search) {
      const r = await pool.query(
        `SELECT * FROM customers WHERE name ILIKE $1 OR mobile LIKE $2 OR shop_name ILIKE $1 ORDER BY name LIMIT 15`,
        [`%${params.search}%`, `%${params.search}%`]
      )
      return ok({ customers: r.rows })
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}')
      if (!b.name) return err('Name is required')
      const r = await pool.query(
        `INSERT INTO customers (name, mobile, shop_name, pancafe_username)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [b.name.trim(), b.mobile || null, b.shop_name || null, b.pancafe_username || null]
      )
      return ok({ customer: r.rows[0] }, 201)
    }
    const r = await pool.query(`
      SELECT c.*, COUNT(s.id)::int AS session_count
      FROM customers c
      LEFT JOIN sessions s ON s.customer_id = c.id
      GROUP BY c.id ORDER BY c.name
    `)
    return ok({ customers: r.rows })
  } catch (e) { return err('Server error', 500) }
}

// ─── PANCAFE ──────────────────────────────────────────────────
export const pancafeHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  const userId = event.headers['x-user-id']

  // PATCH /pancafe/:id — close an open session
  const idMatch = event.path.match(/\/pancafe\/(\d+)$/)
  if (idMatch && event.httpMethod === 'PATCH') {
    const id = Number(idMatch[1])
    try {
      const b = JSON.parse(event.body || '{}')
      const cols = []; const vals = []; let i = 1
      if (b.time_out !== undefined)       { cols.push(`time_out = $${i++}`);         vals.push(b.time_out) }
      if (b.amount_received !== undefined){ cols.push(`amount_received = $${i++}`);  vals.push(Number(b.amount_received)) }
      if (b.amount_spent !== undefined)   { cols.push(`amount_spent = $${i++}`);     vals.push(Number(b.amount_spent)) }
      if (b.payment_method !== undefined) { cols.push(`payment_method = $${i++}`);   vals.push(b.payment_method) }
      if (b.remark !== undefined)         { cols.push(`remark = $${i++}`);           vals.push(b.remark) }
      if (cols.length === 0) return err('Nothing to update')
      vals.push(id)
      const r = await pool.query(
        `UPDATE pancafe_sessions SET ${cols.join(', ')} WHERE id = $${i} RETURNING *`, vals
      )
      return ok({ session: r.rows[0] })
    } catch (e) { console.error(e); return err('Server error', 500) }
  }

  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const date = params.date
      const activeOnly = params.active === 'true'
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
      return ok({ sessions: r.rows })
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}')
      let cid = b.customer_id
      if (!cid && b.name) {
        const ex = await pool.query('SELECT id FROM customers WHERE name ILIKE $1', [b.name.trim()])
        if (ex.rows.length > 0) cid = ex.rows[0].id
        else {
          const nc = await pool.query(
            'INSERT INTO customers (name, mobile, shop_name, pancafe_username) VALUES ($1,$2,$3,$4) RETURNING id',
            [b.name.trim(), b.mobile||null, b.shop_name||null, b.pancafe_username||null]
          )
          cid = nc.rows[0].id
        }
      }
      // If customer exists and pancafe_username provided, update it
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
        [cid, b.pancafe_username, b.device_id||null, b.plan_id||null,
         b.date, b.time_in||null, b.time_out||null,
         b.amount_received, b.amount_spent||0, b.payment_method||'cash',
         b.remark||null, userId||null]
      )
      return ok({ success: true }, 201)
    }
    return err('Method not allowed', 405)
  } catch (e) { console.error(e); return err('Server error', 500) }
}

// ─── RECHARGES ────────────────────────────────────────────────
export const rechargesHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  const userId = event.headers['x-user-id']
  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      let q = `SELECT r.*, c.name, u.username AS created_by_username
               FROM recharges r LEFT JOIN customers c ON c.id = r.customer_id
               LEFT JOIN users u ON u.id = r.created_by`
      const vals = []
      if (params.date) { q += ` WHERE r.date = $1`; vals.push(params.date) }
      q += ` ORDER BY r.created_at DESC`
      const r = await pool.query(q, vals)
      return ok({ recharges: r.rows })
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}')
      let cid = b.customer_id
      if (!cid && b.name) {
        const ex = await pool.query('SELECT id FROM customers WHERE name ILIKE $1', [b.name.trim()])
        if (ex.rows.length > 0) cid = ex.rows[0].id
        else { const nc = await pool.query('INSERT INTO customers (name, mobile) VALUES ($1,$2) RETURNING id', [b.name.trim(), b.mobile||null]); cid = nc.rows[0].id }
      }
      await pool.query(
        `INSERT INTO recharges (customer_id, date, game_platform, cost_price, charge_price, payment_received, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [cid, b.date, b.game_platform||null, b.cost_price, b.charge_price, b.payment_received||null, b.note||null, userId||null]
      )
      return ok({ success: true }, 201)
    }
    return err('Method not allowed', 405)
  } catch (e) { return err('Server error', 500) }
}

// ─── EXPENSES ─────────────────────────────────────────────────
export const expensesHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  const userId = event.headers['x-user-id']
  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      let q = `SELECT e.*, u.username AS created_by_username FROM expenses e LEFT JOIN users u ON u.id = e.created_by`
      const vals = []
      if (params.date) { q += ` WHERE e.date = $1`; vals.push(params.date) }
      q += ` ORDER BY e.created_at DESC`
      const r = await pool.query(q, vals)
      return ok({ expenses: r.rows })
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}')
      await pool.query(
        `INSERT INTO expenses (date, category, amount, note, payment_method, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [b.date, b.category, b.amount, b.note||null, b.payment_method||'cash', userId||null]
      )
      return ok({ success: true }, 201)
    }
    return err('Method not allowed', 405)
  } catch (e) { return err('Server error', 500) }
}

// ─── SALES (inventory) ────────────────────────────────────────
export const salesHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  const userId = event.headers['x-user-id']
  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      // Fetch sales for a specific session (used by SessionDetail)
      if (params.session_id) {
        const r = await pool.query(
          `SELECT sa.id, sa.total, sa.payment_received, sa.payment_method, sa.created_at,
                  json_agg(json_build_object(
                    'name', ii.name, 'qty', si.qty, 'unit_price', si.unit_price
                  )) AS items
           FROM sales sa
           JOIN sale_items si ON si.sale_id = sa.id
           JOIN inventory_items ii ON ii.id = si.item_id
           WHERE sa.session_id = $1
           GROUP BY sa.id ORDER BY sa.created_at`,
          [Number(params.session_id)]
        )
        return ok({ sales: r.rows })
      }
      return err('session_id required for GET')
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}')
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const saleResult = await client.query(
          `INSERT INTO sales (session_id, customer_id, sale_type, date, total, payment_received, payment_method, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [b.session_id||null, b.customer_id||null, b.sale_type||'walkin', b.date, b.total,
           b.payment_received||null, b.payment_method||'cash', userId||null]
        )
        const saleId = saleResult.rows[0].id
        for (const item of (b.items || [])) {
          await client.query(
            `INSERT INTO sale_items (sale_id, item_id, qty, unit_price) VALUES ($1,$2,$3,$4)`,
            [saleId, item.item_id, item.qty, item.unit_price]
          )
          // Atomic stock guard — prevent going negative
          const stockR = await client.query(
            `UPDATE inventory_items SET stock_qty = stock_qty - $1
             WHERE id = $2 AND stock_qty >= $1 RETURNING id`,
            [item.qty, item.item_id]
          )
          if (stockR.rowCount === 0) {
            await client.query('ROLLBACK')
            return err(`Insufficient stock for item ID ${item.item_id}`, 409)
          }
        }
        await client.query('COMMIT')
        return ok({ id: saleId }, 201)
      } catch (e) { await client.query('ROLLBACK'); throw e }
      finally { client.release() }
    }
    return err('Method not allowed', 405)
  } catch (e) { console.error(e); return err('Server error', 500) }
}

// ─── INVENTORY ────────────────────────────────────────────────
export const inventoryHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  try {
    if (event.httpMethod === 'GET') {
      const r = await pool.query('SELECT * FROM inventory_items WHERE is_active = TRUE ORDER BY category, name')
      return ok({ items: r.rows })
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}')
      await pool.query(
        `INSERT INTO inventory_items (name, category, buy_price, sell_price, stock_qty) VALUES ($1,$2,$3,$4,$5)`,
        [b.name, b.category, b.buy_price||0, b.sell_price, b.stock_qty||0]
      )
      return ok({ success: true }, 201)
    }
    return err('Method not allowed', 405)
  } catch (e) { return err('Server error', 500) }
}

// ─── DASHBOARD SNAPSHOT ───────────────────────────────────────
export const dashboardSnapshotHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  try {
    const r = await pool.query('SELECT * FROM today_snapshot')
    return ok(r.rows[0] || {})
  } catch (e) { return err('Server error', 500) }
}

// ─── DASHBOARD CREDITS ────────────────────────────────────────
export const dashboardCreditsHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  try {
    const r = await pool.query(`
      SELECT s.id AS session_id, c.name, s.date, s.credit, d.label AS device_label
      FROM sessions s
      LEFT JOIN customers c ON c.id = s.customer_id
      JOIN devices d ON d.id = s.device_id
      WHERE s.credit > 0
      ORDER BY s.date DESC
      LIMIT 20
    `)
    return ok({ credits: r.rows })
  } catch (e) { return err('Server error', 500) }
}

// ─── REPORTS ──────────────────────────────────────────────────
export const reportsHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  try {
    const month = (event.queryStringParameters || {}).month || new Date().toISOString().slice(0, 7)
    const [year, mon] = month.split('-')
    const start = `${year}-${mon}-01`
    const end = new Date(year, mon, 0).toISOString().slice(0, 10)

    const [
      gaming, walkin, sessionSales, rc, pancafe, expenses, deviceStats, credits,
      inventoryCogs, rechargesCogs, pancafeCogs
    ] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total),0) AS v FROM sessions WHERE date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(total),0) AS v FROM sales WHERE sale_type='walkin' AND date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(total),0) AS v FROM sales WHERE sale_type='session' AND date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(charge_price),0) AS v FROM recharges WHERE date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(amount_received),0) AS v FROM pancafe_sessions WHERE date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT d.label AS device_label, COUNT(s.id)::int AS session_count, COALESCE(SUM(s.total),0) AS total_revenue
                  FROM sessions s JOIN devices d ON d.id = s.device_id
                  WHERE s.date BETWEEN $1 AND $2 GROUP BY d.id, d.label ORDER BY session_count DESC`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(credit),0) AS v FROM sessions WHERE credit > 0`),
      pool.query(`SELECT COALESCE(SUM(si.qty * ii.buy_price),0) AS v 
                  FROM sale_items si 
                  JOIN sales s ON s.id = si.sale_id 
                  JOIN inventory_items ii ON ii.id = si.item_id 
                  WHERE s.date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(cost_price),0) AS v FROM recharges WHERE date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(amount_spent),0) AS v FROM pancafe_sessions WHERE date BETWEEN $1 AND $2`, [start, end]),
    ])

    const gross = [gaming, walkin, sessionSales, rc, pancafe].reduce((sum, r) => sum + Number(r.rows[0].v), 0)
    const opExp = Number(expenses.rows[0].v)
    const invCogsVal = Number(inventoryCogs.rows[0].v)
    const rcCogsVal = Number(rechargesCogs.rows[0].v)
    const pcCogsVal = Number(pancafeCogs.rows[0].v)
    
    const totalExp = opExp + invCogsVal + rcCogsVal + pcCogsVal
    const maxSessions = Math.max(...(deviceStats.rows.map(d => d.session_count)), 1)

    return ok({
      gross_revenue: gross,
      gaming_revenue: Number(gaming.rows[0].v),
      walkin_revenue: Number(walkin.rows[0].v),
      session_sales_revenue: Number(sessionSales.rows[0].v),
      rc_revenue: Number(rc.rows[0].v),
      pancafe_revenue: Number(pancafe.rows[0].v),
      operating_expenses: opExp,
      inventory_cogs: invCogsVal,
      recharges_cogs: rcCogsVal,
      pancafe_cogs: pcCogsVal,
      total_expenses: totalExp,
      net_profit: gross - totalExp,
      outstanding_credit: Number(credits.rows[0].v),
      device_stats: deviceStats.rows,
      max_sessions: maxSessions,
    })
  } catch (e) { console.error(e); return err('Server error', 500) }
}

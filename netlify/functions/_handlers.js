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
  try {
    const params = event.queryStringParameters || {}
    if (params.search) {
      const r = await pool.query(
        `SELECT * FROM customers WHERE name ILIKE $1 OR mobile LIKE $2 ORDER BY name LIMIT 10`,
        [`%${params.search}%`, `%${params.search}%`]
      )
      return ok({ customers: r.rows })
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
  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const date = params.date
      let q = `SELECT ps.*, c.name, d.label AS device_label, u.username AS created_by_username
               FROM pancafe_sessions ps
               LEFT JOIN customers c ON c.id = ps.customer_id
               LEFT JOIN devices d ON d.id = ps.device_id
               LEFT JOIN users u ON u.id = ps.created_by`
      const vals = []
      if (date) { q += ` WHERE ps.date = $1`; vals.push(date) }
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
        else { const nc = await pool.query('INSERT INTO customers (name, mobile) VALUES ($1,$2) RETURNING id', [b.name.trim(), b.mobile||null]); cid = nc.rows[0].id }
      }
      await pool.query(
        `INSERT INTO pancafe_sessions (customer_id, pancafe_username, device_id, date, time_in, time_out, amount_received, amount_spent, remark, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [cid, b.pancafe_username, b.device_id||null, b.date, b.time_in||null, b.time_out||null, b.amount_received, b.amount_spent, b.remark||null, userId||null]
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
        `INSERT INTO expenses (date, category, amount, note, created_by) VALUES ($1,$2,$3,$4,$5)`,
        [b.date, b.category, b.amount, b.note||null, userId||null]
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
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}')
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const saleResult = await client.query(
          `INSERT INTO sales (session_id, customer_id, sale_type, date, total, payment_received, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [b.session_id||null, b.customer_id||null, b.sale_type||'walkin', b.date, b.total, b.payment_received||null, userId||null]
        )
        const saleId = saleResult.rows[0].id
        for (const item of (b.items || [])) {
          await client.query(
            `INSERT INTO sale_items (sale_id, item_id, qty, unit_price) VALUES ($1,$2,$3,$4)`,
            [saleId, item.item_id, item.qty, item.unit_price]
          )
          await client.query(
            `UPDATE inventory_items SET stock_qty = stock_qty - $1 WHERE id = $2`,
            [item.qty, item.item_id]
          )
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

    const [gaming, walkin, sessionSales, rc, pancafe, expenses, deviceStats, credits] = await Promise.all([
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
    ])

    const gross = [gaming, walkin, sessionSales, rc, pancafe].reduce((sum, r) => sum + Number(r.rows[0].v), 0)
    const totalExp = Number(expenses.rows[0].v)
    const maxSessions = Math.max(...(deviceStats.rows.map(d => d.session_count)), 1)

    return ok({
      gross_revenue: gross,
      gaming_revenue: Number(gaming.rows[0].v),
      walkin_revenue: Number(walkin.rows[0].v),
      session_sales_revenue: Number(sessionSales.rows[0].v),
      rc_revenue: Number(rc.rows[0].v),
      pancafe_revenue: Number(pancafe.rows[0].v),
      total_expenses: totalExp,
      net_profit: gross - totalExp,
      outstanding_credit: Number(credits.rows[0].v),
      device_stats: deviceStats.rows,
      max_sessions: maxSessions,
    })
  } catch (e) { console.error(e); return err('Server error', 500) }
}

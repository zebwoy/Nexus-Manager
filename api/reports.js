import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()

  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
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

    return ok(res, {
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
  } catch (e) {
    console.error(e)
    return err(res, 'Server error', 500)
  }
}

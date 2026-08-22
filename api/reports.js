import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405)
  const pool = getPool()

  return withTenantClient(pool, req, res, async (client) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    const startDate = `${month}-01`
    const nextMonth = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString().slice(0, 7)
    const endDate = `${nextMonth}-01`

    const revenueRes = await client.query(`
      SELECT
        (SELECT COALESCE(SUM(total), 0) FROM sessions WHERE date >= $1 AND date < $2 AND (is_deleted IS NULL OR is_deleted = FALSE)) AS gaming_revenue,
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE sale_type = 'walkin' AND date >= $1 AND date < $2 AND (is_deleted IS NULL OR is_deleted = FALSE)) AS walkin_revenue,
        (SELECT COALESCE(SUM(s.total), 0) FROM sales s LEFT JOIN sessions sess ON sess.id = s.session_id WHERE s.sale_type = 'session' AND s.date >= $1 AND s.date < $2 AND (s.is_deleted IS NULL OR s.is_deleted = FALSE) AND (sess.id IS NULL OR sess.is_deleted IS NULL OR sess.is_deleted = FALSE)) AS session_sales_revenue,
        (SELECT COALESCE(SUM(amount_received), 0) FROM pancafe_sessions WHERE date >= $1 AND date < $2) AS pancafe_revenue,
        (SELECT COALESCE(SUM(charge_price), 0) FROM recharges WHERE date >= $1 AND date < $2) AS rc_revenue,
        (SELECT COALESCE(SUM(credit), 0) FROM sessions WHERE date >= $1 AND date < $2 AND (is_deleted IS NULL OR is_deleted = FALSE)) AS outstanding_credit,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE date >= $1 AND date < $2) AS operating_expenses,
        (SELECT COALESCE(SUM(si.qty * ii.buy_price), 0)
         FROM sales s JOIN sale_items si ON si.sale_id = s.id
         JOIN inventory_items ii ON ii.id = si.item_id
         LEFT JOIN sessions sess ON sess.id = s.session_id
         WHERE s.date >= $1 AND s.date < $2 AND (s.is_deleted IS NULL OR s.is_deleted = FALSE) AND (sess.id IS NULL OR sess.is_deleted IS NULL OR sess.is_deleted = FALSE)) AS inventory_cogs,
        (SELECT COALESCE(SUM(cost_price), 0) FROM recharges WHERE date >= $1 AND date < $2) AS recharges_cogs,
        (SELECT COALESCE(SUM(amount_spent), 0) FROM pancafe_sessions WHERE date >= $1 AND date < $2) AS pancafe_cogs
    `, [startDate, endDate])

    const r = revenueRes.rows[0]
    const grossRevenue = Number(r.gaming_revenue) + Number(r.walkin_revenue) + Number(r.session_sales_revenue) + Number(r.pancafe_revenue) + Number(r.rc_revenue)
    const totalCOGS = Number(r.inventory_cogs) + Number(r.recharges_cogs) + Number(r.pancafe_cogs)
    const totalExpenses = Number(r.operating_expenses) + totalCOGS
    const netProfit = grossRevenue - totalExpenses

    const deviceRes = await client.query(`
      SELECT d.label AS device_label, d.type,
             COUNT(s.id) AS session_count,
             COALESCE(SUM(s.total), 0) AS total_revenue
      FROM devices d
      LEFT JOIN sessions s ON s.device_id = d.id AND s.date >= $1 AND s.date < $2 AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)
      WHERE d.is_active = TRUE
      GROUP BY d.id, d.label, d.type
      ORDER BY total_revenue DESC
    `, [startDate, endDate])

    const maxSessions = Math.max(...deviceRes.rows.map(d => Number(d.session_count)), 1)

    return ok(res, {
      month,
      gross_revenue: grossRevenue,
      gaming_revenue: Number(r.gaming_revenue),
      walkin_revenue: Number(r.walkin_revenue),
      session_sales_revenue: Number(r.session_sales_revenue),
      pancafe_revenue: Number(r.pancafe_revenue),
      rc_revenue: Number(r.rc_revenue),
      operating_expenses: Number(r.operating_expenses),
      inventory_cogs: Number(r.inventory_cogs),
      recharges_cogs: Number(r.recharges_cogs),
      pancafe_cogs: Number(r.pancafe_cogs),
      total_expenses: totalExpenses,
      net_profit: netProfit,
      outstanding_credit: Number(r.outstanding_credit),
      device_stats: deviceRes.rows,
      max_sessions: maxSessions,
    })
  })
}

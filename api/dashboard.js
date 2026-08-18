import { getPool, ok, err } from './_db.js'
import { getTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  const url = req.url || ''
  const target = req.query.target || (
    url.includes('dashboard-snapshot') ? 'snapshot' :
    url.includes('dashboard-credits') ? 'credits' :
    url.includes('day-openings') ? 'day-openings' : null
  )

  const pool = getPool()
  let tenantSession
  try {
    tenantSession = await getTenantClient(pool, req)
    const { client } = tenantSession
    const userId = req.headers['x-user-id']
    const currentOperator = req.headers['x-username']

    // ─── DASHBOARD SNAPSHOT ────────────────────────────────────────────
    if (target === 'snapshot' || url.includes('dashboard-snapshot')) {
      const trialUserRes = await client.query("SELECT id FROM users WHERE username = 'trial'")
      const trialUserId = trialUserRes.rows[0]?.id || 0

      const creatorClause = currentOperator === 'trial'
        ? `AND created_by = $1`
        : `AND (created_by IS NULL OR created_by <> $1)`

      const r = await client.query(`
        SELECT
          (SELECT COALESCE(SUM(total), 0.00) FROM sessions WHERE date = CURRENT_DATE ${creatorClause}) AS gaming_revenue,
          (SELECT COALESCE(SUM(total), 0.00) FROM sales WHERE sale_type = 'walkin' AND date = CURRENT_DATE ${creatorClause}) AS walkin_revenue,
          (SELECT COALESCE(SUM(total), 0.00) FROM sales WHERE sale_type = 'session' AND date = CURRENT_DATE ${creatorClause}) AS session_sales_revenue,
          (SELECT COALESCE(SUM(charge_price), 0.00) FROM recharges WHERE date = CURRENT_DATE ${creatorClause}) AS rc_revenue,
          (SELECT COALESCE(SUM(amount_received), 0.00) FROM pancafe_sessions WHERE date = CURRENT_DATE ${creatorClause}) AS pancafe_revenue,
          (SELECT COALESCE(SUM(credit), 0.00) FROM sessions WHERE credit > 0 ${creatorClause}) AS total_outstanding_credit,
          -- Cash vs Online inflow breakdown
          (SELECT COALESCE(SUM(amount), 0.00) FROM session_payments WHERE payment_method = 'cash' AND created_at::date = CURRENT_DATE ${creatorClause}) AS cash_gaming,
          (SELECT COALESCE(SUM(amount), 0.00) FROM session_payments WHERE payment_method = 'online' AND created_at::date = CURRENT_DATE ${creatorClause}) AS online_gaming,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN payment_received ELSE 0 END), 0.00)
           FROM sales WHERE sale_type = 'walkin' AND date = CURRENT_DATE ${creatorClause}) AS cash_sales,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'online' THEN payment_received ELSE 0 END), 0.00)
           FROM sales WHERE sale_type = 'walkin' AND date = CURRENT_DATE ${creatorClause}) AS online_sales,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount_received ELSE 0 END), 0.00)
           FROM pancafe_sessions WHERE date = CURRENT_DATE ${creatorClause}) AS cash_pancafe,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'online' THEN amount_received ELSE 0 END), 0.00)
           FROM pancafe_sessions WHERE date = CURRENT_DATE ${creatorClause}) AS online_pancafe,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0.00)
           FROM expenses WHERE date = CURRENT_DATE ${creatorClause}) AS cash_expenses,
          -- Active session count
          (SELECT COUNT(*) FROM sessions WHERE date = CURRENT_DATE AND time_out > NOW() ${creatorClause}) AS active_sessions,
          (SELECT COUNT(*) FROM pancafe_sessions WHERE date = CURRENT_DATE AND time_out IS NULL ${creatorClause}) AS active_pancafe
      `, [trialUserId])
      return ok(res, r.rows[0] || {})
    }

    // ─── DASHBOARD CREDITS ──────────────────────────────────────
    if (target === 'credits' || url.includes('dashboard-credits')) {
      const trialUserRes = await client.query("SELECT id FROM users WHERE username = 'trial'")
      const trialUserId = trialUserRes.rows[0]?.id || 0

      let query = `
        SELECT s.id AS session_id, s.credit, s.date,
               c.name, c.mobile, d.label AS device_label
        FROM sessions s
        LEFT JOIN customers c ON c.id = s.customer_id
        JOIN devices d ON d.id = s.device_id
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.credit > 0 AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)
      `
      const vals = []
      if (currentOperator === 'trial') {
        query += ` AND u.username = 'trial'`
      } else {
        query += ` AND (u.username IS NULL OR u.username <> 'trial')`
      }
      query += ` ORDER BY s.date DESC, s.time_in DESC LIMIT 10`

      const r = await client.query(query, vals)
      return ok(res, { credits: r.rows })
    }

    // ─── DAY OPENINGS ───────────────────────────────────────────
    if (target === 'day-openings' || url.includes('day-openings')) {
      if (req.method === 'GET') {
        const date = req.query.date || new Date().toISOString().slice(0, 10)
        const r = await client.query('SELECT * FROM day_openings WHERE date = $1', [date])
        return ok(res, { opening: r.rows[0] || null })
      }

      if (req.method === 'POST') {
        const b = req.body || {}
        const date = b.date || new Date().toISOString().slice(0, 10)
        const opening_cash = Number(b.opening_cash || 0)
        const note = b.note || null

        const r = await client.query(`
          INSERT INTO day_openings (date, opening_cash, note, created_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (date) DO UPDATE
            SET opening_cash = EXCLUDED.opening_cash,
                note = EXCLUDED.note,
                created_by = EXCLUDED.created_by
          RETURNING *
        `, [date, opening_cash, note, userId ? Number(userId) : null])

        return ok(res, { opening: r.rows[0] })
      }
    }

    return err(res, 'Invalid target or method', 400)
  } catch (e) {
    console.error(e)
    return err(res, e, 500)
  } finally {
    if (tenantSession?.client) {
      tenantSession.client.release()
    }
  }
}

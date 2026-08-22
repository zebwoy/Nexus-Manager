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

    // ─── DASHBOARD SNAPSHOT ────────────────────────────────────────────
    if (target === 'snapshot' || url.includes('dashboard-snapshot')) {
      const targetDate = req.query.date || (new Date()).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const r = await client.query(`
        SELECT
          (SELECT COALESCE(SUM(total), 0.00) FROM sessions WHERE date = $1 AND (is_deleted IS NULL OR is_deleted = FALSE)) AS gaming_revenue,
          (SELECT COALESCE(SUM(total), 0.00) FROM sales WHERE sale_type = 'walkin' AND date = $1 AND (is_deleted IS NULL OR is_deleted = FALSE)) AS walkin_revenue,
          (SELECT COALESCE(SUM(s.total), 0.00) FROM sales s LEFT JOIN sessions sess ON sess.id = s.session_id WHERE s.sale_type = 'session' AND s.date = $1 AND (s.is_deleted IS NULL OR s.is_deleted = FALSE) AND (sess.id IS NULL OR sess.is_deleted IS NULL OR sess.is_deleted = FALSE)) AS session_sales_revenue,
          (SELECT COALESCE(SUM(charge_price), 0.00) FROM recharges WHERE date = $1) AS rc_revenue,
          (SELECT COALESCE(SUM(amount_received), 0.00) FROM pancafe_sessions WHERE date = $1) AS pancafe_revenue,
          (SELECT COALESCE(SUM(credit), 0.00) FROM sessions WHERE credit > 0 AND (is_deleted IS NULL OR is_deleted = FALSE)) AS total_outstanding_credit,
          -- Cash vs Online inflow breakdown
          (SELECT COALESCE(SUM(amount), 0.00) FROM session_payments WHERE payment_method = 'cash' AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1) AS cash_gaming,
          (SELECT COALESCE(SUM(amount), 0.00) FROM session_payments WHERE payment_method = 'online' AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1) AS online_gaming,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN payment_received ELSE 0 END), 0.00)
           FROM sales WHERE sale_type = 'walkin' AND date = $1 AND (is_deleted IS NULL OR is_deleted = FALSE)) AS cash_sales,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'online' THEN payment_received ELSE 0 END), 0.00)
           FROM sales WHERE sale_type = 'walkin' AND date = $1 AND (is_deleted IS NULL OR is_deleted = FALSE)) AS online_sales,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount_received ELSE 0 END), 0.00)
           FROM pancafe_sessions WHERE date = $1) AS cash_pancafe,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'online' THEN amount_received ELSE 0 END), 0.00)
           FROM pancafe_sessions WHERE date = $1) AS online_pancafe,
          (SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0.00)
           FROM expenses WHERE date = $1) AS cash_expenses,
          -- Active session count
          (SELECT COUNT(*) FROM sessions WHERE date = $1 AND time_out > NOW() AND (is_deleted IS NULL OR is_deleted = FALSE)) AS active_sessions,
          (SELECT COUNT(*) FROM pancafe_sessions WHERE date = $1 AND time_out IS NULL) AS active_pancafe
      `, [targetDate])
      return ok(res, r.rows[0] || {})
    }


    // ─── DASHBOARD CREDITS ──────────────────────────────────────
    if (target === 'credits' || url.includes('dashboard-credits')) {
      const r = await client.query(`
        SELECT s.id AS session_id, s.credit, s.date,
               c.name, c.mobile, d.label AS device_label
        FROM sessions s
        LEFT JOIN customers c ON c.id = s.customer_id
        JOIN devices d ON d.id = s.device_id
        WHERE s.credit > 0 AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)
        ORDER BY s.date DESC, s.time_in DESC LIMIT 10
      `)
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

        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, module, details, metadata)
           VALUES ($1, $2, 'BOD_SET_OPENING', 'bod', $3, $4)`,
          [
            userId ? Number(userId) : null,
            req.headers['x-username'] || 'staff',
            `Set Start of Day (BOD) opening cash: ₹${opening_cash} for ${date}${note ? ` (Note: ${note})` : ''}`,
            JSON.stringify({ date, opening_cash, note })
          ]
        )

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

import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const url = req.url || ''
  const target = req.query.target || (
    url.includes('dashboard-snapshot') ? 'snapshot' :
    url.includes('dashboard-credits') ? 'credits' :
    url.includes('day-openings') ? 'day-openings' : null
  )

  try {
    const pool = getPool()
    const userId = req.headers['x-user-id']
    const currentOperator = req.headers['x-username']

    // ─── DASHBOARD SNAPSHOT ────────────────────────────────────────────
    if (target === 'snapshot' || url.includes('dashboard-snapshot')) {
      const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
      const trialUserId = trialUserRes.rows[0]?.id || 0

      // Build creator filter for both trial and production paths
      // Trial: only see their own rows. Production: exclude trial rows.
      const creatorClause = currentOperator === 'trial'
        ? `AND created_by = $1`
        : `AND (created_by IS NULL OR created_by <> $1)`

      const r = await pool.query(`
        SELECT
          (SELECT COALESCE(SUM(total), 0.00) FROM sessions WHERE date = CURRENT_DATE ${creatorClause}) AS gaming_revenue,
          (SELECT COALESCE(SUM(total), 0.00) FROM sales WHERE sale_type = 'walkin' AND date = CURRENT_DATE ${creatorClause}) AS walkin_revenue,
          (SELECT COALESCE(SUM(total), 0.00) FROM sales WHERE sale_type = 'session' AND date = CURRENT_DATE ${creatorClause}) AS session_sales_revenue,
          (SELECT COALESCE(SUM(charge_price), 0.00) FROM recharges WHERE date = CURRENT_DATE ${creatorClause}) AS rc_revenue,
          (SELECT COALESCE(SUM(amount_received), 0.00) FROM pancafe_sessions WHERE date = CURRENT_DATE ${creatorClause}) AS pancafe_revenue,
          (SELECT COALESCE(SUM(credit), 0.00) FROM sessions WHERE credit > 0 ${creatorClause}) AS total_outstanding_credit,
          -- Cash vs Online inflow breakdown (using session_payments)
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
      const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
      const trialUserId = trialUserRes.rows[0]?.id || 0

      let query = `
        SELECT s.id AS session_id, c.name, s.date, s.credit, d.label AS device_label
        FROM sessions s
        LEFT JOIN customers c ON c.id = s.customer_id
        JOIN devices d ON d.id = s.device_id
        WHERE s.credit > 0
      `
      const vals = []
      if (currentOperator === 'trial') {
        query += ' AND s.created_by = $1'
        vals.push(trialUserId)
      } else {
        query += ' AND (s.created_by IS NULL OR s.created_by <> $1)'
        vals.push(trialUserId)
      }
      query += ' ORDER BY s.date DESC LIMIT 20'

      const r = await pool.query(query, vals)
      return ok(res, { credits: r.rows })
    }

    // ─── DAY OPENINGS ───────────────────────────────────────────
    if (target === 'day-openings' || url.includes('day-openings')) {
      const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
      const trialUserId = trialUserRes.rows[0]?.id || 0

      if (req.method === 'GET') {
        const date = req.query.date || new Date().toISOString().slice(0, 10)
        let query = `
          SELECT dop.*, u.username AS created_by_username FROM day_openings dop
          LEFT JOIN users u ON u.id = dop.created_by
          WHERE dop.date = $1
        `
        const vals = [date]
        if (currentOperator === 'trial') {
          query += ' AND dop.created_by = $2'
          vals.push(trialUserId)
        } else {
          query += ' AND (dop.created_by IS NULL OR dop.created_by <> $2)'
          vals.push(trialUserId)
        }

        const r = await pool.query(query, vals)
        return ok(res, { opening: r.rows[0] || null })
      }

      if (req.method === 'POST') {
        const b = req.body || {}
        const date = b.date || new Date().toISOString().slice(0, 10)
        const r = await pool.query(
          `INSERT INTO day_openings (date, opening_cash, note, created_by)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (date) DO UPDATE SET opening_cash = $2, note = $3
           RETURNING *`,
          [date, Number(b.opening_cash || 0), b.note || null, userId || null]
        )
        return ok(res, { opening: r.rows[0] }, 201)
      }

      return err(res, 'Method not allowed', 405)
    }

    return err(res, 'Invalid target', 400)
  } catch (e) {
    console.error(e)
    return err(res, e, 500)
  }
}


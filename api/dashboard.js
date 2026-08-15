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

    // ─── DASHBOARD SNAPSHOT ─────────────────────────────────────
    if (target === 'snapshot' || url.includes('dashboard-snapshot')) {
      const r = await pool.query('SELECT * FROM today_snapshot')
      return ok(res, r.rows[0] || {})
    }

    // ─── DASHBOARD CREDITS ──────────────────────────────────────
    if (target === 'credits' || url.includes('dashboard-credits')) {
      const r = await pool.query(`
        SELECT s.id AS session_id, c.name, s.date, s.credit, d.label AS device_label
        FROM sessions s
        LEFT JOIN customers c ON c.id = s.customer_id
        JOIN devices d ON d.id = s.device_id
        WHERE s.credit > 0
        ORDER BY s.date DESC
        LIMIT 20
      `)
      return ok(res, { credits: r.rows })
    }

    // ─── DAY OPENINGS ───────────────────────────────────────────
    if (target === 'day-openings' || url.includes('day-openings')) {
      if (req.method === 'GET') {
        const date = req.query.date || new Date().toISOString().slice(0, 10)
        const r = await pool.query(
          `SELECT do.*, u.username AS created_by_username FROM day_openings do
           LEFT JOIN users u ON u.id = do.created_by
           WHERE do.date = $1`,
          [date]
        )
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


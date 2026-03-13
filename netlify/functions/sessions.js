import { getPool, ok, err, cors } from './_db.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  const userId = event.headers['x-user-id']

  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const date = params.date
      const limit = params.limit ? Number(params.limit) : null

      let query = `
        SELECT s.*, c.name, c.mobile, d.label AS device_label, u.username AS created_by_username
        FROM sessions s
        LEFT JOIN customers c ON c.id = s.customer_id
        JOIN devices d ON d.id = s.device_id
        LEFT JOIN users u ON u.id = s.created_by
      `
      const vals = []
      if (date) { query += ` WHERE s.date = $1`; vals.push(date) }
      query += ` ORDER BY s.time_in DESC`
      if (limit) { query += ` LIMIT $${vals.length + 1}`; vals.push(limit) }

      const result = await pool.query(query, vals)
      return ok({ sessions: result.rows })
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const {
        customer_id, name, mobile, device_id, duration_mins,
        time_in, time_out, date, charge, controller_total,
        extra_person_total, total, payment_received, credit, remark, players
      } = body

      // Upsert customer if name provided
      let cid = customer_id
      if (!cid && name) {
        const existing = await pool.query(
          'SELECT id FROM customers WHERE name ILIKE $1 AND (mobile = $2 OR mobile IS NULL)',
          [name.trim(), mobile || null]
        )
        if (existing.rows.length > 0) {
          cid = existing.rows[0].id
        } else {
          const newC = await pool.query(
            'INSERT INTO customers (name, mobile) VALUES ($1, $2) RETURNING id',
            [name.trim(), mobile || null]
          )
          cid = newC.rows[0].id
        }
      }

      const result = await pool.query(
        `INSERT INTO sessions
          (customer_id, device_id, duration_mins, time_in, time_out, date,
           charge, controller_total, extra_person_total, total,
           payment_received, credit, remark, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [cid, device_id, duration_mins, time_in, time_out, date,
         charge, controller_total || 0, extra_person_total || 0, total,
         payment_received, credit, remark, userId || null]
      )

      const sessionId = result.rows[0].id

      // Insert players if provided
      if (players?.length) {
        for (const p of players) {
          await pool.query(
            `INSERT INTO session_players (session_id, player_number, own_controller, controller_fee, extra_person_fee)
             VALUES ($1,$2,$3,$4,$5)`,
            [sessionId, p.player_number, p.own_controller, p.controller_fee, p.extra_person_fee]
          )
        }
      }

      return ok({ id: sessionId }, 201)
    }

    return err('Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err('Server error', 500)
  }
}

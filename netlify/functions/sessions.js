import { getPool, ok, err, cors } from './_db.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  const userId = event.headers['x-user-id']

  // ─── Route: /sessions/:id/payments ────────────────────────────
  const paymentsMatch = event.path.match(/\/sessions\/(\d+)\/payments$/)
  if (paymentsMatch && event.httpMethod === 'POST') {
    const sessionId = Number(paymentsMatch[1])
    const client = await pool.connect()
    try {
      const b = JSON.parse(event.body || '{}')
      if (!b.amount || Number(b.amount) <= 0) return err('Amount must be positive')
      const amt = Number(b.amount)
      const method = b.payment_method || 'cash'

      await client.query('BEGIN')
      // Append payment record
      await client.query(
        `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [sessionId, amt, method, b.note || null, userId || null]
      )
      // Update session totals
      const updated = await client.query(
        `UPDATE sessions
         SET payment_received = COALESCE(payment_received, 0) + $1,
             credit = GREATEST(0, credit - $1)
         WHERE id = $2
         RETURNING payment_received, credit`,
        [amt, sessionId]
      )
      if (updated.rowCount === 0) {
        await client.query('ROLLBACK')
        return err('Session not found', 404)
      }
      await client.query('COMMIT')
      return ok({ success: true, ...updated.rows[0] })
    } catch (e) {
      await client.query('ROLLBACK')
      console.error(e)
      return err('Server error', 500)
    } finally { client.release() }
  }

  // ─── Route: /sessions/:id/extend ──────────────────────────────
  const extendMatch = event.path.match(/\/sessions\/(\d+)\/extend$/)
  if (extendMatch && event.httpMethod === 'PATCH') {
    const sessionId = Number(extendMatch[1])
    const client = await pool.connect()
    try {
      const b = JSON.parse(event.body || '{}')
      const packets = Number(b.packets) || 1  // number of 30-min blocks to add
      const extraMins = packets * 30
      const collectNow = Number(b.collect_now) || 0
      const payMethod = b.payment_method || 'cash'

      await client.query('BEGIN')

      // Get current session + device type for repricing
      const sessR = await client.query(
        `SELECT s.*, d.type AS device_type FROM sessions s
         JOIN devices d ON d.id = s.device_id WHERE s.id = $1`,
        [sessionId]
      )
      if (sessR.rowCount === 0) {
        await client.query('ROLLBACK')
        return err('Session not found', 404)
      }
      const sess = sessR.rows[0]
      const newDuration = Number(sess.duration_mins) + extraMins
      const newTimeOut = new Date(new Date(sess.time_out).getTime() + extraMins * 60000).toISOString()

      // Fetch new price for extended duration
      const priceR = await client.query(
        `SELECT price FROM pricing WHERE device_type = $1 AND duration_mins = $2`,
        [sess.device_type, newDuration]
      )
      // If exact duration not found, use proportional rate from base 60-min price
      let newCharge
      if (priceR.rowCount > 0) {
        newCharge = Number(priceR.rows[0].price)
      } else {
        // Fallback: add pro-rated extension at per-30-min rate from closest pricing
        const rateR = await client.query(
          `SELECT price, duration_mins FROM pricing
           WHERE device_type = $1 ORDER BY duration_mins DESC LIMIT 1`,
          [sess.device_type]
        )
        const rate = rateR.rowCount > 0
          ? (Number(rateR.rows[0].price) / Number(rateR.rows[0].duration_mins)) * 30
          : 0
        newCharge = Number(sess.charge) + (rate * packets)
      }

      const newTotal = newCharge + Number(sess.controller_total) + Number(sess.extra_person_total)
      const additionalCharge = newTotal - Number(sess.total)

      // Apply immediate payment if provided
      let newPaymentReceived = Number(sess.payment_received || 0) + collectNow
      let newCredit = Math.max(0, newTotal - newPaymentReceived)

      const updated = await client.query(
        `UPDATE sessions SET
           duration_mins = $1, time_out = $2, charge = $3, total = $4,
           payment_received = $5, credit = $6
         WHERE id = $7
         RETURNING duration_mins, time_out, charge, total, payment_received, credit`,
        [newDuration, newTimeOut, newCharge, newTotal, newPaymentReceived, newCredit, sessionId]
      )

      // Log payment if collected now
      if (collectNow > 0) {
        await client.query(
          `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [sessionId, collectNow, payMethod, `Extension +${extraMins}min`, userId || null]
        )
      }

      await client.query('COMMIT')
      return ok({ success: true, additional_charge: additionalCharge, ...updated.rows[0] })
    } catch (e) {
      await client.query('ROLLBACK')
      console.error(e)
      return err('Server error', 500)
    } finally { client.release() }
  }

  // ─── Route: /sessions/:id ─────────────────────────────────────
  const idMatch = event.path.match(/\/sessions\/(\d+)$/)
  if (idMatch) {
    const sessionId = Number(idMatch[1])

    // GET — full session detail
    if (event.httpMethod === 'GET') {
      try {
        const [sessR, playersR, salesR, paymentsR] = await Promise.all([
          pool.query(
            `SELECT s.*, c.name, c.mobile, c.shop_name, d.label AS device_label, d.type AS device_type,
                    u.username AS created_by_username
             FROM sessions s
             LEFT JOIN customers c ON c.id = s.customer_id
             JOIN devices d ON d.id = s.device_id
             LEFT JOIN users u ON u.id = s.created_by
             WHERE s.id = $1`,
            [sessionId]
          ),
          pool.query(
            `SELECT * FROM session_players WHERE session_id = $1 ORDER BY player_number`,
            [sessionId]
          ),
          pool.query(
            `SELECT sa.*, si.qty, si.unit_price, ii.name AS item_name
             FROM sales sa
             JOIN sale_items si ON si.sale_id = sa.id
             JOIN inventory_items ii ON ii.id = si.item_id
             WHERE sa.session_id = $1 ORDER BY sa.created_at`,
            [sessionId]
          ),
          pool.query(
            `SELECT sp.*, u.username AS by_username FROM session_payments sp
             LEFT JOIN users u ON u.id = sp.created_by
             WHERE sp.session_id = $1 ORDER BY sp.created_at`,
            [sessionId]
          ),
        ])
        if (sessR.rowCount === 0) return err('Session not found', 404)
        return ok({
          session: sessR.rows[0],
          players: playersR.rows,
          sales: salesR.rows,
          payments: paymentsR.rows,
        })
      } catch (e) { console.error(e); return err('Server error', 500) }
    }

    // PATCH — update remark or mark remark correction
    if (event.httpMethod === 'PATCH') {
      try {
        const b = JSON.parse(event.body || '{}')
        const updates = []
        const vals = []
        let idx = 1
        if (b.remark !== undefined) { updates.push(`remark = $${idx++}`); vals.push(b.remark) }
        if (updates.length === 0) return err('Nothing to update')
        vals.push(sessionId)
        await pool.query(`UPDATE sessions SET ${updates.join(', ')} WHERE id = $${idx}`, vals)
        return ok({ success: true })
      } catch (e) { console.error(e); return err('Server error', 500) }
    }
  }

  try {
    // ─── GET /sessions ─────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const date = params.date
      const limit = params.limit ? Number(params.limit) : null

      let query = `
        SELECT s.*, c.name, c.mobile, c.shop_name, d.label AS device_label, d.type AS device_type,
               u.username AS created_by_username,
               (s.time_out > NOW() AND s.date = CURRENT_DATE) AS is_active
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

    // ─── POST /sessions ────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const {
        customer_id, name, mobile, shop_name, device_id, duration_mins,
        time_in, time_out, date, charge, controller_total,
        extra_person_total, total, payment_received, credit, remark,
        players, payment_method
      } = body

      const finalPayment = (payment_received !== null && payment_received !== undefined && payment_received !== '')
        ? Number(payment_received) : 0.00
      const finalCredit = (credit !== null && credit !== undefined && credit !== '')
        ? Number(credit) : Math.max(0, total - finalPayment)
      const finalMethod = payment_method || (finalCredit > 0 ? 'credit' : 'cash')

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Upsert customer
        let cid = customer_id
        if (!cid && name) {
          const existing = await client.query(
            'SELECT id FROM customers WHERE name ILIKE $1 AND (mobile = $2 OR mobile IS NULL)',
            [name.trim(), mobile || null]
          )
          if (existing.rows.length > 0) {
            cid = existing.rows[0].id
            // Update shop_name if provided and not yet set
            if (shop_name) {
              await client.query(
                'UPDATE customers SET shop_name = COALESCE(shop_name, $1) WHERE id = $2',
                [shop_name, cid]
              )
            }
          } else {
            const newC = await client.query(
              'INSERT INTO customers (name, mobile, shop_name) VALUES ($1,$2,$3) RETURNING id',
              [name.trim(), mobile || null, shop_name || null]
            )
            cid = newC.rows[0].id
          }
        }

        const result = await client.query(
          `INSERT INTO sessions
            (customer_id, device_id, duration_mins, time_in, time_out, date,
             charge, controller_total, extra_person_total, total,
             payment_received, credit, remark, payment_method, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           RETURNING id`,
          [cid, device_id, duration_mins, time_in, time_out, date,
           charge, controller_total || 0, extra_person_total || 0, total,
           finalPayment, finalCredit, remark, finalMethod, userId || null]
        )
        const sessionId = result.rows[0].id

        // Insert initial payment log entry
        if (finalPayment > 0) {
          await client.query(
            `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by)
             VALUES ($1,$2,$3,'Initial payment',$4)`,
            [sessionId, finalPayment, finalMethod === 'credit' ? 'cash' : finalMethod, userId || null]
          )
        }

        // Insert players
        if (players?.length) {
          for (const p of players) {
            await client.query(
              `INSERT INTO session_players (session_id, player_number, own_controller, controller_fee, extra_person_fee)
               VALUES ($1,$2,$3,$4,$5)`,
              [sessionId, p.player_number, p.own_controller, p.controller_fee, p.extra_person_fee]
            )
          }
        }

        await client.query('COMMIT')
        return ok({ id: sessionId }, 201)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally { client.release() }
    }

    return err('Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err('Server error', 500)
  }
}

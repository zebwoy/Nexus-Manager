import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const userId = req.headers['x-user-id']
  const rawUrl = req.url || ''
  const subPath = String(req.query.path || rawUrl.replace(/^\/api\/sessions\/?/, ''))

  return withTenantClient(pool, req, res, async (client) => {
    // ─── Route: /api/sessions/:id/payments ───────────────────────
    const paymentsMatch = subPath.match(/(\d+)\/payments/) || rawUrl.match(/\/sessions\/(\d+)\/payments/)
    if (paymentsMatch && req.method === 'POST') {
      const sessionId = Number(paymentsMatch[1])
      const b = req.body || {}
      if (!b.amount || Number(b.amount) <= 0) return err(res, 'Amount must be positive')
      const amt = Number(b.amount)
      const method = b.payment_method || 'cash'

      await client.query('BEGIN')
      try {
        await client.query(
          `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [sessionId, amt, method, b.note || null, userId || null]
        )
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
          return err(res, 'Session not found', 404)
        }
        await client.query('COMMIT')
        return ok(res, { success: true, ...updated.rows[0] })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    // ─── Route: /api/sessions/:id/extend ─────────────────────────
    const extendMatch = subPath.match(/(\d+)\/extend/) || rawUrl.match(/\/sessions\/(\d+)\/extend/)
    if (extendMatch && req.method === 'PATCH') {
      const sessionId = Number(extendMatch[1])
      const b = req.body || {}
      const packets = Number(b.packets) || 1
      const extraMins = packets * 30
      const collectNow = Number(b.collect_now) || 0
      const payMethod = b.payment_method || 'cash'

      await client.query('BEGIN')
      try {
        const sessR = await client.query(
          `SELECT s.*, d.type AS device_type FROM sessions s
           JOIN devices d ON d.id = s.device_id WHERE s.id = $1`,
          [sessionId]
        )
        if (sessR.rowCount === 0) {
          await client.query('ROLLBACK')
          return err(res, 'Session not found', 404)
        }
        const sess = sessR.rows[0]
        const newDuration = Number(sess.duration_mins) + extraMins
        const newTimeOut = new Date(new Date(sess.time_out).getTime() + extraMins * 60000).toISOString()

        const priceR = await client.query(
          `SELECT price FROM pricing WHERE device_type = $1 AND duration_mins = $2`,
          [sess.device_type, newDuration]
        )
        let newCharge
        if (priceR.rowCount > 0) {
          newCharge = Number(priceR.rows[0].price)
        } else {
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

        if (collectNow > 0) {
          await client.query(
            `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by)
             VALUES ($1,$2,$3,$4,$5)`,
            [sessionId, collectNow, payMethod, `Extension +${extraMins}min`, userId || null]
          )
        }

        await client.query('COMMIT')
        return ok(res, { success: true, additional_charge: additionalCharge, ...updated.rows[0] })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    // ─── Route: /api/sessions/:id/end-early ───────────────────────
    const endEarlyMatch = subPath.match(/(\d+)\/end-early/) || rawUrl.match(/\/sessions\/(\d+)\/end-early/)
    if (endEarlyMatch && req.method === 'PATCH') {
      const sessionId = Number(endEarlyMatch[1])
      const b = req.body || {}
      const recalculate = b.recalculate === true
      await client.query('BEGIN')
      try {
        const sessR = await client.query(
          `SELECT s.*, d.type AS device_type, d.label AS device_label FROM sessions s
           JOIN devices d ON d.id = s.device_id WHERE s.id = $1`,
          [sessionId]
        )
        if (sessR.rowCount === 0) {
          await client.query('ROLLBACK')
          return err(res, 'Session not found', 404)
        }
        const sess = sessR.rows[0]
        const now = new Date()
        const timeIn = new Date(sess.time_in)
        const elapsedMins = Math.max(1, Math.round((now - timeIn) / 60000))
        const roundedMins = Math.ceil(elapsedMins / 30) * 30

        let newDuration = Number(sess.duration_mins)
        let newCharge = Number(sess.charge)
        let newTotal = Number(sess.total)
        let newCredit = Number(sess.credit)

        if (recalculate && roundedMins < Number(sess.duration_mins)) {
          newDuration = roundedMins
          const priceR = await client.query(
            `SELECT price FROM pricing WHERE device_type = $1 AND duration_mins = $2`,
            [sess.device_type, newDuration]
          )
          if (priceR.rowCount > 0) {
            newCharge = Number(priceR.rows[0].price)
          }
          newTotal = newCharge + Number(sess.controller_total || 0) + Number(sess.extra_person_total || 0)
          newCredit = Math.max(0, newTotal - Number(sess.payment_received || 0))
        }

        const updated = await client.query(
          `UPDATE sessions SET
             time_out = $1, duration_mins = $2, charge = $3, total = $4, credit = $5
           WHERE id = $6
           RETURNING id, time_out, duration_mins, charge, total, payment_received, credit`,
          [now.toISOString(), newDuration, newCharge, newTotal, newCredit, sessionId]
        )

        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,'SESSION_END_EARLY',$3)`,
          [Number(userId || 0), req.headers['x-username'] || 'system', `Ended session #${sessionId} early on ${sess.device_label} (Played: ${elapsedMins}m)`]
        )

        await client.query('COMMIT')
        return ok(res, { success: true, ...updated.rows[0], elapsed_mins: elapsedMins })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    // ─── Route: /api/sessions/:id/switch-station ───────────────────
    const switchMatch = subPath.match(/(\d+)\/switch-station/) || rawUrl.match(/\/sessions\/(\d+)\/switch-station/)
    if (switchMatch && req.method === 'PATCH') {
      const sessionId = Number(switchMatch[1])
      const newDeviceId = Number(req.body?.new_device_id)
      if (!newDeviceId) return err(res, 'New device ID required', 400)

      await client.query('BEGIN')
      try {
        const [sessR, devR] = await Promise.all([
          client.query(`SELECT s.*, d.label AS old_label FROM sessions s JOIN devices d ON d.id = s.device_id WHERE s.id = $1`, [sessionId]),
          client.query(`SELECT * FROM devices WHERE id = $1 AND is_active = TRUE`, [newDeviceId])
        ])
        if (sessR.rowCount === 0) { await client.query('ROLLBACK'); return err(res, 'Session not found', 404) }
        if (devR.rowCount === 0) { await client.query('ROLLBACK'); return err(res, 'Target device not available', 400) }

        const sess = sessR.rows[0]
        const newDev = devR.rows[0]

        await client.query(`UPDATE sessions SET device_id = $1 WHERE id = $2`, [newDeviceId, sessionId])
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,'SESSION_SWITCH_STATION',$3)`,
          [Number(userId || 0), req.headers['x-username'] || 'system', `Moved session #${sessionId} from ${sess.old_label} to ${newDev.label}`]
        )

        await client.query('COMMIT')
        return ok(res, { success: true, new_device_id: newDeviceId, device_label: newDev.label })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    // ─── Route: /api/sessions/:id ────────────────────────────────
    const idMatch = subPath.match(/^(\d+)(\?|$)/) || rawUrl.match(/\/sessions\/(\d+)(\?|$)/)
    if (idMatch && !subPath.includes('payments') && !subPath.includes('extend') && !subPath.includes('end-early') && !subPath.includes('switch-station') && !rawUrl.includes('/payments') && !rawUrl.includes('/extend') && !rawUrl.includes('/end-early') && !rawUrl.includes('/switch-station')) {
      const sessionId = Number(idMatch[1])

      if (req.method === 'GET') {
        const [sessR, playersR, salesR, paymentsR] = await Promise.all([
          client.query(
            `SELECT s.*, c.name, c.mobile, c.shop_name, d.label AS device_label, d.type AS device_type,
                    u.username AS created_by_username
             FROM sessions s
             LEFT JOIN customers c ON c.id = s.customer_id
             JOIN devices d ON d.id = s.device_id
             LEFT JOIN users u ON u.id = s.created_by
             WHERE s.id = $1`,
            [sessionId]
          ),
          client.query(`SELECT * FROM session_players WHERE session_id = $1 ORDER BY player_number`, [sessionId]),
          client.query(
            `SELECT s.*, json_agg(json_build_object('id', ii.id, 'name', ii.name, 'qty', si.qty, 'unit_price', si.unit_price)) AS items
             FROM sales s
             LEFT JOIN sale_items si ON si.sale_id = s.id
             LEFT JOIN inventory_items ii ON ii.id = si.item_id
             WHERE s.session_id = $1
             GROUP BY s.id`,
            [sessionId]
          ),
          client.query(
            `SELECT sp.*, u.username AS created_by_username
             FROM session_payments sp
             LEFT JOIN users u ON u.id = sp.created_by
             WHERE sp.session_id = $1
             ORDER BY sp.created_at ASC`,
            [sessionId]
          ),
        ])

        if (sessR.rowCount === 0) return err(res, 'Session not found', 404)
        return ok(res, {
          session: sessR.rows[0],
          players: playersR.rows,
          sales: salesR.rows,
          payments: paymentsR.rows,
        })
      }

      if (req.method === 'PATCH') {
        const b = req.body || {}
        await client.query('BEGIN')
        try {
          const currentR = await client.query(`SELECT * FROM sessions WHERE id = $1`, [sessionId])
          if (currentR.rowCount === 0) {
            await client.query('ROLLBACK')
            return err(res, 'Session not found', 404)
          }
          const cur = currentR.rows[0]

          const duration_mins = b.duration_mins !== undefined ? Number(b.duration_mins) : cur.duration_mins
          const time_out      = b.time_out      !== undefined ? b.time_out                : cur.time_out
          const charge        = b.charge        !== undefined ? Number(b.charge)          : cur.charge
          const total         = b.total         !== undefined ? Number(b.total)           : cur.total
          const payment_rcvd  = b.payment_received !== undefined ? Number(b.payment_received) : cur.payment_received
          const credit        = b.credit        !== undefined ? Number(b.credit)          : cur.credit
          const remark        = b.remark        !== undefined ? b.remark                  : cur.remark

          const updated = await client.query(
            `UPDATE sessions SET
               duration_mins = $1, time_out = $2, charge = $3, total = $4,
               payment_received = $5, credit = $6, remark = $7
             WHERE id = $8
             RETURNING *`,
            [duration_mins, time_out, charge, total, payment_rcvd, credit, remark, sessionId]
          )

          await client.query('COMMIT')
          return ok(res, { session: updated.rows[0] })
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        }
      }

      if (req.method === 'DELETE') {
        await client.query('BEGIN')
        try {
          const sessR = await client.query(
            `SELECT s.*, d.label AS device_label FROM sessions s JOIN devices d ON d.id = s.device_id WHERE s.id = $1`,
            [sessionId]
          )
          if (sessR.rowCount === 0) { await client.query('ROLLBACK'); return err(res, 'Session not found', 404) }
          const sess = sessR.rows[0]

          const salesR = await client.query(`SELECT id FROM sales WHERE session_id = $1`, [sessionId])
          for (const sale of salesR.rows) {
            const itemsR = await client.query(`SELECT item_id, qty FROM sale_items WHERE sale_id = $1`, [sale.id])
            for (const item of itemsR.rows) {
              await client.query(`UPDATE inventory_items SET stock_qty = stock_qty + $1 WHERE id = $2`, [item.qty, item.item_id])
            }
            await client.query(`DELETE FROM sales WHERE id = $1`, [sale.id])
          }

          await client.query(`UPDATE sessions SET is_deleted = TRUE WHERE id = $1`, [sessionId])
          await client.query(
            `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,'SESSION_DELETE',$3)`,
            [Number(userId || 0), req.headers['x-username'] || 'system',
             `Deleted session #${sessionId} | Device: ${sess.device_label} | Total: ₹${sess.total}`]
          )

          await client.query('COMMIT')
          return ok(res, { success: true })
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        }
      }
    }

    // ─── Base /api/sessions Collection Routes ───────────────────
    if (req.method === 'GET') {
      const currentOperator = req.headers['x-username']
      const date = req.query.date
      const limit = req.query.limit ? Number(req.query.limit) : null

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
      const clauses = [`(s.is_deleted IS NULL OR s.is_deleted = FALSE)`]

      if (date) {
        clauses.push(`s.date = $${vals.length + 1}`)
        vals.push(date)
      }

      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(' AND ')
      }

      query += ` ORDER BY s.time_in DESC`
      if (limit) {
        query += ` LIMIT $${vals.length + 1}`
        vals.push(limit)
      }

      const result = await client.query(query, vals)
      return ok(res, { sessions: result.rows })
    }

    if (req.method === 'POST') {
      const body = req.body || {}
      const {
        customer_id, name, mobile, shop_name, device_id, duration_mins,
        time_in, time_out, date, charge, controller_total,
        extra_person_total, total, credit, remark,
        players, payment_method,
        cash_amount, online_amount, payment_received,
      } = body

      const cashAmt   = Number(cash_amount   || 0)
      const onlineAmt = Number(online_amount  || 0)
      const hasSplit  = (cash_amount !== undefined || online_amount !== undefined)
      const finalPayment = hasSplit
        ? cashAmt + onlineAmt
        : (payment_received !== null && payment_received !== undefined && payment_received !== '')
          ? Number(payment_received) : 0.00

      const finalCredit = (credit !== null && credit !== undefined && credit !== '')
        ? Number(credit) : Math.max(0, total - finalPayment)

      let finalMethod
      if (hasSplit) {
        if (cashAmt > 0 && onlineAmt > 0) finalMethod = 'split'
        else if (onlineAmt > 0) finalMethod = 'online'
        else finalMethod = 'cash'
      } else {
        finalMethod = payment_method || (finalCredit > 0 ? 'credit' : 'cash')
      }

      await client.query('BEGIN')
      try {
        let cid = customer_id
        if (!cid && name) {
          const existing = await client.query(
            'SELECT id FROM customers WHERE name ILIKE $1 AND (mobile = $2 OR mobile IS NULL)',
            [name.trim(), mobile || null]
          )
          if (existing.rows.length > 0) {
            cid = existing.rows[0].id
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

        if (hasSplit) {
          if (cashAmt > 0) {
            await client.query(
              `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by) VALUES ($1,$2,'cash','Initial cash payment',$3)`,
              [sessionId, cashAmt, userId || null]
            )
          }
          if (onlineAmt > 0) {
            await client.query(
              `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by) VALUES ($1,$2,'online','Initial online payment',$3)`,
              [sessionId, onlineAmt, userId || null]
            )
          }
        } else if (finalPayment > 0) {
          await client.query(
            `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by) VALUES ($1,$2,$3,'Initial payment',$4)`,
            [sessionId, finalPayment, finalMethod === 'credit' ? 'cash' : finalMethod, userId || null]
          )
        }

        if (players?.length) {
          for (const p of players) {
            await client.query(
              `INSERT INTO session_players (session_id, player_number, own_controller, controller_fee, extra_person_fee) VALUES ($1,$2,$3,$4,$5)`,
              [sessionId, p.player_number, p.own_controller, p.controller_fee, p.extra_person_fee]
            )
          }
        }

        await client.query('COMMIT')
        return ok(res, { id: sessionId }, 201)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    // ─── POST /api/sessions?action=restore&id=X ─────────────────────
    if (req.method === 'POST' && req.query.action === 'restore') {
      const restoreId = Number(req.query.id)
      if (!restoreId) return err(res, 'Session ID required', 400)

      await client.query('BEGIN')
      try {
        await client.query(`UPDATE sessions SET is_deleted = FALSE WHERE id = $1`, [restoreId])
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,'SESSION_RESTORE',$3)`,
          [Number(userId || 0), req.headers['x-username'] || 'system', `Restored session #${restoreId}`]
        )
        await client.query('COMMIT')
        return ok(res, { success: true })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    return err(res, 'Method not allowed', 405)
  })
}

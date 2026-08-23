import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

function calculateDynamicTariff(hourlyRate, durationMins) {
  const rate = Number(hourlyRate) || 0
  const mins = Number(durationMins) || 0
  if (rate <= 0 || mins <= 0) return 0
  const halfHourRate = Math.round((rate * 0.65) / 5) * 5
  const fullHours = Math.floor(mins / 60)
  const remainderMins = mins % 60
  let total = fullHours * rate
  if (remainderMins > 0) {
    if (remainderMins <= 30) total += halfHourRate
    else total += rate
  }
  return total
}

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
          const oneHrR = await client.query(
            `SELECT price FROM pricing WHERE device_type = $1 AND duration_mins = 60`,
            [sess.device_type]
          )
          const hRate = oneHrR.rowCount > 0
            ? Number(oneHrR.rows[0].price)
            : (sess.device_type === 'PC' ? 70 : sess.device_type === 'XBOX' ? 100 : 120)
          newCharge = calculateDynamicTariff(hRate, newDuration)
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
          } else {
            const oneHrR = await client.query(
              `SELECT price FROM pricing WHERE device_type = $1 AND duration_mins = 60`,
              [sess.device_type]
            )
            const hRate = oneHrR.rowCount > 0
              ? Number(oneHrR.rows[0].price)
              : (sess.device_type === 'PC' ? 70 : sess.device_type === 'XBOX' ? 100 : 120)
            newCharge = calculateDynamicTariff(hRate, newDuration)
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
          `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'SESSION_END_EARLY','sessions',$3,$4)`,
          [
            Number(userId || 0),
            req.headers['x-username'] || 'system',
            `Ended session #${sessionId} early on ${sess.device_label} (Played: ${elapsedMins}m)`,
            JSON.stringify({ sessionId, previous: sess, updated: updated.rows[0], elapsedMins })
          ]
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
          `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'SESSION_SWITCH_STATION','sessions',$3,$4)`,
          [
            Number(userId || 0),
            req.headers['x-username'] || 'system',
            `Moved session #${sessionId} from ${sess.old_label} to ${newDev.label}`,
            JSON.stringify({ sessionId, fromDevice: sess.old_label, toDevice: newDev.label, newDeviceId })
          ]
        )

        await client.query('COMMIT')
        return ok(res, { success: true, new_device_id: newDeviceId, device_label: newDev.label })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    // ─── Route: /api/sessions/:id or /api/sessions?id=X ───────────────────
    const queryId = req.query.id ? Number(req.query.id) : null
    const idMatch = subPath.match(/^(\d+)(\?|$)/) || rawUrl.match(/\/sessions\/(\d+)(\?|$)/)
    const sessionId = idMatch ? Number(idMatch[1]) : queryId

    if (sessionId && !subPath.includes('payments') && !subPath.includes('extend') && !subPath.includes('end-early') && !subPath.includes('switch-station') && !rawUrl.includes('/payments') && !rawUrl.includes('/extend') && !rawUrl.includes('/end-early') && !rawUrl.includes('/switch-station')) {


      if (req.method === 'GET') {
        const [sessR, playersR, salesR, paymentsR] = await Promise.all([
          client.query(
            `SELECT s.*, c.name, c.mobile, c.shop_name, d.label AS device_label, d.type AS device_type,
                    u.username AS created_by_username,
                    (s.date < s.created_at::date) AS is_predated
             FROM sessions s
             LEFT JOIN customers c ON c.id = s.customer_id
             JOIN devices d ON d.id = s.device_id
             LEFT JOIN users u ON u.id = s.created_by
             WHERE s.id = $1`,
            [sessionId]
          ),
          client.query(
            `SELECT sp.*, COALESCE(sp.player_name, cp.name, 'Player ' || sp.player_number) AS display_name, cp.mobile AS player_mobile
             FROM session_players sp
             LEFT JOIN customers cp ON cp.id = sp.customer_id
             WHERE sp.session_id = $1
             ORDER BY sp.player_number ASC`,
            [sessionId]
          ),
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

          let customerId = cur.customer_id
          if (b.name !== undefined || b.mobile !== undefined) {
            const newName = b.name !== undefined ? (b.name ? b.name.trim() : null) : null
            const newMobile = b.mobile !== undefined ? (b.mobile ? b.mobile.trim() : null) : null

            if (customerId) {
              if (newName || newMobile) {
                await client.query(
                  `UPDATE customers SET
                     name = COALESCE($1, name),
                     mobile = COALESCE($2, mobile)
                   WHERE id = $3`,
                  [newName, newMobile, customerId]
                )
              }
            } else if (newName) {
              const existing = await client.query(
                'SELECT id FROM customers WHERE name ILIKE $1 AND (mobile = $2 OR mobile IS NULL)',
                [newName, newMobile]
              )
              if (existing.rows.length > 0) {
                customerId = existing.rows[0].id
                if (newMobile) {
                  await client.query('UPDATE customers SET mobile = COALESCE(mobile, $1) WHERE id = $2', [newMobile, customerId])
                }
              } else {
                const newC = await client.query(
                  'INSERT INTO customers (name, mobile, client_type) VALUES ($1,$2,\'session\') RETURNING id',
                  [newName, newMobile]
                )
                customerId = newC.rows[0].id
              }
            }
          }

          let deviceId = cur.device_id
          if (b.device_id !== undefined && Number(b.device_id) !== cur.device_id) {
            const newDevId = Number(b.device_id)
            const devCheck = await client.query(
              `SELECT d1.type AS old_type, d2.type AS new_type
               FROM devices d1, devices d2
               WHERE d1.id = $1 AND d2.id = $2`,
              [cur.device_id, newDevId]
            )
            // Only allow switching station if it belongs to the exact same device type (preserves tariff matrix)
            if (devCheck.rows.length > 0 && devCheck.rows[0].old_type === devCheck.rows[0].new_type) {
              deviceId = newDevId
            }
          }

          const duration_mins = b.duration_mins !== undefined ? Number(b.duration_mins) : cur.duration_mins
          const time_in       = b.time_in       !== undefined ? b.time_in                 : cur.time_in
          const time_out      = b.time_out      !== undefined ? b.time_out                : cur.time_out
          const charge        = b.charge        !== undefined ? Number(b.charge)          : cur.charge
          const total         = b.total         !== undefined ? Number(b.total)           : cur.total
          const payment_rcvd  = b.payment_received !== undefined ? Number(b.payment_received) : cur.payment_received
          const credit        = b.credit        !== undefined ? Number(b.credit)          : cur.credit
          const remark        = b.remark        !== undefined ? b.remark                  : cur.remark

          const updated = await client.query(
            `UPDATE sessions SET
               customer_id = $1, device_id = $2, duration_mins = $3, time_in = $4, time_out = $5,
               charge = $6, total = $7, payment_received = $8, credit = $9, remark = $10
             WHERE id = $11
             RETURNING *`,
            [customerId, deviceId, duration_mins, time_in, time_out, charge, total, payment_rcvd, credit, remark, sessionId]
          )

          await client.query('COMMIT')
          return ok(res, { success: true, ...updated.rows[0] })
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
          if (sessR.rowCount === 0) {
            await client.query('ROLLBACK')
            return err(res, 'Session not found', 404)
          }
          const sess = sessR.rows[0]

          // Return any attached cafeteria inventory stock
          const salesR = await client.query(
            `SELECT si.item_id, si.qty FROM sales s
             JOIN sale_items si ON si.sale_id = s.id
             WHERE s.session_id = $1`,
            [sessionId]
          )
          for (const item of salesR.rows) {
            await client.query(
              `UPDATE inventory_items SET stock_qty = stock_qty + $1 WHERE id = $2`,
              [item.qty, item.item_id]
            )
          }
          await client.query(`UPDATE sales SET is_deleted = TRUE WHERE session_id = $1`, [sessionId]).catch(async () => {
            await client.query(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE session_id = $1)`, [sessionId]).catch(() => {})
            await client.query(`DELETE FROM sales WHERE session_id = $1`, [sessionId]).catch(() => {})
          })

          await client.query(`UPDATE sessions SET is_deleted = TRUE WHERE id = $1`, [sessionId])
          await client.query(
            `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'SESSION_DELETE','sessions',$3,$4)`,
            [
              Number(userId || 0),
              req.headers['x-username'] || 'system',
              `Deleted session #${sessionId} | Device: ${sess.device_label} | Total: ₹${sess.total}`,
              JSON.stringify({ sessionId, session: sess, returned_sales: salesR.rows })
            ]
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
               (s.time_out > NOW() AND s.date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date) AS is_active,
               (s.date < (s.created_at AT TIME ZONE 'Asia/Kolkata')::date) AS is_predated,
               COALESCE(
                 (SELECT json_agg(json_build_object(
                   'player_number', sp.player_number,
                   'player_name', COALESCE(sp.player_name, cp.name, 'Player ' || sp.player_number),
                   'own_controller', sp.own_controller
                 ) ORDER BY sp.player_number)
                  FROM session_players sp
                  LEFT JOIN customers cp ON cp.id = sp.customer_id
                  WHERE sp.session_id = s.id),
                 '[]'::json
               ) AS players_list
        FROM sessions s

        LEFT JOIN customers c ON c.id = s.customer_id
        JOIN devices d ON d.id = s.device_id
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.is_deleted = FALSE
      `
      const params = []
      if (date) {
        params.push(date)
        query += ` AND s.date = $${params.length}`
      }

      query += ` ORDER BY s.time_in DESC`
      if (limit) {
        params.push(limit)
        query += ` LIMIT $${params.length}`
      }

      const result = await client.query(query, params)
      return ok(res, { sessions: result.rows })
    }

    // ─── POST /api/sessions?action=restore&id=X ─────────────────────
    if (req.method === 'POST' && (req.query.action === 'restore' || req.body?.action === 'restore')) {
      const restoreId = Number(req.query.id || req.body?.id)
      if (!restoreId) return err(res, 'Session ID required', 400)

      await client.query('BEGIN')
      try {
        await client.query(`UPDATE sessions SET is_deleted = FALSE WHERE id = $1`, [restoreId])
        
        // Re-deduct any attached cafeteria inventory items
        const salesR = await client.query(
          `SELECT si.item_id, si.qty FROM sales s
           JOIN sale_items si ON si.sale_id = s.id
           WHERE s.session_id = $1`,
          [restoreId]
        )
        for (const item of salesR.rows) {
          await client.query(
            `UPDATE inventory_items SET stock_qty = GREATEST(0, stock_qty - $1) WHERE id = $2`,
            [item.qty, item.item_id]
          )
        }
        await client.query(`UPDATE sales SET is_deleted = FALSE WHERE session_id = $1`, [restoreId]).catch(() => {})

        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'SESSION_RESTORE','sessions',$3,$4)`,
          [
            Number(userId || 0),
            req.headers['x-username'] || 'system',
            `Restored session #${restoreId}`,
            JSON.stringify({ restoreId, re_deducted_items: salesR.rows })
          ]
        )
        await client.query('COMMIT')
        return ok(res, { success: true })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    if (req.method === 'POST') {
      const body = req.body || {}

      const {
        customer_id, name, mobile, shop_name, device_id, duration_mins,
        time_in, time_out, date, charge, controller_total,
        extra_person_total, total, credit, remark,
        players, payment_method, items,
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

      const todayStr = new Date().toISOString().slice(0, 10)
      const isPredated = date && date < todayStr
      // If session is predated, timestamp initial payment to the session datetime to preserve past ledger integrity & avoid contaminating today's EOD cash drawer
      const paymentCreatedAt = time_in ? new Date(time_in).toISOString() : new Date().toISOString()

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
              'INSERT INTO customers (name, mobile, shop_name, client_type) VALUES ($1,$2,$3,\'session\') RETURNING id',
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
              `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by, created_at) VALUES ($1,$2,'cash','Initial cash payment',$3,$4)`,
              [sessionId, cashAmt, userId || null, paymentCreatedAt]
            )
          }
          if (onlineAmt > 0) {
            await client.query(
              `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by, created_at) VALUES ($1,$2,'online','Initial online payment',$3,$4)`,
              [sessionId, onlineAmt, userId || null, paymentCreatedAt]
            )
          }
        } else if (finalPayment > 0) {
          await client.query(
            `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by, created_at) VALUES ($1,$2,$3,'Initial payment',$4,$5)`,
            [sessionId, finalPayment, finalMethod === 'credit' ? 'cash' : finalMethod, userId || null, paymentCreatedAt]
          )
        }

        if (players?.length) {
          for (const p of players) {
            let pCid = p.customer_id ? Number(p.customer_id) : null
            let pName = p.player_name ? p.player_name.trim() : null

            if (p.player_number === 1 && !pName && name) {
              pName = name.trim()
              pCid = cid
            }

            if (pName && !pCid) {
              const existingP = await client.query('SELECT id FROM customers WHERE name ILIKE $1', [pName])
              if (existingP.rows.length > 0) {
                pCid = existingP.rows[0].id
              } else {
                const newP = await client.query('INSERT INTO customers (name, client_type) VALUES ($1,\'session\') RETURNING id', [pName])
                pCid = newP.rows[0].id
              }
            }

            await client.query(
              `INSERT INTO session_players (session_id, player_number, customer_id, player_name, own_controller, controller_fee, extra_person_fee)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [sessionId, p.player_number, pCid, pName, p.own_controller || false, p.controller_fee || 0, p.extra_person_fee || 0]
            )
          }
        }

        // Attach Initial Cafeteria / Refreshments Sale if items selected
        if (items?.length) {
          const validItems = items.filter(it => Number(it.qty) > 0)
          if (validItems.length > 0) {
            const itemsTotal = validItems.reduce((sum, it) => sum + Number(it.unit_price || 0) * Number(it.qty || 0), 0)
            const saleRes = await client.query(
              `INSERT INTO sales (session_id, customer_id, sale_type, date, total, payment_received, payment_method, created_by)
               VALUES ($1, $2, 'session', $3, $4, 0, $5, $6)
               RETURNING id`,
              [sessionId, cid || null, date, itemsTotal, finalMethod, userId || null]
            )
            const saleId = saleRes.rows[0].id
            for (const it of validItems) {
              await client.query(
                `INSERT INTO sale_items (sale_id, item_id, qty, unit_price)
                 VALUES ($1, $2, $3, $4)`,
                [saleId, it.item_id, it.qty, it.unit_price]
              )
              await client.query(
                `UPDATE inventory_items SET stock_qty = GREATEST(0, stock_qty - $1) WHERE id = $2`,
                [it.qty, it.item_id]
              )
            }
          }
        }

        // Audit Log entry with predated flag
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, module, details, metadata)
           VALUES ($1, $2, $3, 'sessions', $4, $5)`,
          [
            userId ? Number(userId) : null,
            req.headers['x-username'] || 'staff',
            isPredated ? 'SESSION_CREATE_PREDATED' : 'SESSION_CREATE',
            isPredated
              ? `[BACKDATED ENTRY] Created past session #${sessionId} for ${date} (${duration_mins}m)`
              : `Created session #${sessionId} for ${date} (${duration_mins}m)`,
            JSON.stringify({
              sessionId,
              is_predated: isPredated,
              business_date: date,
              time_in,
              time_out,
              total,
              payment: finalPayment,
              created_at: new Date().toISOString()
            })
          ]
        )


        await client.query('COMMIT')
        return ok(res, { id: sessionId, is_predated: isPredated }, 201)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    return err(res, 'Method not allowed', 405)
  })
}

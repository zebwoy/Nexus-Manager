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

/**
 * Post a single entry to customer_ledger and update running_balance.
 * Safe no-op if the table doesn't exist yet (pre-migration).
 * @param {object} client  - pg transaction client
 * @param {object} entry   - { customer_id, module, reference_id, reference_module, amount, description, created_by }
 */
async function postLedger(client, entry) {
  if (!entry.customer_id) return
  try {
    await client.query(
      `INSERT INTO customer_ledger
         (customer_id, module, reference_id, reference_module, amount, description, running_balance, created_by)
       SELECT $1, $2, $3, $4, $5, $6,
         COALESCE((SELECT running_balance FROM customer_ledger WHERE customer_id = $1 ORDER BY id DESC LIMIT 1), 0) + $5,
         $7`,
      [
        entry.customer_id, entry.module, entry.reference_id ?? null,
        entry.reference_module ?? null, entry.amount, entry.description,
        entry.created_by ?? null
      ]
    )
  } catch (e) {
    // Table may not exist yet on first deploy — fail silently so existing
    // session flows are never blocked
    if (!e.message?.includes('customer_ledger')) throw e
  }
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

      const sessR = await client.query('SELECT date, time_in FROM sessions WHERE id = $1', [sessionId])
      if (sessR.rowCount === 0) {
        await client.query('ROLLBACK')
        return err(res, 'Session not found', 404)
      }
      const sess = sessR.rows[0]
      const todayStr = (new Date()).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const sessDateStr = sess.date ? (typeof sess.date === 'string' ? sess.date : sess.date.toISOString().slice(0, 10)) : todayStr
      const isPredated = sessDateStr < todayStr
      const paymentCreatedAt = isPredated
        ? (sess.time_in ? new Date(sess.time_in).toISOString() : new Date(`${sessDateStr}T12:00:00+05:30`).toISOString())
        : new Date().toISOString()

      await client.query('BEGIN')
      try {
        const payR = await client.query(
          `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [sessionId, amt, method, b.note || null, userId || null, paymentCreatedAt]
        )
        const updated = await client.query(
          `UPDATE sessions
           SET payment_received = COALESCE(payment_received, 0) + $1,
               credit = GREATEST(0, credit - $1)
           WHERE id = $2
           RETURNING customer_id, payment_received, credit`,
          [amt, sessionId]
        )
        if (updated.rowCount === 0) {
          await client.query('ROLLBACK')
          return err(res, 'Session not found', 404)
        }
        // Post to customer ledger (payment = negative amount)
        await postLedger(client, {
          customer_id:      updated.rows[0].customer_id,
          module:           'payment',
          reference_id:     payR.rows[0].id,
          reference_module: 'session_payments',
          amount:           -amt,
          description:      `Payment for Session #${sessionId} (${method})`,
          created_by:       userId || null
        })
        await client.query('COMMIT')
        return ok(res, { success: true, payment_received: updated.rows[0].payment_received, credit: updated.rows[0].credit })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    // ─── Route: /api/sessions/:id/adjust ─────────────────────────
    // Unified time adjustment: supports extend (delta_mins > 0) and
    // reduce (delta_mins < 0) with 10-minute slot leeway validation.
    // Legacy /extend route is aliased here for backward compat.
    const adjustMatch  = subPath.match(/(\d+)\/adjust/)  || rawUrl.match(/\/sessions\/(\d+)\/adjust/)
    const legacyExtend = subPath.match(/(\d+)\/extend/)  || rawUrl.match(/\/sessions\/(\d+)\/extend/)
    if ((adjustMatch || legacyExtend) && req.method === 'PATCH') {
      const sessionId = Number((adjustMatch || legacyExtend)[1])
      const b = req.body || {}

      // Legacy /extend used `packets` (multiples of 30); /adjust uses delta_mins directly
      const deltaMins = legacyExtend && b.packets !== undefined
        ? (Number(b.packets) || 1) * 30
        : Number(b.delta_mins)

      if (!deltaMins || deltaMins === 0 || deltaMins % 30 !== 0) {
        return err(res, 'delta_mins must be a non-zero multiple of 30', 400)
      }

      const collectNow = Number(b.collect_now) || 0
      const payMethod  = b.payment_method || 'cash'
      const isReduce   = deltaMins < 0

      await client.query('BEGIN')
      try {
        const sessR = await client.query(
          `SELECT s.*, d.type AS device_type, d.label AS device_label
           FROM sessions s JOIN devices d ON d.id = s.device_id WHERE s.id = $1`,
          [sessionId]
        )
        if (sessR.rowCount === 0) {
          await client.query('ROLLBACK')
          return err(res, 'Session not found', 404)
        }
        const sess = sessR.rows[0]
        const now = new Date()

        // ── Validation 1: session must still be active ──────────
        if (new Date(sess.time_out) <= now) {
          await client.query('ROLLBACK')
          return err(res, 'Session has already ended — adjustments not allowed', 400)
        }

        // ── Validation 2: new time_out must be in the future ────
        const newTimeOut = new Date(new Date(sess.time_out).getTime() + deltaMins * 60000)
        if (newTimeOut <= now) {
          await client.query('ROLLBACK')
          return err(res, 'Reduction would set time-out in the past', 400)
        }

        // ── Validation 3: new duration must be at least 30 mins ─
        const newDuration = Number(sess.duration_mins) + deltaMins
        if (newDuration < 30) {
          await client.query('ROLLBACK')
          return err(res, 'Session duration cannot go below 30 minutes', 400)
        }

        // ── Validation 4 (reduce only): 10-minute slot leeway ───
        // A slot is 30 mins. Leeway = how many minutes into the current slot
        // the client has been playing. If >= 10, that slot is "consumed".
        if (isReduce) {
          const timeIn = new Date(sess.time_in)
          const elapsedMins = (now - timeIn) / 60000
          const elapsedInCurrentSlot = elapsedMins % 30
          if (elapsedInCurrentSlot >= 10) {
            await client.query('ROLLBACK')
            return err(res,
              `Cannot reduce: client has used ${Math.floor(elapsedInCurrentSlot)} min of the current 30-min slot (leeway is 10 min)`,
              400
            )
          }
        }

        // ── Pricing ─────────────────────────────────────────────
        const resolveCharge = async (duration) => {
          const priceR = await client.query(
            `SELECT price FROM pricing WHERE device_type = $1 AND duration_mins = $2`,
            [sess.device_type, duration]
          )
          if (priceR.rowCount > 0) return Number(priceR.rows[0].price)
          const oneHrR = await client.query(
            `SELECT price FROM pricing WHERE device_type = $1 AND duration_mins = 60`,
            [sess.device_type]
          )
          const hRate = oneHrR.rowCount > 0
            ? Number(oneHrR.rows[0].price)
            : (sess.device_type === 'PC' ? 70 : sess.device_type === 'XBOX' ? 100 : 120)
          return calculateDynamicTariff(hRate, duration)
        }

        const oldCharge = Number(sess.charge)
        const newCharge = await resolveCharge(newDuration)
        const deltaCharge = newCharge - oldCharge   // negative = refund

        const newTotal = newCharge + Number(sess.controller_total || 0) + Number(sess.extra_person_total || 0)

        // For reductions: lower payment_received if bill is unsettled (most common).
        // For extensions: add collectNow on top.
        let newPaymentReceived = Number(sess.payment_received || 0)
        let newCredit

        if (isReduce) {
          // If client was overcharged, reduce payment_received proportionally
          // (but never below 0) and let credit = 0 since bill is lowered
          newPaymentReceived = Math.min(newPaymentReceived, newTotal)
          newCredit = Math.max(0, newTotal - newPaymentReceived)
        } else {
          newPaymentReceived = newPaymentReceived + collectNow
          newCredit = Math.max(0, newTotal - newPaymentReceived)
        }

        const updated = await client.query(
          `UPDATE sessions SET
             duration_mins = $1, time_out = $2, charge = $3, total = $4,
             payment_received = $5, credit = $6
           WHERE id = $7
           RETURNING duration_mins, time_out, charge, total, payment_received, credit, customer_id`,
          [newDuration, newTimeOut.toISOString(), newCharge, newTotal, newPaymentReceived, newCredit, sessionId]
        )

        // ── session_payments entry (extension payment collected now) ─
        if (!isReduce && collectNow > 0) {
          const todayStr = (new Date()).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          const sessDateStr = sess.date
            ? (typeof sess.date === 'string' ? sess.date : sess.date.toISOString().slice(0, 10))
            : todayStr
          const payCreatedAt = sessDateStr < todayStr
            ? (sess.time_in ? new Date(sess.time_in).toISOString() : new Date(`${sessDateStr}T12:00:00+05:30`).toISOString())
            : new Date().toISOString()

          const payR = await client.query(
            `INSERT INTO session_payments (session_id, amount, payment_method, note, created_by, created_at)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [sessionId, collectNow, payMethod, `Time extension +${deltaMins} min`, userId || null, payCreatedAt]
          )
          await postLedger(client, {
            customer_id:      updated.rows[0].customer_id,
            module:           'payment',
            reference_id:     payR.rows[0].id,
            reference_module: 'session_payments',
            amount:           -collectNow,
            description:      `Payment for Session #${sessionId} extension (${payMethod})`,
            created_by:       userId || null
          })
        }

        // ── Ledger adjustment entry for the charge delta ─────────
        if (deltaCharge !== 0) {
          await postLedger(client, {
            customer_id:      updated.rows[0].customer_id,
            module:           'adjustment',
            reference_id:     sessionId,
            reference_module: 'sessions',
            amount:           deltaCharge,
            description:      isReduce
              ? `Time reduction −${Math.abs(deltaMins)} min on Session #${sessionId} (refund −₹${Math.abs(deltaCharge)})`
              : `Time extension +${deltaMins} min on Session #${sessionId} (+₹${deltaCharge})`,
            created_by:       userId || null
          })
        }

        // ── Audit log ────────────────────────────────────────────
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, module, details, metadata)
           VALUES ($1,$2,$3,'sessions',$4,$5)`,
          [
            userId ? Number(userId) : null,
            req.headers['x-username'] || 'staff',
            isReduce ? 'SESSION_REDUCE' : 'SESSION_EXTEND',
            `${isReduce ? 'Reduced' : 'Extended'} session #${sessionId} by ${Math.abs(deltaMins)} min | ` +
              `${sess.device_label} | Δcharge: ${deltaCharge >= 0 ? '+' : ''}₹${deltaCharge}`,
            JSON.stringify({
              sessionId,
              delta_mins:   deltaMins,
              delta_charge: deltaCharge,
              before: { duration_mins: sess.duration_mins, time_out: sess.time_out, charge: oldCharge, total: sess.total },
              after:  { duration_mins: newDuration, time_out: newTimeOut.toISOString(), charge: newCharge, total: newTotal },
              collect_now: collectNow,
              adjusted_at: now.toISOString()
            })
          ]
        )

        await client.query('COMMIT')
        return ok(res, {
          success:          true,
          delta_mins:       deltaMins,
          delta_charge:     deltaCharge,
          ...updated.rows[0]
        })
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

    if (sessionId && !subPath.includes('payments') && !subPath.includes('extend') && !subPath.includes('adjust') && !subPath.includes('end-early') && !subPath.includes('switch-station') && !rawUrl.includes('/payments') && !rawUrl.includes('/extend') && !rawUrl.includes('/adjust') && !rawUrl.includes('/end-early') && !rawUrl.includes('/switch-station')) {


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
            `SELECT s.*, COALESCE(
               json_agg(json_build_object('item_id', si.item_id, 'id', ii.id, 'name', ii.name, 'qty', si.qty, 'unit_price', si.unit_price))
               FILTER (WHERE ii.id IS NOT NULL),
               '[]'
             ) AS items
             FROM sales s
             LEFT JOIN sale_items si ON si.sale_id = s.id
             LEFT JOIN inventory_items ii ON ii.id = si.item_id
             WHERE s.session_id = $1 AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)
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

      const gamingTotal = Number(charge || 0) + Number(controller_total || 0) + Number(extra_person_total || 0)
      const validItems = (items || []).filter(it => Number(it.qty) > 0)
      const itemsTotal = validItems.reduce((sum, it) => sum + Number(it.unit_price || 0) * Number(it.qty || 0), 0)
      const fullBill = gamingTotal + itemsTotal

      const finalCredit = (credit !== null && credit !== undefined && credit !== '')
        ? Number(credit) : Math.max(0, fullBill - finalPayment)

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
           charge, controller_total || 0, extra_person_total || 0, gamingTotal,
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


        // ── Customer ledger: session charge entry ────────────────
        if (cid) {
          await postLedger(client, {
            customer_id:      cid,
            module:           'session',
            reference_id:     sessionId,
            reference_module: 'sessions',
            amount:           fullBill,
            description:      `Session #${sessionId} — ${duration_mins} min`,
            created_by:       userId || null
          })
          // If payment was made at booking, record it as a negative ledger entry
          if (finalPayment > 0) {
            await postLedger(client, {
              customer_id:      cid,
              module:           'payment',
              reference_id:     sessionId,
              reference_module: 'sessions',
              amount:           -finalPayment,
              description:      `Initial payment for Session #${sessionId} (${finalMethod})`,
              created_by:       userId || null
            })
          }
        }

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

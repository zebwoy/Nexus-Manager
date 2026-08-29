import { getPool, ok, err } from './_db.js'
import { withTenantClient, resolveEffectiveUserId } from './_tenant.js'

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
    if (!e.message?.includes('customer_ledger')) throw e
  }
}

export default async function handler(req, res) {
  const pool = getPool()
  const username = req.headers['x-username']
  const rawUrl = req.url || ''
  const subPath = String(req.query.path || rawUrl.replace(/^\/api\/recharges\/?/, ''))

  return withTenantClient(pool, req, res, async (client) => {
    const userId = await resolveEffectiveUserId(client, req)

    // ─── Route: PATCH / DELETE /api/recharges/:id or ?id=X ────────
    const queryId = req.query.id ? Number(req.query.id) : null
    const idMatch = subPath.match(/^(\d+)(\?|$)/) || rawUrl.match(/\/recharges\/(\d+)(\?|$)/)
    const rcId = idMatch ? Number(idMatch[1]) : queryId

    if (rcId) {
      if (req.method === 'PATCH') {
        const b = req.body || {}
        const updates = []; const vals = []; let idx = 1
        if (b.game_platform    !== undefined) { updates.push(`game_platform = $${idx++}`);    vals.push(b.game_platform) }
        if (b.cost_price       !== undefined) { updates.push(`cost_price = $${idx++}`);       vals.push(Number(b.cost_price)) }
        if (b.charge_price     !== undefined) { updates.push(`charge_price = $${idx++}`);     vals.push(Number(b.charge_price)) }
        if (b.payment_received !== undefined) { updates.push(`payment_received = $${idx++}`); vals.push(b.payment_received !== null ? Number(b.payment_received) : null) }
        if (b.payment_method   !== undefined) { updates.push(`payment_method = $${idx++}`);   vals.push(b.payment_method) }
        if (b.note             !== undefined) { updates.push(`note = $${idx++}`);             vals.push(b.note) }
        if (b.date             !== undefined) { updates.push(`date = $${idx++}`);             vals.push(b.date) }
        if (updates.length === 0) return err(res, 'No fields to update', 400)
        vals.push(rcId)

        await client.query(`UPDATE recharges SET ${updates.join(', ')} WHERE id = $${idx}`, vals)
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'RECHARGE_EDIT','recharges',$3,$4)`,
          [userId, username || 'system', `Edited recharge #${rcId}`, JSON.stringify(b)]
        )
        return ok(res, { success: true })
      }

      if (req.method === 'DELETE') {
        await client.query('BEGIN')
        try {
          const rcR = await client.query('SELECT * FROM recharges WHERE id = $1', [rcId])
          if (rcR.rowCount === 0) { await client.query('ROLLBACK'); return err(res, 'Recharge not found', 404) }
          const rc = rcR.rows[0]

          await client.query('DELETE FROM recharges WHERE id = $1', [rcId])
          await client.query(
            `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'RECHARGE_DELETE','recharges',$3,$4)`,
            [userId, username || 'system', `Deleted recharge #${rcId} | Platform: ${rc.game_platform} | Charge: ₹${rc.charge_price}`, JSON.stringify(rc)]
          )
          await client.query('COMMIT')
          return ok(res, { success: true })
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        }
      }
    }

    // ─── Base Collection Routes ───────────────────────────────────
    if (req.method === 'GET') {
      const date = req.query.date
      let q = `SELECT r.*, (COALESCE(r.charge_price, 0) - COALESCE(r.cost_price, 0)) AS margin,
                      c.name, u.username AS created_by_username
               FROM recharges r LEFT JOIN customers c ON c.id = r.customer_id
               LEFT JOIN users u ON u.id = r.created_by`
      const vals = []
      const clauses = []

      if (date) {
        clauses.push(`r.date = $${vals.length + 1}`)
        vals.push(date)
      }

      if (clauses.length > 0) {
        q += ` WHERE ` + clauses.join(' AND ')
      }

      q += ` ORDER BY r.date DESC, r.created_at DESC`
      const r = await client.query(q, vals)
      return ok(res, { recharges: r.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      const { customer_id, name, mobile, game_platform, cost_price, charge_price, payment_received, payment_method, note, date } = b

      if (cost_price === undefined || charge_price === undefined) {
        return err(res, 'Cost price and charge price are required')
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
          } else {
            const newC = await client.query(
              'INSERT INTO customers (name, mobile, client_type) VALUES ($1,$2,\'recharge\') RETURNING id',
              [name.trim(), mobile || null]
            )
            cid = newC.rows[0].id
          }
        }

        const r = await client.query(
          `INSERT INTO recharges (customer_id, game_platform, cost_price, charge_price, payment_received, payment_method, note, date, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            cid || null,
            game_platform || null,
            Number(cost_price),
            Number(charge_price),
            payment_received !== undefined && payment_received !== null ? Number(payment_received) : Number(charge_price),
            payment_method || 'cash',
            note || null,
            date || new Date().toISOString().slice(0, 10),
            userId
          ]
        )

        await client.query('COMMIT')

        // ── Customer ledger ──────────────────────────────────────────
        if (cid) {
          const chargePrice = Number(charge_price)
          const payReceived = r.rows[0].payment_received !== null ? Number(r.rows[0].payment_received) : chargePrice
          await postLedger(client, {
            customer_id:      cid,
            module:           'recharge',
            reference_id:     r.rows[0].id,
            reference_module: 'recharges',
            amount:           chargePrice,
            description:      `Recharge — ${game_platform || 'Platform'} #${r.rows[0].id}`,
            created_by:       userId
          })
          if (payReceived > 0) {
            await postLedger(client, {
              customer_id:      cid,
              module:           'payment',
              reference_id:     r.rows[0].id,
              reference_module: 'recharges',
              amount:           -payReceived,
              description:      `Payment for Recharge #${r.rows[0].id} (${payment_method || 'cash'})`,
              created_by:       userId
            })
          }
        }

        return ok(res, { recharge: r.rows[0] }, 201)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }

    return err(res, 'Method not allowed', 405)
  })
}

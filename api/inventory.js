import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const userId = req.headers['x-user-id']
  const url = req.url || ''
  const isSales = req.query.resource === 'sales' || url.includes('sales')

  // ─── SALES ──────────────────────────────────────────────────
  if (isSales) {
    const username = req.headers['x-username']
    // Detect per-sale operations: /api/sales/:id
    const saleIdMatch = (req.url || '').match(/[?&]sale_id=(\d+)/) || (req.url || '').match(/\/sales\/(\d+)/)
    const saleId = saleIdMatch ? Number(saleIdMatch[1]) : (req.query.sale_id ? Number(req.query.sale_id) : null)

    // ── Per-sale PATCH ────────────────────────────────────────
    if (saleId && req.method === 'PATCH') {
      try {
        const b = req.body || {}
        const updates = []; const vals = []; let idx = 1
        if (b.date             !== undefined) { updates.push(`date = $${idx++}`);             vals.push(b.date) }
        if (b.total            !== undefined) { updates.push(`total = $${idx++}`);            vals.push(Number(b.total)) }
        if (b.payment_received !== undefined) { updates.push(`payment_received = $${idx++}`); vals.push(Number(b.payment_received)) }
        if (b.payment_method   !== undefined) { updates.push(`payment_method = $${idx++}`);   vals.push(b.payment_method) }
        if (updates.length === 0) return err(res, 'No fields to update', 400)
        vals.push(saleId)
        await pool.query(`UPDATE sales SET ${updates.join(', ')} WHERE id = $${idx}`, vals)
        await pool.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,'SALE_EDIT',$3)`,
          [userId || null, username || 'system', `Edited walk-in sale #${saleId}`]
        )
        return ok(res, { success: true })
      } catch (e) { console.error(e); return err(res, e, 500) }
    }

    // ── Per-sale DELETE ───────────────────────────────────────
    if (saleId && req.method === 'DELETE') {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Restore stock
        const itemsR = await client.query(`SELECT item_id, qty FROM sale_items WHERE sale_id = $1`, [saleId])
        for (const { item_id, qty } of itemsR.rows) {
          await client.query(`UPDATE inventory_items SET stock_qty = stock_qty + $1 WHERE id = $2`, [qty, item_id])
        }
        const saleR = await client.query(`SELECT * FROM sales WHERE id = $1`, [saleId])
        await client.query(`DELETE FROM sale_items WHERE sale_id = $1`, [saleId])
        await client.query(`DELETE FROM sales WHERE id = $1`, [saleId])
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,'SALE_DELETE',$3)`,
          [Number(userId), username || 'system',
           `Deleted walk-in sale #${saleId} | Date: ${saleR.rows[0]?.date} | Total: ₹${saleR.rows[0]?.total}`]
        )
        await client.query('COMMIT')
        return ok(res, { success: true })
      } catch (e) {
        await client.query('ROLLBACK')
        console.error(e)
        return err(res, e, 500)
      } finally { client.release() }
    }

    try {
      if (req.method === 'GET') {
        const sessionId = req.query.session_id
        const date = req.query.date

        if (sessionId) {
          const r = await pool.query(
            `SELECT sa.id, sa.total, sa.payment_received, sa.payment_method, sa.created_at,
                    json_agg(json_build_object(
                      'name', ii.name, 'qty', si.qty, 'unit_price', si.unit_price
                    )) AS items
             FROM sales sa
             JOIN sale_items si ON si.sale_id = sa.id
             JOIN inventory_items ii ON ii.id = si.item_id
             WHERE sa.session_id = $1
             GROUP BY sa.id ORDER BY sa.created_at`,
            [Number(sessionId)]
          )
          return ok(res, { sales: r.rows })
        }

        // Walk-in sales log (foreign sales)
        const currentOperator = req.headers['x-username']
        const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
        const trialUserId = trialUserRes.rows[0]?.id || 0
        const creatorClause = currentOperator === 'trial'
          ? `AND sa.created_by = ${trialUserId}`
          : `AND (sa.created_by IS NULL OR sa.created_by <> ${trialUserId})`
        const dateClause = date ? `AND sa.date = '${date}'` : ''

        const r = await pool.query(`
          SELECT sa.id, sa.date, sa.total, sa.payment_received, sa.payment_method, sa.created_at,
                 c.name AS customer_name, c.mobile AS customer_mobile, c.shop_name,
                 u.username AS created_by_username,
                 json_agg(json_build_object('name', ii.name, 'qty', si.qty, 'unit_price', si.unit_price)) AS items
          FROM sales sa
          LEFT JOIN customers c ON c.id = sa.customer_id
          LEFT JOIN users u ON u.id = sa.created_by
          LEFT JOIN sale_items si ON si.sale_id = sa.id
          LEFT JOIN inventory_items ii ON ii.id = si.item_id
          WHERE sa.sale_type = 'walkin' ${creatorClause} ${dateClause}
          GROUP BY sa.id, c.name, c.mobile, c.shop_name, u.username
          ORDER BY sa.created_at DESC
        `)
        return ok(res, { sales: r.rows })
      }

      if (req.method === 'POST') {
        const b = req.body || {}
        const client = await pool.connect()
        try {
          await client.query('BEGIN')

          let cid = b.customer_id
          if (!cid && b.name) {
            const ex = await client.query('SELECT id FROM customers WHERE name ILIKE $1 AND (mobile = $2 OR mobile IS NULL)', [b.name.trim(), b.mobile || null])
            if (ex.rows.length > 0) {
              cid = ex.rows[0].id
              if (b.shop_name) {
                await client.query('UPDATE customers SET shop_name = COALESCE(shop_name, $1) WHERE id = $2', [b.shop_name, cid])
              }
            } else {
              const nc = await client.query(
                'INSERT INTO customers (name, mobile, shop_name) VALUES ($1,$2,$3) RETURNING id',
                [b.name.trim(), b.mobile || null, b.shop_name || null]
              )
              cid = nc.rows[0].id
            }
          }

          const saleResult = await client.query(
            `INSERT INTO sales (session_id, customer_id, sale_type, date, total, payment_received, payment_method, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [b.session_id || null, cid || null, b.sale_type || 'walkin', b.date, b.total,
             b.payment_received || null, b.payment_method || 'cash', userId || null]
          )
          const saleId = saleResult.rows[0].id
          for (const item of (b.items || [])) {
            await client.query(
              `INSERT INTO sale_items (sale_id, item_id, qty, unit_price) VALUES ($1,$2,$3,$4)`,
              [saleId, item.item_id, item.qty, item.unit_price]
            )
            const stockR = await client.query(
              `UPDATE inventory_items SET stock_qty = stock_qty - $1
               WHERE id = $2 AND stock_qty >= $1 RETURNING id`,
              [item.qty, item.item_id]
            )
            if (stockR.rowCount === 0) {
              await client.query('ROLLBACK')
              return err(res, `Insufficient stock for item ID ${item.item_id}`, 409)
            }
          }
          await client.query('COMMIT')
          return ok(res, { id: saleId }, 201)
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        } finally { client.release() }
      }

      return err(res, 'Method not allowed', 405)
    } catch (e) {
      console.error(e)
      return err(res, 'Server error', 500)
    }
  }


  // ─── INVENTORY ──────────────────────────────────────────────
  try {
    if (req.method === 'GET') {
      const currentOperator = req.headers['x-username']
      let query = 'SELECT ii.* FROM inventory_items ii'
      const vals = []
      
      if (currentOperator === 'trial') {
        const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
        const trialUserId = trialUserRes.rows[0]?.id
        query += ' WHERE ii.is_active = TRUE AND ii.created_by = $1'
        vals.push(trialUserId || 0)
      } else {
        const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
        const trialUserId = trialUserRes.rows[0]?.id
        query += ' WHERE ii.is_active = TRUE AND (ii.created_by IS NULL OR ii.created_by <> $1)'
        vals.push(trialUserId || 0)
      }
      query += ' ORDER BY ii.category, ii.name'
      const r = await pool.query(query, vals)
      return ok(res, { items: r.rows })
    }

    if (req.method === 'POST') {
      const action = req.query.action
      const currentOperator = req.headers['x-username']

      if (action === 'restore') {
        const id = req.query.id
        // Trial user can only restore items they own
        if (currentOperator === 'trial') {
          const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
          const trialUserId = trialUserRes.rows[0]?.id
          const ownerCheck = await pool.query('SELECT id FROM inventory_items WHERE id = $1 AND created_by = $2', [Number(id), trialUserId])
          if (ownerCheck.rowCount === 0) return err(res, 'Access denied: Cannot restore production items from trial account', 403)
        }
        await pool.query('UPDATE inventory_items SET is_active = TRUE WHERE id = $1', [Number(id)])
        await pool.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,$3,$4)`,
          [userId || null, req.headers['x-username'] || 'system', 'RESTORE_INVENTORY', `Restored deleted cafeteria item ID: ${id}`]
        )
        return ok(res, { success: true })
      }
      
      const b = req.body || {}
      await pool.query(
        `INSERT INTO inventory_items (name, category, buy_price, sell_price, stock_qty, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [b.name, b.category, b.buy_price || 0, b.sell_price, b.stock_qty || 0, userId || null]
      )
      return ok(res, { success: true }, 201)
    }

    if (req.method === 'PUT') {
      const id = req.query.id
      const b = req.body || {}
      const currentOperator = req.headers['x-username']

      // Trial user can only update items they own
      if (currentOperator === 'trial') {
        const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
        const trialUserId = trialUserRes.rows[0]?.id
        const ownerCheck = await pool.query('SELECT id FROM inventory_items WHERE id = $1 AND created_by = $2', [Number(id), trialUserId])
        if (ownerCheck.rowCount === 0) return err(res, 'Access denied: Cannot modify production items from trial account', 403)
      }

      await pool.query(
        `UPDATE inventory_items
         SET name = $1, category = $2, sell_price = $3, buy_price = $4, stock_qty = $5
         WHERE id = $6`,
        [b.name, b.category, Number(b.sell_price), Number(b.buy_price || 0), Number(b.stock_qty || 0), Number(id)]
      )
      await pool.query(
        `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,$3,$4)`,
        [userId || null, req.headers['x-username'] || 'system', 'UPDATE_INVENTORY', `Updated cafeteria item: ${b.name}`]
      )
      return ok(res, { success: true })
    }

    if (req.method === 'DELETE') {
      const id = req.query.id
      const currentOperator = req.headers['x-username']

      // Trial user can only delete items they own
      if (currentOperator === 'trial') {
        const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
        const trialUserId = trialUserRes.rows[0]?.id
        const ownerCheck = await pool.query('SELECT id FROM inventory_items WHERE id = $1 AND created_by = $2', [Number(id), trialUserId])
        if (ownerCheck.rowCount === 0) return err(res, 'Access denied: Cannot delete production items from trial account', 403)
      }

      const r = await pool.query('UPDATE inventory_items SET is_active = FALSE WHERE id = $1 RETURNING name', [Number(id)])
      await pool.query(
        `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1,$2,$3,$4)`,
        [userId || null, req.headers['x-username'] || 'system', 'DELETE_INVENTORY', `Soft-deleted cafeteria item: ${r.rows[0]?.name || id}`]
      )
      return ok(res, { success: true })
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err(res, 'Server error', 500)
  }
}

import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const rawUserId = req.headers['x-user-id']
  const userId = rawUserId && !isNaN(Number(rawUserId)) ? Number(rawUserId) : null
  const url = req.url || ''
  const resource = req.query.resource || (
    url.includes('sales') ? 'sales' :
    url.includes('expenses') ? 'expenses' :
    url.includes('customers') ? 'customers' : 'inventory'
  )

  return withTenantClient(pool, req, res, async (client) => {
    // ─── CUSTOMERS ──────────────────────────────────────────────
    if (resource === 'customers') {
      if (req.method === 'GET') {
        const search = req.query.search
        const view = req.query.view || 'session'

        if (search) {
          const r = await client.query(
            `SELECT id, name, mobile, shop_name, pancafe_username, address, client_type
             FROM customers
             WHERE name ILIKE $1 OR mobile ILIKE $1 OR shop_name ILIKE $1 OR pancafe_username ILIKE $1 OR address ILIKE $1
             ORDER BY name LIMIT 15`,
            [`%${search.trim()}%`]
          )
          return ok(res, { customers: r.rows })
        }

        if (view === 'vendor') {
          const r = await client.query(`
            SELECT
              c.id, c.name, c.mobile, c.shop_name, c.address, c.client_type, c.created_at,
              COUNT(DISTINCT e.id) AS expense_count,
              COALESCE(SUM(e.amount), 0) AS total_expense_amount
            FROM customers c
            LEFT JOIN expenses e ON (e.vendor_name ILIKE c.name)
            WHERE c.client_type = 'vendor' OR e.id IS NOT NULL
            GROUP BY c.id
            ORDER BY total_expense_amount DESC, c.name ASC
            LIMIT 100
          `)
          return ok(res, { customers: r.rows })
        }

        if (view === 'all') {
          const r = await client.query(`
            SELECT
              c.id, c.name, c.mobile, c.shop_name, c.address, c.client_type, c.created_at,
              COUNT(DISTINCT s.id) AS session_count,
              COUNT(DISTINCT e.id) AS expense_count
            FROM customers c
            LEFT JOIN sessions s ON s.customer_id = c.id AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)
            LEFT JOIN expenses e ON e.vendor_name ILIKE c.name
            GROUP BY c.id
            ORDER BY c.created_at DESC, c.name ASC
            LIMIT 100
          `)
          return ok(res, { customers: r.rows })
        }

        if (view === 'cafeteria') {
          const r = await client.query(`
            SELECT
              c.id, c.name, c.mobile, c.shop_name, c.address, c.client_type, c.created_at,
              COUNT(DISTINCT s.id) AS session_count
            FROM customers c
            JOIN sales s ON s.customer_id = c.id
            WHERE s.is_deleted IS NULL OR s.is_deleted = FALSE
            GROUP BY c.id
            ORDER BY session_count DESC, c.name ASC
            LIMIT 100
          `)
          return ok(res, { customers: r.rows })
        }

        const r = await client.query(`
          SELECT
            c.id, c.name, c.mobile, c.shop_name, c.address, c.client_type, c.pancafe_username, c.created_at,
            COUNT(DISTINCT s.id) AS session_count
          FROM customers c
          JOIN sessions s ON (s.customer_id = c.id OR s.id IN (SELECT session_id FROM session_players WHERE customer_id = c.id))
          WHERE s.is_deleted IS NULL OR s.is_deleted = FALSE
          GROUP BY c.id
          ORDER BY session_count DESC, c.name ASC
          LIMIT 100
        `)
        return ok(res, { customers: r.rows })
      }

      if (req.method === 'POST') {
        const b = req.body || {}
        const { name, mobile, shop_name, pancafe_username, address, client_type } = b
        if (!name) return err(res, 'Name is required')

        const r = await client.query(
          `INSERT INTO customers (name, mobile, shop_name, pancafe_username, address, client_type)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [name.trim(), mobile?.trim() || null, shop_name?.trim() || null, pancafe_username?.trim() || null, address?.trim() || null, client_type || 'customer']
        )
        return ok(res, { customer: r.rows[0] }, 201)
      }

      return err(res, 'Method not allowed', 405)
    }

    // ─── EXPENSES ───────────────────────────────────────────────
    if (resource === 'expenses') {
      const username = req.headers['x-username']
      const expIdMatch = (req.url || '').match(/[?&]expense_id=(\d+)/) || (req.url || '').match(/\/expenses\/(\d+)/)
      const expenseId = expIdMatch ? Number(expIdMatch[1]) : (req.query.expense_id ? Number(req.query.expense_id) : (req.query.id ? Number(req.query.id) : null))

      // ── Per-expense PATCH ─────────────────────────────────────
      if (expenseId && req.method === 'PATCH') {
        const b = req.body || {}
        const updates = []; const vals = []; let idx = 1
        if (b.category        !== undefined) { updates.push(`category = $${idx++}`);        vals.push(b.category) }
        if (b.amount          !== undefined) { updates.push(`amount = $${idx++}`);          vals.push(Number(b.amount)) }
        if (b.vendor_name     !== undefined) { updates.push(`vendor_name = $${idx++}`);     vals.push(b.vendor_name || null) }
        if (b.vendor_address  !== undefined) { updates.push(`vendor_address = $${idx++}`);  vals.push(b.vendor_address || null) }
        if (b.note            !== undefined) { updates.push(`note = $${idx++}`);            vals.push(b.note || null) }
        if (b.date            !== undefined) { updates.push(`date = $${idx++}`);            vals.push(b.date) }
        if (b.payment_method  !== undefined) { updates.push(`payment_method = $${idx++}`);  vals.push(b.payment_method) }
        if (b.receipt_url     !== undefined) { updates.push(`receipt_url = $${idx++}`);     vals.push(b.receipt_url || null) }
        if (b.packs_count     !== undefined) { updates.push(`packs_count = $${idx++}`);     vals.push(Number(b.packs_count)) }
        if (b.pack_size       !== undefined) { updates.push(`pack_size = $${idx++}`);       vals.push(Number(b.pack_size)) }
        if (b.unit_buy_price  !== undefined) { updates.push(`unit_buy_price = $${idx++}`);  vals.push(Number(b.unit_buy_price)) }
        if (b.unit_sell_price !== undefined) { updates.push(`unit_sell_price = $${idx++}`); vals.push(Number(b.unit_sell_price)) }
        if (updates.length === 0) return err(res, 'No fields to update', 400)
        vals.push(expenseId)
        await client.query(`UPDATE expenses SET ${updates.join(', ')} WHERE id = $${idx}`, vals)

        // If vendor updated, upsert into vendor registry
        if (b.vendor_name && b.vendor_name.trim()) {
          const vName = b.vendor_name.trim()
          const vAddr = b.vendor_address ? b.vendor_address.trim() : null
          const existingV = await client.query('SELECT id FROM customers WHERE name ILIKE $1', [vName])
          if (existingV.rows.length === 0) {
            await client.query('INSERT INTO customers (name, address, client_type) VALUES ($1, $2, $3)', [vName, vAddr, 'vendor'])
          } else if (vAddr) {
            await client.query('UPDATE customers SET address = COALESCE($1, address) WHERE id = $2', [vAddr, existingV.rows[0].id])
          }
        }

        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'EXPENSE_EDIT','expenses',$3,$4)`,
          [userId || null, username || 'system', `Edited expense #${expenseId}`, JSON.stringify(b)]
        )
        return ok(res, { success: true })
      }

      // ── Per-expense DELETE ────────────────────────────────────
      if (expenseId && req.method === 'DELETE') {
        await client.query('BEGIN')
        try {
          const expR = await client.query('SELECT * FROM expenses WHERE id = $1', [expenseId])
          if (expR.rowCount === 0) { await client.query('ROLLBACK'); return err(res, 'Expense not found', 404) }
          const exp = expR.rows[0]
          await client.query('DELETE FROM expenses WHERE id = $1', [expenseId])
          await client.query(
            `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'EXPENSE_DELETE','expenses',$3,$4)`,
            [userId || null, username || 'system', `Deleted expense #${expenseId} | Category: ${exp.category} | Amount: ₹${exp.amount}`, JSON.stringify(exp)]
          )
          await client.query('COMMIT')
          return ok(res, { success: true })
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        }
      }

      if (req.method === 'GET') {
        const date = req.query.date
        let q = `
          SELECT
            e.*,
            u.username AS created_by_username,
            ii.name AS item_name,
            COALESCE(e.unit_sell_price, ii.sell_price) AS resolved_sell_price,
            COALESCE(e.unit_buy_price, ii.buy_price) AS resolved_buy_price
          FROM expenses e
          LEFT JOIN users u ON u.id = e.created_by
          LEFT JOIN inventory_items ii ON ii.id = e.item_id
        `
        const vals = []
        const clauses = []
        if (date) {
          clauses.push(`e.date = $${vals.length + 1}`)
          vals.push(date)
        }
        if (clauses.length > 0) q += ` WHERE ` + clauses.join(' AND ')
        q += ` ORDER BY e.date DESC, e.created_at DESC`
        const r = await client.query(q, vals)
        return ok(res, { expenses: r.rows })
      }

      if (req.method === 'POST') {
        const b = req.body || {}
        const {
          category, amount, vendor_name, vendor_address, note, date,
          payment_method, item_id, units, packs_count, pack_size,
          unit_sell_price, new_item, receipt_url
        } = b
        if (!amount) return err(res, 'Amount is required')

        await client.query('BEGIN')
        try {
          let userNote = (note || '').trim()
          let linkedItemId = item_id ? Number(item_id) : null
          let numPacks = packs_count ? Math.max(1, Number(packs_count)) : 1
          let perPackSize = pack_size ? Math.max(1, Number(pack_size)) : (units ? Number(units) : 1)
          let totalSellableUnits = units ? Number(units) : (numPacks * perPackSize)
          let calculatedBuyPrice = totalSellableUnits > 0 ? Number((Number(amount) / totalSellableUnits).toFixed(2)) : 0
          let sellPrice = unit_sell_price ? Number(unit_sell_price) : null

          if (category === 'Cafeteria') {
            if (item_id && totalSellableUnits > 0) {
              const itemR = await client.query(
                `UPDATE inventory_items 
                 SET stock_qty = stock_qty + $1,
                     buy_price = $2,
                     sell_price = COALESCE($3, sell_price)
                 WHERE id = $4 RETURNING name, stock_qty, sell_price`,
                [totalSellableUnits, calculatedBuyPrice, sellPrice, Number(item_id)]
              )
              const item = itemR.rows[0]
              linkedItemId = Number(item_id)
              if (!sellPrice && item?.sell_price) {
                sellPrice = Number(item.sell_price)
              }
            } else if (new_item && totalSellableUnits > 0) {
              sellPrice = Number(new_item.sell_price) || 0
              const newRes = await client.query(
                `INSERT INTO inventory_items (name, category, buy_price, sell_price, initial_stock, stock_qty, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, sell_price`,
                [
                  new_item.name,
                  new_item.category || 'Drinks',
                  calculatedBuyPrice,
                  sellPrice,
                  totalSellableUnits,
                  totalSellableUnits,
                  userId
                ]
              )
              linkedItemId = newRes.rows[0]?.id || null
            }
          }

          // Auto-sync vendor into registry
          const vName = vendor_name ? vendor_name.trim() : null
          const vAddr = vendor_address ? vendor_address.trim() : null
          if (vName) {
            const existingV = await client.query('SELECT id FROM customers WHERE name ILIKE $1', [vName])
            if (existingV.rows.length === 0) {
              await client.query('INSERT INTO customers (name, address, client_type) VALUES ($1, $2, $3)', [vName, vAddr, 'vendor'])
            } else if (vAddr) {
              await client.query('UPDATE customers SET address = COALESCE($1, address) WHERE id = $2', [vAddr, existingV.rows[0].id])
            }
          }

          const r = await client.query(
            `INSERT INTO expenses (
              category, amount, vendor_name, vendor_address, note, item_id,
              units, packs_count, pack_size, unit_buy_price, unit_sell_price,
              receipt_url, date, payment_method, created_by
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
            [
              category || 'Other',
              amount,
              vName,
              vAddr,
              userNote || null,
              linkedItemId,
              totalSellableUnits,
              numPacks,
              perPackSize,
              calculatedBuyPrice,
              sellPrice,
              receipt_url || null,
              date || new Date().toISOString().slice(0, 10),
              payment_method || 'cash',
              userId
            ]
          )

          await client.query(
            `INSERT INTO audit_logs (user_id, username, action, module, details, metadata)
             VALUES ($1, $2, 'EXPENSE_CREATE', 'expenses', $3, $4)`,
            [
              userId,
              req.headers['x-username'] || 'staff',
              `Recorded expense of ₹${amount} (${category || 'Other'}) — ${vName ? `Vendor: ${vName}. ` : ''}${userNote ? `Note: ${userNote}` : ''}`.trim(),
              JSON.stringify({ expense: r.rows[0], category, amount, payment_method: payment_method || 'cash' })
            ]
          )

          await client.query('COMMIT')
          return ok(res, { expense: r.rows[0] }, 201)
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        }
      }

      return err(res, 'Method not allowed', 405)
    }


    // ─── SALES ──────────────────────────────────────────────────
    if (resource === 'sales') {
      const username = req.headers['x-username']
      const saleIdMatch = (req.url || '').match(/[?&]sale_id=(\d+)/) || (req.url || '').match(/\/sales\/(\d+)/)
      const saleId = saleIdMatch ? Number(saleIdMatch[1]) : (req.query.sale_id ? Number(req.query.sale_id) : null)

      // ── Per-sale PATCH ────────────────────────────────────────
      if (saleId && req.method === 'PATCH') {
        const b = req.body || {}
        const updates = []; const vals = []; let idx = 1
        if (b.date             !== undefined) { updates.push(`date = $${idx++}`);             vals.push(b.date) }
        if (b.total            !== undefined) { updates.push(`total = $${idx++}`);            vals.push(Number(b.total)) }
        if (b.payment_received !== undefined) { updates.push(`payment_received = $${idx++}`); vals.push(Number(b.payment_received)) }
        if (b.payment_method   !== undefined) { updates.push(`payment_method = $${idx++}`);   vals.push(b.payment_method) }
        if (updates.length === 0) return err(res, 'No fields to update', 400)
        vals.push(saleId)
        await client.query(`UPDATE sales SET ${updates.join(', ')} WHERE id = $${idx}`, vals)
        await client.query(
          `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'SALE_EDIT','cafeteria',$3,$4)`,
          [userId || null, username || 'system', `Edited walk-in sale #${saleId}`, JSON.stringify(b)]
        )
        return ok(res, { success: true })
      }

      // ── Per-sale DELETE ───────────────────────────────────────
      if (saleId && req.method === 'DELETE') {
        await client.query('BEGIN')
        try {
          // Restore stock
          const itemsR = await client.query(`SELECT item_id, qty FROM sale_items WHERE sale_id = $1`, [saleId])
          for (const { item_id, qty } of itemsR.rows) {
            await client.query(`UPDATE inventory_items SET stock_qty = stock_qty + $1 WHERE id = $2`, [qty, item_id])
          }
          const saleR = await client.query(`SELECT * FROM sales WHERE id = $1`, [saleId])
          await client.query(`DELETE FROM sale_items WHERE sale_id = $1`, [saleId])
          await client.query(`DELETE FROM sales WHERE id = $1`, [saleId])
          await client.query(
            `INSERT INTO audit_logs (user_id, username, action, module, details, metadata) VALUES ($1,$2,'SALE_DELETE','cafeteria',$3,$4)`,
            [Number(userId), username || 'system',
             `Deleted walk-in sale #${saleId} | Date: ${saleR.rows[0]?.date} | Total: ₹${saleR.rows[0]?.total}`,
             JSON.stringify({ deleted_sale: saleR.rows[0], restored_items: itemsR.rows })]
          )
          await client.query('COMMIT')
          return ok(res, { success: true })
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        }
      }

      // ── Collection GET ────────────────────────────────────────
      if (req.method === 'GET') {
        const date = req.query.date
        const sessionId = req.query.session_id
        const saleType = req.query.sale_type
        let q = `
          SELECT s.*, c.name AS customer_name, c.shop_name, c.mobile AS customer_mobile,
                 u.username AS created_by_username,
                 json_agg(json_build_object('id', ii.id, 'name', ii.name, 'qty', si.qty, 'unit_price', si.unit_price)) AS items
          FROM sales s
          LEFT JOIN customers c ON c.id = s.customer_id
          LEFT JOIN users u ON u.id = s.created_by
          LEFT JOIN sale_items si ON si.sale_id = s.id
          LEFT JOIN inventory_items ii ON ii.id = si.item_id
        `
        const vals = []
        const clauses = []
        if (date) {
          clauses.push(`s.date = $${vals.length + 1}`)
          vals.push(date)
        }
        if (sessionId) {
          clauses.push(`s.session_id = $${vals.length + 1}`)
          vals.push(sessionId)
        } else if (saleType) {
          clauses.push(`s.sale_type = $${vals.length + 1}`)
          vals.push(saleType)
        } else {
          // Only return standalone walk-in sales unless querying a specific session
          clauses.push(`s.sale_type = 'walkin'`)
        }
        clauses.push(`(s.is_deleted IS NULL OR s.is_deleted = FALSE)`)

        if (clauses.length > 0) q += ` WHERE ` + clauses.join(' AND ')
        q += ` GROUP BY s.id, c.id, u.id ORDER BY s.created_at DESC`
        const result = await client.query(q, vals)
        return ok(res, { sales: result.rows })
      }

      // ── Collection POST ───────────────────────────────────────
      if (req.method === 'POST') {
        const b = req.body || {}
        const { session_id, customer_id, name, shop_name, mobile, sale_type, date, total, payment_received, payment_method, items } = b

        if (!items || !items.length) return err(res, 'At least one item is required')
        if (sale_type === 'walkin' || !session_id) {
          if (!name || !name.trim()) return err(res, 'Customer Name is required')
          if (!shop_name || !shop_name.trim()) return err(res, 'Shop Name is required')
        }
        const client_cid = customer_id || null


        await client.query('BEGIN')
        try {
          let cid = client_cid
          if (!cid && name) {
            const existing = await client.query(
              'SELECT id FROM customers WHERE name ILIKE $1 AND (mobile = $2 OR mobile IS NULL)',
              [name.trim(), mobile || null]
            )
            if (existing.rows.length > 0) {
              cid = existing.rows[0].id
              if (shop_name) {
                await client.query('UPDATE customers SET shop_name = COALESCE(shop_name, $1) WHERE id = $2', [shop_name, cid])
              }
            } else {
              const newC = await client.query(
                'INSERT INTO customers (name, mobile, shop_name) VALUES ($1,$2,$3) RETURNING id',
                [name.trim(), mobile || null, shop_name || null]
              )
              cid = newC.rows[0].id
            }
          }

          const saleRes = await client.query(
            `INSERT INTO sales (session_id, customer_id, sale_type, date, total, payment_received, payment_method, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [
              session_id ? Number(session_id) : null,
              cid,
              sale_type || 'walkin',
              date || new Date().toISOString().slice(0, 10),
              Number(total),
              payment_received !== undefined && payment_received !== null ? Number(payment_received) : Number(total),
              payment_method || 'cash',
              userId ? Number(userId) : null
            ]
          )
          const sid = saleRes.rows[0].id

          for (const it of items) {
            await client.query(
              `INSERT INTO sale_items (sale_id, item_id, qty, unit_price) VALUES ($1, $2, $3, $4)`,
              [sid, it.item_id, it.qty, it.unit_price]
            )
            await client.query(
              `UPDATE inventory_items SET stock_qty = stock_qty - $1 WHERE id = $2`,
              [it.qty, it.item_id]
            )
          }

          await client.query('COMMIT')
          return ok(res, { id: sid, total }, 201)
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        }
      }
    }

    // ─── INVENTORY ITEMS CRUD (Default) ──────────────────────────
    if (req.method === 'GET') {
      const r = await client.query(`
        SELECT
          i.id,
          i.name,
          i.category,
          i.buy_price,
          i.sell_price,
          i.is_active,
          i.created_by,
          COALESCE(i.initial_stock, 0) AS initial_stock,
          GREATEST(
            0,
            COALESCE(i.initial_stock, 0)
            + COALESCE((SELECT SUM(e.units) FROM expenses e WHERE e.item_id = i.id AND e.category = 'Cafeteria'), 0)
            - COALESCE((
                SELECT SUM(si.qty)
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                LEFT JOIN sessions sess ON sess.id = s.session_id
                WHERE si.item_id = i.id
                  AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)
                  AND (sess.id IS NULL OR sess.is_deleted IS NULL OR sess.is_deleted = FALSE)
              ), 0)
          ) AS stock_qty
        FROM inventory_items i
        WHERE i.is_active = TRUE
        ORDER BY i.name
      `)
      return ok(res, { items: r.rows })
    }

    if (req.method === 'POST') {
      if (req.query.action === 'restore') {
        const id = Number(req.query.id)
        if (!id) return err(res, 'Item ID required', 400)
        await client.query('UPDATE inventory_items SET is_active = TRUE WHERE id = $1', [id])
        return ok(res, { success: true })
      }

      const b = req.body || {}
      const { name, category, buy_price, sell_price, stock_qty } = b
      if (!name || !sell_price) return err(res, 'Name and sell price are required')

      const qty = Number(stock_qty || 0)
      const bPrice = Number(buy_price || 0)
      const r = await client.query(
        `INSERT INTO inventory_items (name, category, buy_price, sell_price, initial_stock, stock_qty, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, category || 'Drinks', bPrice, Number(sell_price), qty, qty, userId ? Number(userId) : null]
      )
      return ok(res, { item: r.rows[0] }, 201)
    }

    if (req.method === 'PUT') {
      const id = req.query.id
      if (!id) return err(res, 'Item ID required')
      const b = req.body || {}
      const { name, category, buy_price, sell_price, stock_qty } = b

      const qty = stock_qty !== undefined ? Number(stock_qty) : null
      const r = await client.query(
        `UPDATE inventory_items
         SET name = $1, category = $2, buy_price = $3, sell_price = $4,
             initial_stock = COALESCE($5, initial_stock),
             stock_qty = COALESCE($5, stock_qty)
         WHERE id = $6 RETURNING *`,
        [name, category, buy_price, sell_price, qty, id]
      )
      return ok(res, { item: r.rows[0] })
    }

    if (req.method === 'DELETE') {
      const id = req.query.id
      if (!id) return err(res, 'Item ID required')
      await client.query('UPDATE inventory_items SET is_active = FALSE WHERE id = $1', [id])
      return ok(res, { success: true })
    }

    return err(res, 'Method not allowed', 405)
  })
}

import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const userId = req.headers['x-user-id']
  const url = req.url || ''
  const isSales = req.query.resource === 'sales' || url.includes('sales')

  // ─── SALES ──────────────────────────────────────────────────
  if (isSales) {
    try {
      if (req.method === 'GET') {
        const sessionId = req.query.session_id
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
        return err(res, 'session_id required for GET')
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
      const r = await pool.query('SELECT * FROM inventory_items WHERE is_active = TRUE ORDER BY category, name')
      return ok(res, { items: r.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      await pool.query(
        `INSERT INTO inventory_items (name, category, buy_price, sell_price, stock_qty) VALUES ($1,$2,$3,$4,$5)`,
        [b.name, b.category, b.buy_price || 0, b.sell_price, b.stock_qty || 0]
      )
      return ok(res, { success: true }, 201)
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err(res, 'Server error', 500)
  }
}

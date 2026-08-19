import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()
  const rawUserId = req.headers['x-user-id']
  const userId = rawUserId && !isNaN(Number(rawUserId)) ? Number(rawUserId) : null

  return withTenantClient(pool, req, res, async (client) => {
    if (req.method === 'GET') {
      const date = req.query.date
      const currentOperator = req.headers['x-username']
      
      let q = `SELECT e.*, u.username AS created_by_username FROM expenses e LEFT JOIN users u ON u.id = e.created_by`
      const vals = []
      const clauses = []
      
      if (date) {
        clauses.push(`e.date = $${vals.length + 1}`)
        vals.push(date)
      }
      
      if (clauses.length > 0) {
        q += ` WHERE ` + clauses.join(' AND ')
      }
      
      q += ` ORDER BY e.date DESC, e.created_at DESC`
      const r = await client.query(q, vals)
      return ok(res, { expenses: r.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      const { category, amount, vendor_name, note, date, payment_method, item_id, units, new_item } = b
      if (!amount) return err(res, 'Amount is required')

      await client.query('BEGIN')
      try {
        let finalNote = note || ''

        if (category === 'Cafeteria') {
          if (item_id && units) {
            const itemR = await client.query(
              `UPDATE inventory_items 
               SET stock_qty = stock_qty + $1,
                   buy_price = $2
               WHERE id = $3 RETURNING name, stock_qty`,
              [Number(units), Number((Number(amount) / Number(units)).toFixed(2)), Number(item_id)]
            )
            const item = itemR.rows[0]
            finalNote = `Restocked ${units} units of ${item?.name || 'item'}. ` + finalNote
          } else if (new_item && units) {
            const calculatedBuyPrice = Number((Number(amount) / Number(units)).toFixed(2))
            const newRes = await client.query(
              `INSERT INTO inventory_items (name, category, buy_price, sell_price, stock_qty, created_by)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name`,
              [
                new_item.name,
                new_item.category || 'Drinks',
                calculatedBuyPrice,
                Number(new_item.sell_price),
                Number(units),
                userId
              ]
            )
            finalNote = `Added and stocked ${units} units of ${newRes.rows[0]?.name || 'new product'}. ` + finalNote
          }
        }

        const r = await client.query(
          `INSERT INTO expenses (category, amount, vendor_name, note, date, payment_method, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            category || 'Other',
            amount,
            vendor_name || null,
            finalNote.trim() || null,
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
            `Recorded expense of ₹${amount} (${category || 'Other'}) — ${vendor_name ? `Vendor: ${vendor_name}. ` : ''}${finalNote ? `Note: ${finalNote}` : ''}`.trim(),
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
  })
}

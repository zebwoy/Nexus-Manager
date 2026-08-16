import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const userId = req.headers['x-user-id']

  try {
    if (req.method === 'GET') {
      const date = req.query.date
      const currentOperator = req.headers['x-username']
      
      let q = `SELECT e.*, u.username AS created_by_username FROM expenses e LEFT JOIN users u ON u.id = e.created_by`
      const vals = []
      const clauses = []
      
      if (currentOperator === 'trial') {
        clauses.push(`u.username = 'trial'`)
      } else {
        clauses.push(`(u.username IS NULL OR u.username <> 'trial')`)
      }
      
      if (date) {
        clauses.push(`e.date = $${vals.length + 1}`)
        vals.push(date)
      }
      
      if (clauses.length > 0) {
        q += ` WHERE ` + clauses.join(' AND ')
      }
      
      q += ` ORDER BY e.created_at DESC`
      const r = await pool.query(q, vals)
      return ok(res, { expenses: r.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      
      if (b.category === 'Cafeteria') {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          
          let finalItemId = b.item_id
          let itemName = ''
          
          // 1. If it's a new item, insert it into inventory_items
          if (!finalItemId && b.new_item) {
            const buyPrice = Number(b.amount) / Number(b.units || 1)
            const newIt = await client.query(
              `INSERT INTO inventory_items (name, category, buy_price, sell_price, stock_qty, created_by)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name`,
              [b.new_item.name, b.new_item.category || 'Drinks', buyPrice, Number(b.new_item.sell_price), Number(b.units || 1), userId || null]
            )
            finalItemId = newIt.rows[0].id
            itemName = newIt.rows[0].name
          } else if (finalItemId) {
            // 2. If it's an existing item, update its stock and cost price
            const buyPrice = Number(b.amount) / Number(b.units || 1)
            const upIt = await client.query(
              `UPDATE inventory_items
               SET stock_qty = stock_qty + $1, buy_price = $2
               WHERE id = $3 RETURNING name`,
              [Number(b.units || 1), buyPrice, finalItemId]
            )
            itemName = upIt.rows[0]?.name || ''
          }

          // 3. Create the expense record
          const noteDetails = `Cafeteria inventory purchase: ${b.units} units of ${itemName}. ${b.note || ''}`.trim()
          await client.query(
            `INSERT INTO expenses (date, category, amount, note, payment_method, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
            [b.date, b.category, b.amount, noteDetails, b.payment_method || 'cash', userId || null]
          )

          // 4. Create an audit log
          await client.query(
            `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
            [userId || null, req.headers['x-username'] || 'system', 'CAFETERIA_EXPENSE', `Logged cafeteria inventory expense of ₹${b.amount} for ${b.units} units of ${itemName}`]
          )

          await client.query('COMMIT')
          return ok(res, { success: true }, 201)
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        } finally { client.release() }
      } else {
        // Standard expense creation
        await pool.query(
          `INSERT INTO expenses (date, category, amount, note, payment_method, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
          [b.date, b.category, b.amount, b.note || null, b.payment_method || 'cash', userId || null]
        )
        
        await pool.query(
          `INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
          [userId || null, req.headers['x-username'] || 'system', 'CREATE_EXPENSE', `Logged expense of ₹${b.amount} (category: ${b.category})`]
        )
        return ok(res, { success: true }, 201)
      }
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err(res, 'Server error', 500)
  }
}

import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()

  try {
    if (req.method === 'GET') {
      const search = req.query.search
      if (search) {
        const r = await pool.query(
          `SELECT * FROM customers WHERE name ILIKE $1 OR mobile LIKE $2 OR shop_name ILIKE $1 ORDER BY name LIMIT 15`,
          [`%${search}%`, `%${search}%`]
        )
        return ok(res, { customers: r.rows })
      }
      const r = await pool.query(`
        SELECT c.*, COUNT(s.id)::int AS session_count
        FROM customers c
        LEFT JOIN sessions s ON s.customer_id = c.id
        GROUP BY c.id ORDER BY c.name
      `)
      return ok(res, { customers: r.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      if (!b.name) return err(res, 'Name is required')
      const r = await pool.query(
        `INSERT INTO customers (name, mobile, shop_name, pancafe_username)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [b.name.trim(), b.mobile || null, b.shop_name || null, b.pancafe_username || null]
      )
      return ok(res, { customer: r.rows[0] }, 201)
    }

    return err(res, 'Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err(res, e, 500)
  }
}


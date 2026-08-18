import { getPool, ok, err } from './_db.js'
import { withTenantClient } from './_tenant.js'

export default async function handler(req, res) {
  const pool = getPool()

  return withTenantClient(pool, req, res, async (client) => {
    if (req.method === 'GET') {
      const search = req.query.search
      const view = req.query.view || 'session'

      if (search) {
        const r = await client.query(
          `SELECT id, name, mobile, shop_name, pancafe_username
           FROM customers
           WHERE name ILIKE $1 OR mobile ILIKE $1 OR shop_name ILIKE $1 OR pancafe_username ILIKE $1
           ORDER BY name LIMIT 10`,
          [`%${search.trim()}%`]
        )
        return ok(res, { customers: r.rows })
      }

      if (view === 'cafeteria') {
        const r = await client.query(`
          SELECT
            c.id, c.name, c.mobile, c.shop_name, c.created_at,
            COUNT(DISTINCT s.id) AS session_count
          FROM customers c
          JOIN sales s ON s.customer_id = c.id
          GROUP BY c.id
          ORDER BY session_count DESC, c.name ASC
          LIMIT 100
        `)
        return ok(res, { customers: r.rows })
      }

      const r = await client.query(`
        SELECT
          c.id, c.name, c.mobile, c.shop_name, c.pancafe_username, c.created_at,
          COUNT(DISTINCT s.id) AS session_count
        FROM customers c
        JOIN sessions s ON s.customer_id = c.id
        WHERE s.is_deleted IS NULL OR s.is_deleted = FALSE
        GROUP BY c.id
        ORDER BY session_count DESC, c.name ASC
        LIMIT 100
      `)
      return ok(res, { customers: r.rows })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      const { name, mobile, shop_name, pancafe_username } = b
      if (!name) return err(res, 'Customer name is required')

      const r = await client.query(
        `INSERT INTO customers (name, mobile, shop_name, pancafe_username)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name.trim(), mobile?.trim() || null, shop_name?.trim() || null, pancafe_username?.trim() || null]
      )
      return ok(res, { customer: r.rows[0] }, 201)
    }

    return err(res, 'Method not allowed', 405)
  })
}

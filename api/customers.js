import { getPool, ok, err } from './_db.js'

export default async function handler(req, res) {
  const pool = getPool()
  const currentOperator = req.headers['x-username']

  try {
    if (req.method === 'GET') {
      const search = req.query.search
      const view = req.query.view // 'session' | 'cafeteria' | undefined (all)

      if (search) {
        const r = await pool.query(
          `SELECT * FROM customers WHERE name ILIKE $1 OR mobile LIKE $2 OR shop_name ILIKE $1 ORDER BY name LIMIT 15`,
          [`%${search}%`, `%${search}%`]
        )
        return ok(res, { customers: r.rows })
      }

      // Resolve trial user ID for partitioning
      const trialUserRes = await pool.query("SELECT id FROM users WHERE username = 'trial'")
      const trialUserId = trialUserRes.rows[0]?.id || 0
      const isTrial = currentOperator === 'trial'

      // Creator filter clause (session & sales tables aliased as s)
      const creatorClause = isTrial
        ? `AND s.created_by = ${trialUserId}`
        : `AND (s.created_by IS NULL OR s.created_by <> ${trialUserId})`

      let query

      if (view === 'session') {
        // Customers who appear in gaming sessions
        query = `
          SELECT c.*, COUNT(s.id)::int AS session_count
          FROM customers c
          JOIN sessions s ON s.customer_id = c.id
          WHERE TRUE ${creatorClause}
          GROUP BY c.id ORDER BY c.name
        `
      } else if (view === 'cafeteria') {
        // Customers who appear in walk-in cafeteria sales
        query = `
          SELECT c.*, COUNT(s.id)::int AS session_count
          FROM customers c
          JOIN sales s ON s.customer_id = c.id AND s.sale_type = 'walkin'
          WHERE TRUE ${creatorClause}
          GROUP BY c.id ORDER BY c.name
        `
      } else {
        // All customers (with session count from gaming sessions)
        const directCreatorClause = isTrial
          ? `AND (s.created_by = ${trialUserId} OR s.id IS NULL)`
          : `AND (s.created_by IS NULL OR s.created_by <> ${trialUserId} OR s.id IS NULL)`
        query = `
          SELECT c.*, COUNT(s.id)::int AS session_count
          FROM customers c
          LEFT JOIN sessions s ON s.customer_id = c.id
          WHERE TRUE
          GROUP BY c.id
          HAVING COUNT(s.id) > 0
          ORDER BY c.name
        `
        // Simpler: for 'all' view, just show customers scoped by whether they have ANY session from the right creator
        if (isTrial) {
          query = `
            SELECT DISTINCT c.*, 0::int AS session_count
            FROM customers c
            WHERE c.id IN (
              SELECT DISTINCT customer_id FROM sessions WHERE customer_id IS NOT NULL AND created_by = ${trialUserId}
              UNION
              SELECT DISTINCT customer_id FROM sales WHERE customer_id IS NOT NULL AND created_by = ${trialUserId}
            )
            ORDER BY c.name
          `
        } else {
          query = `
            SELECT DISTINCT c.*, 0::int AS session_count
            FROM customers c
            WHERE c.id IN (
              SELECT DISTINCT customer_id FROM sessions WHERE customer_id IS NOT NULL AND (created_by IS NULL OR created_by <> ${trialUserId})
              UNION
              SELECT DISTINCT customer_id FROM sales WHERE customer_id IS NOT NULL AND (created_by IS NULL OR created_by <> ${trialUserId})
            )
            ORDER BY c.name
          `
        }
      }

      const r = await pool.query(query)
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


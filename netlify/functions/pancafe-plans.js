import { getPool, ok, err, cors } from './_db.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  const userId = event.headers['x-user-id']

  try {
    if (event.httpMethod === 'GET') {
      const r = await pool.query(
        `SELECT * FROM pancafe_plans ORDER BY is_signup_plan DESC, price ASC`
      )
      return ok({ plans: r.rows })
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}')
      if (!b.label || !b.hours || !b.price) return err('label, hours, and price are required')
      const r = await pool.query(
        `INSERT INTO pancafe_plans (label, hours, price, is_signup_plan)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [b.label, Number(b.hours), Number(b.price), !!b.is_signup_plan]
      )
      return ok({ plan: r.rows[0] }, 201)
    }

    // PATCH /pancafe-plans/:id
    const idMatch = event.path.match(/\/pancafe-plans\/(\d+)$/)
    if (idMatch && event.httpMethod === 'PATCH') {
      const id = Number(idMatch[1])
      const b = JSON.parse(event.body || '{}')
      const cols = []; const vals = []; let i = 1
      if (b.label !== undefined)          { cols.push(`label = $${i++}`);          vals.push(b.label) }
      if (b.hours !== undefined)          { cols.push(`hours = $${i++}`);          vals.push(Number(b.hours)) }
      if (b.price !== undefined)          { cols.push(`price = $${i++}`);          vals.push(Number(b.price)) }
      if (b.is_active !== undefined)      { cols.push(`is_active = $${i++}`);      vals.push(!!b.is_active) }
      if (b.is_signup_plan !== undefined) { cols.push(`is_signup_plan = $${i++}`); vals.push(!!b.is_signup_plan) }
      if (cols.length === 0) return err('Nothing to update')
      vals.push(id)
      const r = await pool.query(
        `UPDATE pancafe_plans SET ${cols.join(', ')} WHERE id = $${i} RETURNING *`,
        vals
      )
      return ok({ plan: r.rows[0] })
    }

    return err('Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err('Server error', 500)
  }
}

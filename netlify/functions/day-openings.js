import { getPool, ok, err, cors } from './_db.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()
  const pool = getPool()
  const userId = event.headers['x-user-id']

  try {
    if (event.httpMethod === 'GET') {
      const date = (event.queryStringParameters || {}).date ||
        new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local
      const r = await pool.query(
        `SELECT do.*, u.username AS created_by_username FROM day_openings do
         LEFT JOIN users u ON u.id = do.created_by
         WHERE do.date = $1`,
        [date]
      )
      return ok({ opening: r.rows[0] || null })
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}')
      const date = b.date || new Date().toLocaleDateString('en-CA')
      const r = await pool.query(
        `INSERT INTO day_openings (date, opening_cash, note, created_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (date) DO UPDATE SET opening_cash = $2, note = $3
         RETURNING *`,
        [date, Number(b.opening_cash || 0), b.note || null, userId || null]
      )
      return ok({ opening: r.rows[0] }, 201)
    }

    return err('Method not allowed', 405)
  } catch (e) {
    console.error(e)
    return err('Server error', 500)
  }
}

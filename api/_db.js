import pg from 'pg'

const { Pool } = pg
let pool

export function getPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  }
  return pool
}

export function ok(res, data, status = 200) {
  return res.status(status).json(data)
}

export function err(res, message, status = 400) {
  return res.status(status).json({ error: message })
}

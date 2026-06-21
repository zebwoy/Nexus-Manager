import { getPool, ok, err, cors } from './_db.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()

  try {
    const pool = getPool()
    
    // 1. Get all tables in public schema
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    const tables = tablesResult.rows.map(r => r.table_name)

    // 2. Get all views in public schema
    const viewsResult = await pool.query(`
      SELECT viewname 
      FROM pg_views 
      WHERE schemaname = 'public' 
      ORDER BY viewname
    `)
    const views = viewsResult.rows.map(r => r.viewname)

    // 3. Test today_snapshot query
    let snapshotTest = null
    let snapshotError = null
    try {
      const snapResult = await pool.query('SELECT * FROM today_snapshot')
      snapshotTest = snapResult.rows
    } catch (e) {
      snapshotError = e.message
    }

    // 4. Test sessions query
    let sessionsTest = null
    let sessionsError = null
    try {
      const sessResult = await pool.query('SELECT * FROM sessions LIMIT 1')
      sessionsTest = sessResult.rows
    } catch (e) {
      sessionsError = e.message
    }

    return ok({
      database_connected: true,
      tables,
      views,
      snapshot_test: {
        success: !snapshotError,
        data: snapshotTest,
        error: snapshotError
      },
      sessions_test: {
        success: !sessionsError,
        data: sessionsTest,
        error: sessionsError
      }
    })
  } catch (e) {
    console.error(e)
    return err(`Database connection failed: ${e.message}`, 500)
  }
}

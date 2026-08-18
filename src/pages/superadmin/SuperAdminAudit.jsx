import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { formatDate, formatTime } from '../../lib/helpers'
import { PageLoader, ErrorMsg, FilterBar } from '../../components/UI'
import { History, Search, Filter, ShieldCheck } from 'lucide-react'

export default function SuperAdminAudit() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')

  const loadAudits = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/super-admin?action=audit-logs')
      setLogs(res.logs || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAudits() }, [loadAudits])

  const actions = ['ALL', ...new Set(logs.map(l => l.action))]

  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.details?.toLowerCase().includes(search.toLowerCase()) ||
                          l.target_org_id?.toLowerCase().includes(search.toLowerCase()) ||
                          l.super_admin_email?.toLowerCase().includes(search.toLowerCase())
    const matchesAction = actionFilter === 'ALL' || l.action === actionFilter
    return matchesSearch && matchesAction
  })

  if (loading) return <PageLoader />

  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={22} style={{ color: '#f59e0b' }} /> Platform Super Admin Audit Trail
        </h1>
        <p className="page-sub" style={{ marginTop: '0.35rem' }}>
          Immutable log of tenant creations, schema provisioning, status changes, and platform administrative operations.
        </p>
      </div>

      <ErrorMsg error={error} />

      <FilterBar style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search audit trail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {actions.map(act => (
            <button
              key={act}
              onClick={() => setActionFilter(act)}
              className={actionFilter === act ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              style={{ fontSize: '0.725rem', padding: '0.35rem 0.65rem' }}
            >
              {act}
            </button>
          ))}
        </div>
      </FilterBar>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Target Org</th>
              <th>Executed By</th>
              <th>Audit Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  No audit entries found.
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatDate(log.created_at)} · {formatTime(log.created_at)}
                  </td>
                  <td>
                    <span className={`badge ${log.action.includes('DELETE') ? 'badge-danger' : log.action.includes('CREATE') ? 'badge-success' : 'badge-accent'}`} style={{ fontSize: '0.65rem' }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: '0.725rem', color: 'var(--text)' }}>
                      {log.target_org_id || 'platform'}
                    </code>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {log.super_admin_email || 'SuperAdmin'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 550 }}>
                    {log.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

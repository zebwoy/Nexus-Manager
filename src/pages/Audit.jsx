import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { formatDate, formatTime } from '../lib/helpers'
import { PageLoader, ErrorMsg, Tabs, EmptyState } from '../components/UI'
import { Shield, Activity, Trash2, RefreshCw } from 'lucide-react'

const TABS = [
  { key: 'audit',    label: 'Audit Log' },
  { key: 'sessions', label: 'Operator Sessions' },
  { key: 'deletes',  label: 'Deletions' },
]

// Action type → badge colour
function actionBadge(action) {
  const danger = ['SESSION_DELETE', 'RECHARGE_DELETE', 'SALE_DELETE', 'DELETE_INVENTORY']
  const warn   = ['UPDATE_SETTINGS', 'PURGE_DATA', 'RECHARGE_EDIT', 'SALE_EDIT']
  const cls = danger.includes(action) ? 'badge-danger' : warn.includes(action) ? 'badge-warning' : 'badge-accent'
  return <span className={`badge ${cls}`} style={{ fontSize: '0.6rem' }}>{action}</span>
}

export default function Audit() {
  const [tab, setTab] = useState('audit')
  const [logs, setLogs] = useState([])
  const [opSessions, setOpSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('/auth-audit')
      setLogs(data.logs || [])
      setOpSessions(data.sessions || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredLogs = logs.filter(l => {
    const matchAction = !actionFilter || l.action === actionFilter
    const matchSearch = !search ||
      l.username?.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase())
    return matchAction && matchSearch
  })

  const deletionLogs = filteredLogs.filter(l =>
    ['SESSION_DELETE', 'RECHARGE_DELETE', 'SALE_DELETE', 'DELETE_INVENTORY'].includes(l.action)
  )

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort()

  if (loading) return <PageLoader />

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Shield size={22} style={{ color: 'var(--accent-text)' }} /> Audit Trail
          </h1>
          <p className="page-sub">Complete operator activity log and system event history</p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <ErrorMsg error={error} />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── AUDIT LOG ── */}
      {tab === 'audit' && (
        <div>
          {/* Filters */}
          <div className="card" style={{ padding: '0.85rem 1.15rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <input className="input" placeholder="Search logs…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: '1 1 200px', padding: '0.45rem 0.75rem' }} />
            <select className="input" value={actionFilter} onChange={e => setActionFilter(e.target.value)}
              style={{ flex: '0 0 auto', padding: '0.45rem 0.75rem', minWidth: '180px' }}>
              <option value="">All Actions</option>
              {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
              {filteredLogs.length} entries
            </span>
          </div>

          {filteredLogs.length === 0
            ? <EmptyState icon={Activity} title="No log entries" description="No audit activity matches your filters." />
            : (
              <div className="card-flush">
                <table className="tbl">
                  <thead>
                    <tr>
                      {['#', 'Operator', 'Action', 'Details', 'Timestamp'].map(h => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l, idx) => (
                      <tr key={l.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                        <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.725rem', color: 'var(--text-faint)' }}>{l.id}</td>
                        <td className="table-cell" style={{ fontWeight: 650, color: 'var(--text)' }}>
                          @{l.username || '—'}
                        </td>
                        <td className="table-cell">{actionBadge(l.action)}</td>
                        <td className="table-cell" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px', wordBreak: 'break-word' }}>
                          {l.details || '—'}
                        </td>
                        <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.725rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                          {formatDate(l.created_at)} {formatTime(l.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── OPERATOR SESSIONS ── */}
      {tab === 'sessions' && (
        <div>
          {opSessions.length === 0
            ? <EmptyState icon={Shield} title="No operator sessions" description="No login/logout records found." />
            : (
              <div className="card-flush">
                <table className="tbl">
                  <thead>
                    <tr>
                      {['Operator', 'Login At', 'Logout At', 'Duration'].map(h => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {opSessions.map((s, idx) => {
                      const duration = s.logout_at
                        ? (() => {
                            const diff = new Date(s.logout_at) - new Date(s.login_at)
                            const h = Math.floor(diff / 3600000)
                            const m = Math.floor((diff % 3600000) / 60000)
                            return h > 0 ? `${h}h ${m}m` : `${m}m`
                          })()
                        : 'Active'
                      return (
                        <tr key={s.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                          <td className="table-cell" style={{ fontWeight: 700, color: 'var(--text)' }}>
                            @{s.username}
                            {!s.logout_at && <span className="badge-active-session animate-pulse" style={{ fontSize: '0.6rem', marginLeft: '0.5rem' }}>ACTIVE</span>}
                          </td>
                          <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem' }}>
                            {formatDate(s.login_at)} {formatTime(s.login_at)}
                          </td>
                          <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: s.logout_at ? 'var(--text-muted)' : 'var(--success)' }}>
                            {s.logout_at ? `${formatDate(s.logout_at)} ${formatTime(s.logout_at)}` : '—'}
                          </td>
                          <td className="table-cell">
                            <span className={`badge ${!s.logout_at ? 'badge-success' : 'badge-accent'}`} style={{ fontSize: '0.65rem' }}>
                              {duration}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── DELETIONS ── */}
      {tab === 'deletes' && (
        <div>
          {deletionLogs.length === 0
            ? <EmptyState icon={Trash2} title="No deletions recorded" description="No session, recharge, or sale deletions have been made." />
            : (
              <div className="card-flush">
                <table className="tbl">
                  <thead>
                    <tr>
                      {['Operator', 'Action', 'Details', 'Timestamp'].map(h => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {deletionLogs.map((l, idx) => (
                      <tr key={l.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                        <td className="table-cell" style={{ fontWeight: 700, color: 'var(--text)' }}>@{l.username || '—'}</td>
                        <td className="table-cell">{actionBadge(l.action)}</td>
                        <td className="table-cell" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '300px', wordBreak: 'break-word' }}>{l.details}</td>
                        <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.725rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                          {formatDate(l.created_at)} {formatTime(l.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}
    </div>
  )
}

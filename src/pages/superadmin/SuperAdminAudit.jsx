import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { formatDate, formatTime } from '../../lib/helpers'
import { PageLoader, ErrorMsg, Field } from '../../components/UI'
import {
  History, Search, Filter, ShieldCheck, Shield, Clock,
  User, Database, Building2, PlusCircle, Edit3, Trash2,
  RotateCcw, CheckCircle2, AlertCircle, X, Sparkles
} from 'lucide-react'

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

  const actions = ['ALL', ...new Set(logs.map(l => l.action).filter(Boolean))]

  const filteredLogs = logs.filter(l => {
    const matchesSearch =
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.target_org_id?.toLowerCase().includes(search.toLowerCase()) ||
      l.super_admin_email?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase())

    const matchesAction = actionFilter === 'ALL' || l.action === actionFilter
    return matchesSearch && matchesAction
  })

  const tenantEventsCount = logs.filter(l => l.action?.includes('TENANT')).length
  const uniqueAdminsCount = new Set(logs.map(l => l.super_admin_email).filter(Boolean)).size || 1

  const getActionBadge = (action = '') => {
    if (action.includes('CREATE')) {
      return (
        <span className="badge badge-success" style={{ fontSize: '0.675rem', fontWeight: 800, gap: '0.35rem' }}>
          <PlusCircle size={11} /> {action}
        </span>
      )
    }
    if (action.includes('DELETE')) {
      return (
        <span className="badge badge-danger" style={{ fontSize: '0.675rem', fontWeight: 800, gap: '0.35rem' }}>
          <Trash2 size={11} /> {action}
        </span>
      )
    }
    if (action.includes('RESET')) {
      return (
        <span className="badge badge-warning" style={{ fontSize: '0.675rem', fontWeight: 800, gap: '0.35rem' }}>
          <RotateCcw size={11} /> {action}
        </span>
      )
    }
    if (action.includes('UPDATE')) {
      return (
        <span className="badge badge-accent" style={{ fontSize: '0.675rem', fontWeight: 800, gap: '0.35rem' }}>
          <Edit3 size={11} /> {action}
        </span>
      )
    }
    return (
      <span className="badge" style={{ fontSize: '0.675rem', fontWeight: 800 }}>
        {action}
      </span>
    )
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* ─── TOP HEADER BAR ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: '1.25rem'
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.25rem 0.75rem', borderRadius: '100px',
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            marginBottom: '0.65rem'
          }}>
            <span className="led-indicator led-green" style={{ width: '6px', height: '6px' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Immutable Event Ledger
            </span>
          </div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
            Platform Audit Trail
          </h1>
          <p className="page-sub" style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Permanent forensic log of tenant creations, schema provisioning, status changes, and administrator operations.
          </p>
        </div>
      </div>

      <ErrorMsg error={error} />

      {/* ─── KPI SUMMARY TILES ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <History size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Recorded Logs</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{logs.length}</p>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
            <Building2 size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tenant Operations</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>{tenantEventsCount}</p>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Administrators</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{uniqueAdminsCount}</p>
          </div>
        </div>
      </div>

      {/* ─── SEARCH & ACTION FILTER CONTROLS ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.85rem'
      }}>
        {/* Action Type Pills */}
        <div style={{
          display: 'flex', gap: '0.35rem', flexWrap: 'wrap', padding: '0.25rem',
          borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)'
        }}>
          {actions.map(act => (
            <button
              key={act}
              onClick={() => setActionFilter(act)}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 750,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                background: actionFilter === act ? 'var(--bg-card)' : 'transparent',
                color: actionFilter === act ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: actionFilter === act ? 'var(--shadow)' : 'none'
              }}
            >
              {act}
            </button>
          ))}
        </div>

        {/* Minimal Search Bar */}
        <div style={{ position: 'relative', minWidth: '280px', flex: '1', maxWidth: '420px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.4rem', paddingRight: search ? '2.4rem' : '0.85rem', height: '38px', borderRadius: '10px' }}
            placeholder="Search audit trail entries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ─── DATA GRID TABLE CARD ─── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', minWidth: '940px' }}>
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Timestamp</th>
                <th style={{ width: '16%' }}>Action Event</th>
                <th style={{ width: '14%' }}>Target Org</th>
                <th style={{ width: '20%' }}>Executed By</th>
                <th style={{ width: '32%' }}>Audit Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <History size={24} />
                      </div>
                      <p style={{ margin: 0, fontWeight: 750, fontSize: '0.95rem', color: 'var(--text)' }}>
                        No audit records found
                      </p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '320px' }}>
                        {search ? `No entries matching "${search}". Try searching with a different term.` : 'Platform operations and tenant lifecycle events will be recorded here.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} style={{ transition: 'background 0.15s ease' }}>
                    {/* Timestamp */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <div>
                          <p style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.775rem', fontWeight: 750, color: 'var(--text)' }}>
                            {formatDate(log.created_at)}
                          </p>
                          <span style={{ fontSize: '0.675rem', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {formatTime(log.created_at)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td>
                      {getActionBadge(log.action)}
                    </td>

                    {/* Target Org */}
                    <td>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.25rem 0.55rem', borderRadius: '6px',
                        background: 'var(--bg-input)', border: '1px solid var(--border)',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.725rem', color: 'var(--accent-text)', fontWeight: 700
                      }}>
                        <Database size={11} style={{ color: 'var(--accent)' }} />
                        {log.target_org_id || 'platform'}
                      </div>
                    </td>

                    {/* Executed By */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '50%',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-muted)', flexShrink: 0
                        }}>
                          <User size={12} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: 'var(--text)' }}>
                            {log.super_admin_email || 'SuperAdmin'}
                          </p>
                          <span style={{ fontSize: '0.675rem', color: 'var(--text-faint)' }}>
                            Platform Super Admin
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Audit Details */}
                    <td>
                      <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text)', fontWeight: 550, lineHeight: 1.45 }}>
                        {log.details}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

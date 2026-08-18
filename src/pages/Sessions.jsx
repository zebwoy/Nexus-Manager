import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatTime, formatDate, formatDuration, todayISO } from '../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, FilterBar } from '../components/UI'
import { LayoutGrid, List, Plus } from 'lucide-react'
import LogSessionModal from '../components/LogSessionModal'
import StationGrid from '../components/StationGrid'

export default function Sessions() {
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())
  const [showLogModal, setShowLogModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { loadSessions() }, [dateFilter])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const data = await api.get(`/sessions?date=${dateFilter}`)
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const activeSessions = sessions.filter(s => s.is_active)
  const totalRevenue = sessions.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
  const totalCredit  = sessions.reduce((sum, s) => sum + (Number(s.credit) || 0), 0)

  return (
    <div>
      <LogSessionModal open={showLogModal} onClose={() => setShowLogModal(false)} />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Gaming Sessions</h1>
          <p className="page-sub">Station floor matrix and historical session logs</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setShowLogModal(true)} className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
            <Plus size={14} /> Log Session
          </button>
        </div>
      </div>

      <ErrorMsg error={error} />

      {/* Controls & Metrics Strip */}
      <FilterBar style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          
          {/* View Mode Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '10px', padding: '3px', border: '1.5px solid var(--border)', gap: '2px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: '8px', cursor: 'pointer', border: 'none',
                fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem',
                background: viewMode === 'grid' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--btn-primary-text, #fff)' : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
            >
              <LayoutGrid size={13} /> Visual Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: '8px', cursor: 'pointer', border: 'none',
                fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem',
                background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'table' ? 'var(--btn-primary-text, #fff)' : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
            >
              <List size={13} /> Table Log
            </button>
          </div>

          {/* Date Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="label" style={{ marginBottom: 0 }}>Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="input"
              style={{ width: 'auto', padding: '0.4rem 0.65rem' }}
            />
          </div>
        </div>
        
        {/* LCD Counters */}
        {!loading && (
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <div className="lcd-screen success" style={{ padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em' }}>REVENUE:</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(totalRevenue)}</span>
            </div>
            {totalCredit > 0 && (
              <div className="lcd-screen danger" style={{ padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em' }}>DUE:</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(totalCredit)}</span>
              </div>
            )}
          </div>
        )}
      </FilterBar>

      {/* VIEW 1: VISUAL FLOOR GRID */}
      {viewMode === 'grid' && (
        <StationGrid
          activeSessions={activeSessions}
          onRefresh={loadSessions}
          onLaunchNewSession={() => setShowLogModal(true)}
        />
      )}

      {/* VIEW 2: DETAILED TABLE LOG */}
      {viewMode === 'table' && (
        loading ? <PageLoader /> : sessions.length === 0 ? (
          <EmptyState title="No Stations Logged" description={`No gaming logs recorded for date: ${formatDate(dateFilter)}`}
            action={<button onClick={() => setShowLogModal(true)} className="btn-primary">Initiate Gaming Session</button>} />
        ) : (
          <div className="card-flush" style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {['Customer Details', 'Station ID', 'Time In', 'Time Out', 'Duration', 'Seat Charge', 'Invoice Total', 'Cash Received', 'Credit Status', 'Pay Method', 'Operator'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, index) => {
                  const deviceType = s.device_label?.split(' ')[0] || ''
                  let badgeClass = 'badge-accent'
                  if (deviceType === 'PC') badgeClass = 'badge-accent'
                  else if (deviceType === 'XBOX') badgeClass = 'badge-warning'
                  else if (deviceType === 'PS') badgeClass = 'badge-success'

                  return (
                    <tr key={s.id} style={{ cursor: 'pointer', background: index % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}
                        onClick={() => navigate(`/sessions/${s.id}`)}>
                      <td className="table-cell">
                        <p style={{ fontWeight: 700, color: 'var(--text)' }}>{s.name || <span style={{ color: 'var(--text-faint)' }}>Walk-in Client</span>}</p>
                        {s.mobile && <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginTop: '0.1rem' }}>{s.mobile}</p>}
                        {s.is_active && <span className="badge-active-session animate-pulse" style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>ACTIVE</span>}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${badgeClass}`}>{s.device_label}</span>
                      </td>
                      <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatTime(s.time_in)}</td>
                      <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatTime(s.time_out)}</td>
                      <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatDuration(s.duration_mins)}</td>
                      <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(s.charge)}</td>
                      <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 750 }}>{formatRupees(s.total)}</td>
                      <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.payment_received != null ? formatRupees(s.payment_received) : '—'}</td>
                      <td className="table-cell">
                        {s.credit > 0
                          ? <span className="badge badge-danger">{formatRupees(s.credit)}</span>
                          : <span style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>Fully Paid</span>}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${s.payment_method === 'online' ? 'badge-warning' : 'badge-accent'}`} style={{ fontSize: '0.65rem' }}>
                          {s.payment_method || 'cash'}
                        </span>
                      </td>
                      <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.725rem', fontWeight: 600 }}>@{s.created_by_username || 'system'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

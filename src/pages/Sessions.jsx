import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatTime, formatDate, formatDuration, todayISO } from '../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, FilterBar, DateInput, Modal } from '../components/UI'
import { List, Plus } from 'lucide-react'
import LogSessionModal from '../components/LogSessionModal'
import StationGrid from '../components/StationGrid'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())
  const [showLogModal, setShowLogModal] = useState(false)
  const [showEntriesModal, setShowEntriesModal] = useState(false)
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
      <LogSessionModal open={showLogModal} onClose={() => { setShowLogModal(false); loadSessions(); }} />

      {/* Session Entries Log Modal */}
      <Modal open={showEntriesModal} onClose={() => setShowEntriesModal(false)} title={`Session Entries Ledger — ${formatDate(dateFilter)}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
              <DateInput
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                showSteppers={true}
                showTodayButton={true}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className="lcd-screen success" style={{ padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>REVENUE:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(totalRevenue)}</span>
              </div>
              {totalCredit > 0 && (
                <div className="lcd-screen danger" style={{ padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>DUE:</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(totalCredit)}</span>
                </div>
              )}
            </div>
          </div>

          {loading ? <PageLoader /> : sessions.length === 0 ? (
            <EmptyState title="No Sessions Logged" description={`No gaming logs recorded for date: ${formatDate(dateFilter)}`}
              action={<button onClick={() => { setShowEntriesModal(false); setShowLogModal(true); }} className="btn-primary">Initiate Gaming Session</button>} />
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
                          onClick={() => { setShowEntriesModal(false); navigate(`/sessions/${s.id}`); }}>
                        <td className="table-cell">
                          <p style={{ fontWeight: 700, color: 'var(--text)' }}>{s.name || <span style={{ color: 'var(--text-faint)' }}>Walk-in Client</span>}</p>
                          {s.mobile && <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginTop: '0.1rem' }}>{s.mobile}</p>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                            {s.is_active && <span className="badge-active-session animate-pulse" style={{ fontSize: '0.6rem' }}>ACTIVE</span>}
                            {s.is_predated && <span className="badge badge-neutral" style={{ fontSize: '0.58rem', padding: '0.1rem 0.35rem' }} title="Recorded after the session took place">BACKDATED</span>}
                          </div>
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
          )}
        </div>
      </Modal>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Gaming Sessions</h1>
          <p className="page-sub">Station floor matrix and live session management</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={() => setShowEntriesModal(true)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <List size={14} /> View Session entries
          </button>
          <button onClick={() => setShowLogModal(true)} className="btn-primary" style={{ padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={14} /> Log Session
          </button>
        </div>
      </div>

      <ErrorMsg error={error} />

      {/* Controls & Metrics Strip */}
      <FilterBar style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label className="label" style={{ marginBottom: 0 }}>Date</label>
          <DateInput
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            showSteppers={true}
            showTodayButton={true}
          />
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

      {/* VISUAL FLOOR GRID */}
      <StationGrid
        activeSessions={activeSessions}
        onRefresh={loadSessions}
        onLaunchNewSession={() => setShowLogModal(true)}
      />
    </div>
  )
}

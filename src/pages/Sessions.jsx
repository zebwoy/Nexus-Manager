import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatTime, formatDate, formatDuration, DURATION_OPTIONS, todayISO } from '../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg } from '../components/UI'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())
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

  const totalRevenue = sessions.reduce((sum, s) => sum + (s.total || 0), 0)
  const totalCredit  = sessions.reduce((sum, s) => sum + (s.credit || 0), 0)

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Sessions Log</h1>
          <p className="page-sub">Gaming station session monitors</p>
        </div>
        <Link to="/sessions/new" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>+ Log Session</Link>
      </div>

      <ErrorMsg error={error} />

      {/* Control Strip & Metrics Display */}
      <div className="card" style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.25rem',
        padding: '1rem 1.25rem', marginBottom: '1.5rem', justifyContent: 'space-between'
      }}>
        {/* Date Selector Slot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="input"
            style={{ width: 'auto', padding: '0.45rem 0.75rem' }}
          />
        </div>
        
        {/* LCD Counters */}
        {!loading && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="lcd-screen success" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em' }}>REVENUE:</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(totalRevenue)}</span>
            </div>
            {totalCredit > 0 && (
              <div className="lcd-screen danger" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em' }}>CREDIT:</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(totalCredit)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? <PageLoader /> : sessions.length === 0 ? (
        <EmptyState icon="🖥️" title="No Stations Active" description={`No gaming logs recorded for date: ${formatDate(dateFilter)}`}
          action={<Link to="/sessions/new" className="btn-primary">Initiate Gaming Session</Link>} />
      ) : (
        /* Skeuomorphic Table Chassis */
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Customer Details', 'Station ID', 'Time In', 'Time Out', 'Mins Logged', 'Seat Charge', 'Invoice Total', 'Cash Received', 'Credit Status', 'Operator'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, index) => {
                // Style device type badge color dynamically
                const deviceType = s.device_label?.split(' ')[0] || ''
                let badgeClass = 'badge-accent'
                if (deviceType === 'PC') badgeClass = 'badge-accent'
                else if (deviceType === 'XBOX') badgeClass = 'badge-warning'
                else if (deviceType === 'PS') badgeClass = 'badge-success'

                return (
                  <tr key={s.id} style={{ cursor: 'pointer', background: index % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}
                      onClick={() => navigate(`/sessions`)}>
                    <td className="table-cell">
                      <p style={{ fontWeight: 700, color: 'var(--text)' }}>{s.name || <span style={{ color: 'var(--text-faint)' }}>Walk-in Client</span>}</p>
                      {s.mobile && <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginTop: '0.1rem' }}>{s.mobile}</p>}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${badgeClass}`}>{s.device_label}</span>
                    </td>
                    <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatTime(s.time_in)}</td>
                    <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatTime(s.time_out)}</td>
                    <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatDuration(s.duration_mins)}</td>
                    <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(s.charge)}</td>
                    <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace', monospace", fontWeight: 750 }}>{formatRupees(s.total)}</td>
                    <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.payment_received != null ? formatRupees(s.payment_received) : '—'}</td>
                    <td className="table-cell">
                      {s.credit > 0
                        ? <span className="badge badge-danger">{formatRupees(s.credit)}</span>
                        : <span style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>Fully Paid</span>}
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
  )
}

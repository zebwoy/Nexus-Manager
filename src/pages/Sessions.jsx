import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatTime, formatDate, formatDuration, DURATION_OPTIONS, todayISO, nowTimeInput, toISO, addMinutes } from '../lib/helpers'
import { PageLoader, EmptyState, Modal, Field, ErrorMsg, Spinner } from '../components/UI'

// ─── Sessions List ────────────────────────────────────────────
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
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">Gaming session log</p>
        </div>
        <Link to="/sessions/new" className="btn-primary">+ New Session</Link>
      </div>

      <ErrorMsg error={error} />

      {/* Filters + summary */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="input w-auto"
        />
        {!loading && (
          <div className="flex gap-4 ml-auto">
            <span className="stat-label">Revenue: <span className="text-white font-mono">{formatRupees(totalRevenue)}</span></span>
            {totalCredit > 0 && (
              <span className="stat-label">Credit: <span className="text-red-400 font-mono">{formatRupees(totalCredit)}</span></span>
            )}
          </div>
        )}
      </div>

      {loading ? <PageLoader /> : sessions.length === 0 ? (
        <EmptyState icon="🖥" title="No sessions" description={`No sessions found for ${formatDate(dateFilter)}`}
          action={<Link to="/sessions/new" className="btn-primary">Start a Session</Link>} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                {['Customer', 'Device', 'Time In', 'Time Out', 'Duration', 'Charge', 'Total', 'Payment', 'Credit', 'Logged By'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-surface-800/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/sessions/${s.id}`)}>
                  <td className="table-cell">
                    <p className="font-body text-white">{s.name || <span className="text-slate-500">—</span>}</p>
                    {s.mobile && <p className="text-xs text-slate-500 font-mono">{s.mobile}</p>}
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-blue">{s.device_label}</span>
                  </td>
                  <td className="table-cell font-mono text-sm">{formatTime(s.time_in)}</td>
                  <td className="table-cell font-mono text-sm">{formatTime(s.time_out)}</td>
                  <td className="table-cell font-mono text-sm">{formatDuration(s.duration_mins)}</td>
                  <td className="table-cell font-mono">{formatRupees(s.charge)}</td>
                  <td className="table-cell font-mono font-semibold">{formatRupees(s.total)}</td>
                  <td className="table-cell font-mono">{s.payment_received != null ? formatRupees(s.payment_received) : '—'}</td>
                  <td className="table-cell">
                    {s.credit > 0
                      ? <span className="badge badge-red">{formatRupees(s.credit)}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="table-cell text-slate-500 text-xs font-mono">{s.created_by_username || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

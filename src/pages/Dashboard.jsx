import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { formatRupees, formatDate, formatTime } from '../lib/helpers'
import { PageLoader, ErrorMsg } from '../components/UI'

export default function Dashboard() {
  const { user } = useAuth()
  const [snapshot, setSnapshot] = useState(null)
  const [credits, setCredits] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [snap, cred, sessions] = await Promise.all([
        api.get('/dashboard-snapshot'),
        api.get('/dashboard-credits'),
        api.get('/sessions?limit=5'),
      ])
      setSnapshot(snap)
      setCredits(cred.credits || [])
      setRecentSessions(sessions.sessions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <PageLoader />

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const totalRevenue = snapshot
    ? (snapshot.gaming_revenue || 0) +
      (snapshot.walkin_revenue || 0) +
      (snapshot.session_sales_revenue || 0) +
      (snapshot.rc_revenue || 0) +
      (snapshot.pancafe_revenue || 0)
    : 0

  return (
    <div>
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-sm">Welcome back,</p>
          <p className="font-display font-semibold text-white">{user?.full_name}</p>
        </div>
      </div>

      <ErrorMsg error={error} />

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card col-span-2 lg:col-span-1 bg-brand-600/10 border-brand-600/30">
          <span className="stat-label">Today's Total</span>
          <span className="stat-value text-brand-400">{formatRupees(totalRevenue)}</span>
          <span className="text-slate-500 text-xs font-mono">all sources</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Gaming</span>
          <span className="stat-value">{formatRupees(snapshot?.gaming_revenue)}</span>
          <span className="text-slate-500 text-xs font-mono">sessions</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Shop Sales</span>
          <span className="stat-value">
            {formatRupees((snapshot?.walkin_revenue || 0) + (snapshot?.session_sales_revenue || 0))}
          </span>
          <span className="text-slate-500 text-xs font-mono">inventory</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">RC + PanCafe</span>
          <span className="stat-value">
            {formatRupees((snapshot?.rc_revenue || 0) + (snapshot?.pancafe_revenue || 0))}
          </span>
          <span className="text-slate-500 text-xs font-mono">recharges</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credits Outstanding */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-white tracking-wide">
              Credits Outstanding
            </h2>
            <span className="badge badge-yellow">
              {formatRupees(snapshot?.total_outstanding_credit)} total
            </span>
          </div>
          {credits.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No outstanding credits 🎉</p>
          ) : (
            <div className="space-y-2">
              {credits.map((c) => (
                <div key={c.session_id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                  <div>
                    <p className="text-sm font-body text-white">{c.name}</p>
                    <p className="text-xs font-mono text-slate-500">{formatDate(c.date)} · {c.device_label}</p>
                  </div>
                  <span className="badge badge-red">{formatRupees(c.credit)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-white tracking-wide">
              Recent Sessions
            </h2>
            <Link to="/sessions" className="text-brand-400 text-sm hover:text-brand-300 font-body">
              View all →
            </Link>
          </div>
          {recentSessions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No sessions today yet</p>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                  <div>
                    <p className="text-sm font-body text-white">{s.name || 'Anonymous'}</p>
                    <p className="text-xs font-mono text-slate-500">
                      {s.device_label} · {formatTime(s.time_in)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">{formatRupees(s.total)}</p>
                    {s.credit > 0 && (
                      <span className="badge badge-red text-xs">{formatRupees(s.credit)} credit</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <h2 className="font-display font-semibold text-slate-400 text-sm tracking-widest uppercase mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/sessions/new" className="btn-primary">+ New Session</Link>
          <Link to="/pancafe/new" className="btn-secondary">+ PanCafe Session</Link>
          <Link to="/inventory/sell" className="btn-secondary">+ Walk-in Sale</Link>
          <Link to="/recharges/new" className="btn-secondary">+ Recharge</Link>
          <Link to="/expenses/new" className="btn-secondary">+ Expense</Link>
        </div>
      </div>
    </div>
  )
}

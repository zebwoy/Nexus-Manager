import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { formatRupees, formatDate, formatTime } from '../lib/helpers'
import { PageLoader, ErrorMsg, SectionHeader } from '../components/UI'
import { Plus } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const [snapshot, setSnapshot] = useState(null)
  const [credits, setCredits] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [snap, cred, sess] = await Promise.all([
        api.get('/dashboard-snapshot'),
        api.get('/dashboard-credits'),
        api.get('/sessions?limit=6'),
      ])
      setSnapshot(snap)
      setCredits(cred.credits || [])
      setRecentSessions(sess.sessions || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const totalRevenue = snapshot
    ? (snapshot.gaming_revenue || 0) + (snapshot.walkin_revenue || 0) +
      (snapshot.session_sales_revenue || 0) + (snapshot.rc_revenue || 0) +
      (snapshot.pancafe_revenue || 0)
    : 0

  if (loading) return <PageLoader />

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{today}</p>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Welcome, <span style={{ color: 'var(--text)', fontWeight: 600 }}>{user?.full_name}</span>
        </p>
      </div>

      <ErrorMsg error={error} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {[
          { label: "Today's Revenue", value: formatRupees(totalRevenue), sub: 'all sources', highlight: true },
          { label: 'Gaming',          value: formatRupees(snapshot?.gaming_revenue),  sub: 'sessions' },
          { label: 'Shop Sales',      value: formatRupees((snapshot?.walkin_revenue||0)+(snapshot?.session_sales_revenue||0)), sub: 'inventory' },
          { label: 'RC + PanCafe',    value: formatRupees((snapshot?.rc_revenue||0)+(snapshot?.pancafe_revenue||0)), sub: 'recharges' },
        ].map((s, i) => (
          <div key={i} className="card" style={s.highlight ? {
            background: 'var(--accent-dim)', borderColor: 'var(--accent-border)'
          } : {}}>
            <p className="stat-label">{s.label}</p>
            <p className="stat-value" style={s.highlight ? { color: 'var(--accent-text)' } : {}}>{s.value}</p>
            <p className="stat-sub">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>

        {/* Credits outstanding */}
        <div className="card">
          <SectionHeader
            title="Credits Outstanding"
            action={snapshot?.total_outstanding_credit > 0
              ? <span className="badge badge-danger">{formatRupees(snapshot.total_outstanding_credit)}</span>
              : null}
          />
          {credits.length === 0
            ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No outstanding credits</p>
            : credits.map((c, i) => (
              <div key={c.session_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 0',
                borderBottom: i < credits.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{c.name || 'Anonymous'}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{formatDate(c.date)} · {c.device_label}</p>
                </div>
                <span className="badge badge-danger">{formatRupees(c.credit)}</span>
              </div>
            ))
          }
        </div>

        {/* Recent sessions */}
        <div className="card">
          <SectionHeader
            title="Recent Sessions"
            action={<Link to="/sessions" style={{ fontSize: '0.8125rem', color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 500 }}>View all</Link>}
          />
          {recentSessions.length === 0
            ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No sessions today yet</p>
            : recentSessions.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 0',
                borderBottom: i < recentSessions.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{s.name || 'Anonymous'}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{s.device_label} · {formatTime(s.time_in)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{formatRupees(s.total)}</p>
                  {s.credit > 0 && <span className="badge badge-danger" style={{ marginTop: '0.25rem' }}>{formatRupees(s.credit)}</span>}
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Quick Actions</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
          <Link to="/sessions/new"    className="btn-primary"><Plus size={15} />New Session</Link>
          <Link to="/pancafe/new"     className="btn-secondary"><Plus size={15} />PanCafe</Link>
          <Link to="/inventory/sell"  className="btn-secondary"><Plus size={15} />Walk-in Sale</Link>
          <Link to="/recharges/new"   className="btn-secondary"><Plus size={15} />Recharge</Link>
          <Link to="/expenses/new"    className="btn-secondary"><Plus size={15} />Expense</Link>
        </div>
      </div>
    </div>
  )
}

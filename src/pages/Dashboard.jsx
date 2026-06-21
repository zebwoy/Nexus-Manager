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
    ? Number(snapshot.gaming_revenue || 0) +
      Number(snapshot.walkin_revenue || 0) +
      Number(snapshot.session_sales_revenue || 0) +
      Number(snapshot.rc_revenue || 0) +
      Number(snapshot.pancafe_revenue || 0)
    : 0

  if (loading) return <PageLoader />

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{today}</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          background: 'var(--bg-elevated)', padding: '0.5rem 0.85rem',
          borderRadius: '10px', border: '1px solid var(--border)',
          borderTop: '1.5px solid var(--bevel-top)', borderBottom: '1.5px solid var(--bevel-bottom)',
          boxShadow: 'var(--shadow)'
        }}>
          <span className="led-indicator led-green" style={{ width: '8px', height: '8px' }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 650 }}>
            OPERATOR: <span style={{ color: 'var(--text)', fontWeight: 750 }}>{user?.full_name?.toUpperCase()}</span>
          </span>
        </div>
      </div>

      <ErrorMsg error={error} />

      {/* Stats (glowing digital readouts) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {[
          { label: "Today's Revenue", value: formatRupees(totalRevenue), sub: 'ALL COMBINED SOURCES', state: 'success' },
          { label: 'Gaming Sessions', value: formatRupees(snapshot?.gaming_revenue),  sub: 'ACTIVE BILLABLE SLOTS', state: '' },
          { label: 'Shop Inventory',  value: formatRupees(Number(snapshot?.walkin_revenue || 0) + Number(snapshot?.session_sales_revenue || 0)), sub: 'WALK-IN + TABLE SALES', state: '' },
          { label: 'RC + PanCafe',    value: formatRupees(Number(snapshot?.rc_revenue || 0) + Number(snapshot?.pancafe_revenue || 0)), sub: 'PLATFORM RECHARGES', state: 'warning' },
        ].map((s, i) => (
          <div key={i} className={`lcd-screen ${s.state}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '110px' }}>
            <div>
              <p style={{ fontSize: '0.675rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>{s.label}</p>
              <p style={{ fontSize: '1.85rem', fontWeight: 750, marginTop: '0.15rem', letterSpacing: '-0.02em', fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</p>
            </div>
            <p style={{ fontSize: '0.625rem', letterSpacing: '0.05em', opacity: 0.6, fontWeight: 600 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.25rem' }}>

        {/* Credits outstanding panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <SectionHeader
            title="Credits Outstanding"
            action={snapshot?.total_outstanding_credit > 0
              ? <span className="badge badge-danger">{formatRupees(snapshot.total_outstanding_credit)}</span>
              : <span className="badge badge-success">Clear</span>}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: credits.length === 0 ? 'center' : 'flex-start' }}>
            {credits.length === 0
              ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontWeight: 500 }}>No outstanding credits log</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {credits.map((c, i) => (
                    <div key={c.session_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.85rem 0.75rem', borderRadius: '10px',
                      background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                      borderBottom: i < credits.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>{c.name || 'Anonymous'}</p>
                        <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 550 }}>{formatDate(c.date)} · {c.device_label}</p>
                      </div>
                      <span className="badge badge-danger">{formatRupees(c.credit)}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>

        {/* Recent sessions panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <SectionHeader
            title="Recent Sessions"
            action={<Link to="/sessions" className="btn-secondary btn-sm" style={{ padding: '0.25rem 0.65rem' }}>Monitor logs</Link>}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: recentSessions.length === 0 ? 'center' : 'flex-start' }}>
            {recentSessions.length === 0
              ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontWeight: 500 }}>No operator sessions logged today</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {recentSessions.map((s, i) => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.85rem 0.75rem', borderRadius: '10px',
                      background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                      borderBottom: i < recentSessions.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>{s.name || 'Anonymous'}</p>
                        <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 550 }}>{s.device_label} · {formatTime(s.time_in)}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 750, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(s.total)}</p>
                        {s.credit > 0 && <span className="badge badge-danger" style={{ marginTop: '0.25rem' }}>{formatRupees(s.credit)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>
      </div>

      {/* Quick actions panel */}
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <p style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.95rem' }}>Hardware Commands & Actions</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Link to="/sessions/new"    className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}><Plus size={14} strokeWidth={3} />New Gaming Session</Link>
          <Link to="/pancafe/new"     className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}><Plus size={14} strokeWidth={2.5} />Launch PanCafe</Link>
          <Link to="/inventory/sell"  className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}><Plus size={14} strokeWidth={2.5} />Complete Walk-in Sale</Link>
          <Link to="/recharges/new"   className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}><Plus size={14} strokeWidth={2.5} />Recharge Platform</Link>
          <Link to="/expenses/new"    className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}><Plus size={14} strokeWidth={2.5} />Log System Expense</Link>
        </div>
      </div>
    </div>
  )
}

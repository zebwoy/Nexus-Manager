import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { formatRupees, formatDate, formatTime, todayISO } from '../lib/helpers'
import { PageLoader, ErrorMsg, SectionHeader, Modal, Field, Spinner, TrialWarningModal } from '../components/UI'
import { Plus, LayoutGrid, List, Coffee, Zap, TrendingDown, FileCheck, RefreshCw } from 'lucide-react'
import LogSessionModal from '../components/LogSessionModal'
import StationGrid from '../components/StationGrid'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState(null)
  const [credits, setCredits] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [activeSessions, setActiveSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Day-start opening balance modal
  const [showOpeningModal, setShowOpeningModal] = useState(false)
  const [openingCash, setOpeningCash] = useState('')
  const [openingNote, setOpeningNote] = useState('')
  const [savingOpening, setSavingOpening] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const today = todayISO()
      const [snap, cred, sess, openR] = await Promise.all([
        api.get('/dashboard-snapshot?date=' + today),
        api.get('/dashboard-credits'),
        api.get('/sessions?date=' + today),
        api.get('/day-openings?date=' + today),
      ])

      setSnapshot(snap)
      setCredits(cred.credits || [])
      const allSessions = sess.sessions || []
      setRecentSessions(allSessions.slice(0, 6))
      setActiveSessions(allSessions.filter(s => s.is_active))
      if (!openR.opening) setShowOpeningModal(true)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaveOpening = async () => {
    if (openingCash === '') { setShowOpeningModal(false); return }
    setSavingOpening(true)
    try {
      await api.post('/day-openings', { opening_cash: Number(openingCash), note: openingNote || null, date: todayISO() })
      setShowOpeningModal(false)
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Set Opening Cash Balance' })
      }
    } catch (e) { setError(e.message) }
    finally { setSavingOpening(false) }
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
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => setTrialModal({ isOpen: false, action: '' })} />
      
      {/* Day-start modal */}
      <Modal open={showOpeningModal} onClose={() => setShowOpeningModal(false)} title="Good morning — Start of Day">
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          How much cash is currently in the cafe? This sets the opening balance for today's EOD reconciliation.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="Cash in drawer right now (₹)" required>
            <input type="number" className="input" placeholder="e.g. 500" autoFocus
              value={openingCash} onChange={e => setOpeningCash(e.target.value)} />
          </Field>
          <Field label="Note (optional)">
            <input className="input" placeholder="e.g. Carried ₹200 from yesterday"
              value={openingNote} onChange={e => setOpeningNote(e.target.value)} />
          </Field>
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handleSaveOpening} disabled={savingOpening} className="btn-primary" style={{ flex: 1 }}>
              {savingOpening ? <><Spinner size="sm" /> Saving...</> : 'Save & Start Day'}
            </button>
            <button onClick={() => setShowOpeningModal(false)} className="btn-secondary" style={{ flex: 1 }}>
              Skip for now
            </button>
          </div>
        </div>
      </Modal>

      <LogSessionModal open={showLogModal} onClose={() => setShowLogModal(false)} />

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

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {[
          { label: "Today's Revenue", value: formatRupees(totalRevenue), sub: 'ALL COMBINED SOURCES', state: 'success' },
          { label: 'Gaming Stations', value: formatRupees(snapshot?.gaming_revenue), sub: `${activeSessions.length} ACTIVE NOW`, state: activeSessions.length > 0 ? 'success' : '' },
          { label: 'Cafeteria Sales', value: formatRupees(Number(snapshot?.walkin_revenue || 0) + Number(snapshot?.session_sales_revenue || 0)), sub: 'WALK-IN + TABLE SALES', state: '' },
          { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>RC + <img src="/assets/favicon_PanCafe.ico" alt="PanCafe" style={{ width: '13px', height: '13px', objectFit: 'contain' }} /> PanCafe</span>, value: formatRupees(Number(snapshot?.rc_revenue || 0) + Number(snapshot?.pancafe_revenue || 0)), sub: 'PLATFORM RECHARGES', state: 'warning' },
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

      {/* ── LIVE FLOOR MATRIX (STATION GRID) ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.65rem' }}>
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LayoutGrid size={16} style={{ color: 'var(--accent-text)' }} /> Live Station Floor Matrix
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Real-time terminal status, countdowns, and quick actions
            </p>
          </div>
          <button onClick={() => setShowLogModal(true)} className="btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Plus size={13} strokeWidth={2.5} /> New Session
          </button>
        </div>

        <StationGrid
          activeSessions={activeSessions}
          onRefresh={load}
          onLaunchNewSession={() => setShowLogModal(true)}
        />
      </div>

      {/* Two columns: Credits Outstanding & Today's Sessions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

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
                    <button key={c.session_id} onClick={() => navigate(`/sessions/${c.session_id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 0.75rem', borderRadius: '10px', cursor: 'pointer',
                        background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                        borderBottom: i < credits.length - 1 ? '1px solid var(--border)' : 'none',
                        border: 'none', width: '100%', textAlign: 'left'
                      }}>
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>{c.name || 'Anonymous'}</p>
                        <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 550 }}>{formatDate(c.date)} · {c.device_label}</p>
                      </div>
                      <span className="badge badge-danger">{formatRupees(c.credit)}</span>
                    </button>
                  ))}
                </div>
              )
            }
          </div>
        </div>

        {/* Recent sessions panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <SectionHeader
            title="Recent Sessions Log"
            action={<Link to="/sessions" className="btn-secondary btn-sm" style={{ padding: '0.25rem 0.65rem' }}>View all</Link>}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: recentSessions.length === 0 ? 'center' : 'flex-start' }}>
            {recentSessions.length === 0
              ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontWeight: 500 }}>No sessions logged today</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {recentSessions.map((s, i) => (
                    <button key={s.id} onClick={() => navigate(`/sessions/${s.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 0.75rem', borderRadius: '10px', cursor: 'pointer',
                        background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                        borderBottom: i < recentSessions.length - 1 ? '1px solid var(--border)' : 'none',
                        border: 'none', width: '100%', textAlign: 'left'
                      }}>
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>{s.name || 'Anonymous'}</p>
                        <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 550 }}>
                          {s.device_label} · {formatTime(s.time_in)}
                          {s.is_active && <span className="badge-active-session animate-pulse" style={{ fontSize: '0.6rem', marginLeft: '0.4rem' }}>ACTIVE</span>}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 750, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(s.total)}</p>
                        {s.credit > 0 && <span className="badge badge-danger" style={{ marginTop: '0.25rem' }}>{formatRupees(s.credit)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )
            }
          </div>
        </div>
      </div>

      {/* Quick actions strip */}
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <p style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.95rem' }}>Quick Actions</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button onClick={() => setShowLogModal(true)} className="btn-primary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={14} strokeWidth={2.5} /> Log New Session
          </button>
          <Link to="/inventory/sell" className="btn-secondary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Coffee size={14} /> Walk-in Sale
          </Link>
          <Link to="/recharges/new" className="btn-secondary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={14} /> Platform Recharge
          </Link>
          <Link to="/expenses/new" className="btn-secondary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <TrendingDown size={14} /> Log Expense
          </Link>
          <Link to="/eod" className="btn-secondary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileCheck size={14} /> EOD Reconciliation
          </Link>
        </div>
      </div>
    </div>
  )
}

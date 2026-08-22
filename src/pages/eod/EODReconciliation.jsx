import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { formatRupees, todayISO } from '../../lib/helpers'
import { PageLoader, ErrorMsg, Field, Modal, Spinner } from '../../components/UI'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import { Banknote, Calculator, CheckCircle, Save, FileCheck, TrendingUp, TrendingDown, Receipt, CheckCircle2, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const DENOMINATIONS = [
  { value: 500, label: '₹500' },
  { value: 200, label: '₹200' },
  { value: 100, label: '₹100' },
  { value: 50,  label: '₹50'  },
  { value: 20,  label: '₹20'  },
  { value: 10,  label: '₹10'  },
  { value: 5,   label: '₹5'   },
  { value: 2,   label: '₹2'   },
  { value: 1,   label: '₹1'   },
]

export default function EODReconciliation() {
  const { user } = useAuth()
  const [snapshot, setSnapshot] = useState(null)
  const [opening, setOpening] = useState(null)
  const [rcData, setRcData] = useState({ cash: 0, online: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actualCash, setActualCash] = useState('')
  const [notes, setNotes] = useState('')
  const [savingShift, setSavingShift] = useState(false)
  const [showDenomModal, setShowDenomModal] = useState(false)
  
  // Currency Denominations State
  const [denoms, setDenoms] = useState({
    500: '', 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 2: '', 1: ''
  })

  const today = todayISO()

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [snap, openR, rcR] = await Promise.all([
        api.get('/dashboard-snapshot'),
        api.get(`/day-openings?date=${today}`),
        api.get(`/recharges?date=${today}`),
      ])
      setSnapshot(snap)
      setOpening(openR.opening)
      const recharges = rcR.recharges || []
      setRcData({
        cash: recharges.filter(r => r.payment_method === 'cash').reduce((s, r) => s + Number(r.payment_received || r.charge_price), 0),
        online: recharges.filter(r => r.payment_method === 'online').reduce((s, r) => s + Number(r.payment_received || r.charge_price), 0),
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const openingCash = Number(opening?.opening_cash || 0)

  const cashInflows = snapshot
    ? Number(snapshot.cash_gaming || 0) +
      Number(snapshot.cash_sales || 0) +
      Number(snapshot.cash_pancafe || 0) +
      rcData.cash
    : 0

  const onlineInflows = snapshot
    ? Number(snapshot.online_gaming || 0) +
      Number(snapshot.online_sales || 0) +
      Number(snapshot.online_pancafe || 0) +
      rcData.online
    : 0

  const cashOutflows = Number(snapshot?.cash_expenses || 0)
  const expectedCash = openingCash + cashInflows - cashOutflows
  const actualNum = actualCash !== '' ? Number(actualCash) : null
  const variance = actualNum !== null ? actualNum - expectedCash : null

  // Calculate total from denominations
  const totalFromDenoms = Object.entries(denoms).reduce((sum, [val, count]) => {
    return sum + (Number(val) * (Number(count) || 0))
  }, 0)

  const handleApplyDenominations = () => {
    setActualCash(String(totalFromDenoms))
    setShowDenomModal(false)
    toast.success(`Drawer cash updated: ${formatRupees(totalFromDenoms)}`)
  }

  const handleSaveShiftClose = async () => {
    if (actualCash === '') {
      setError('Please enter or calculate the actual cash counted in drawer')
      return
    }
    setSavingShift(true)
    setError('')
    try {
      await api.post('/day-openings', {
        date: today,
        opening_cash: openingCash,
        note: `EOD Close: Expected ₹${expectedCash}, Actual ₹${actualCash}, Variance ₹${variance}. ${notes}`.trim()
      })
      toast.success('EOD Shift Settlement recorded successfully!')
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingShift(false)
    }
  }

  const Row = ({ label, cash, online, highlight }) => (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      gap: '0.5rem', padding: '0.65rem 0',
      borderBottom: '1px dashed var(--border)',
      fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem'
    }}>
      <span style={{ color: highlight ? 'var(--text)' : 'var(--text-muted)', fontWeight: highlight ? 750 : 600 }}>{label}</span>
      <span style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 650 }}>{formatRupees(cash)}</span>
      <span style={{ textAlign: 'right', color: 'var(--accent-text)', fontWeight: 650 }}>{formatRupees(online)}</span>
    </div>
  )

  return (
    <div style={{ maxWidth: '740px', margin: '0 auto' }}>
      {/* Denominations Calculator Modal */}
      <Modal open={showDenomModal} onClose={() => setShowDenomModal(false)} title="Currency Denomination Counter">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Count physical currency notes &amp; coins in the cash drawer:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {DENOMINATIONS.map(({ value, label }) => {
              const count = denoms[value] || ''
              const lineTotal = Number(value) * (Number(count) || 0)
              return (
                <div key={value} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-input)', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border)'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', width: '3.5rem' }}>{label}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="input"
                    style={{ width: '4.5rem', textAlign: 'center', padding: '0.3rem 0.4rem', height: '2rem' }}
                    value={count}
                    onChange={e => setDenoms(d => ({ ...d, [value]: e.target.value }))}
                  />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--text-muted)', width: '4rem', textAlign: 'right' }}>
                    {formatRupees(lineTotal)}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '1.5px dashed var(--border)', paddingTop: '0.75rem',
            fontFamily: "'JetBrains Mono', monospace"
          }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)' }}>CALCULATED TOTAL:</span>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--accent-text)' }}>{formatRupees(totalFromDenoms)}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <button onClick={handleApplyDenominations} className="btn-primary" style={{ flex: 1 }}>
              Apply to Drawer ({formatRupees(totalFromDenoms)})
            </button>
            <button onClick={() => setShowDenomModal(false)} className="btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">End of Day Reconciliation</h1>
        <p className="page-sub">Cash drawer balance check · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <ErrorMsg error={error} />

      {loading ? <PageLoader /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Opening balance card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
            <div>
              <p style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opening Cash Balance</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', marginTop: '0.15rem' }}>{formatRupees(openingCash)}</p>
            </div>
            {opening
              ? <span className="badge badge-success">Set at {new Date(opening.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              : <span className="badge badge-danger">Not set today</span>}
          </div>

          {/* Inflows breakdown */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
              <TrendingUp size={14} style={{ color: 'var(--success)' }} />
              Today's Inflows
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase' }}>Category</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Cash</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-text)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Online</span>
            </div>
            {snapshot && <>
              <Row label="Gaming Sessions" cash={snapshot.cash_gaming} online={snapshot.online_gaming} />
              <Row label="Shop Sales" cash={snapshot.cash_sales} online={snapshot.online_sales} />
              <Row label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><img src="/assets/favicon_PanCafe.ico" alt="PanCafe" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />PanCafe</span>} cash={snapshot.cash_pancafe} online={snapshot.online_pancafe} />
              <Row label="Recharges" cash={rcData.cash} online={rcData.online} />
              <Row label="TOTAL INFLOWS" cash={cashInflows} online={onlineInflows} highlight />
            </>}
          </div>

          {/* Cash outflows */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
              <TrendingDown size={14} style={{ color: 'var(--danger)' }} />
              Cash Outflows (Expenses)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ color: 'var(--text-muted)' }}>Expenses paid in cash</span>
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatRupees(cashOutflows)}</span>
            </div>
          </div>

          {/* Expected vs Actual */}
          <div className="card" style={{ background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <Receipt size={14} style={{ color: 'var(--accent)' }} />
                Cash Drawer Settlement
              </div>
              <button onClick={() => setShowDenomModal(true)} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                <Calculator size={13} /> Count Notes &amp; Coins
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Opening cash</span>
                <span>{formatRupees(openingCash)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>+ Cash collected today</span>
                <span style={{ color: 'var(--success)' }}>+{formatRupees(cashInflows)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>− Cash expenses</span>
                <span style={{ color: 'var(--danger)' }}>−{formatRupees(cashOutflows)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px dashed var(--border)', paddingTop: '0.5rem', fontWeight: 800, fontSize: '1rem' }}>
                <span>Expected in drawer</span>
                <span style={{ color: 'var(--accent-text)' }}>{formatRupees(expectedCash)}</span>
              </div>
            </div>

            {snapshot?.total_outstanding_credit > 0 && (
              <div style={{ padding: '0.65rem 1rem', borderRadius: '10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: 'var(--danger)', fontWeight: 650 }}>Outstanding credits (not in drawer)</span>
                <span style={{ color: 'var(--danger)', fontWeight: 800 }}>{formatRupees(snapshot.total_outstanding_credit)}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <Field label="Actual cash counted in drawer (₹)">
                <input type="number" className="input" placeholder="Count and enter physical cash or use calculator above"
                  value={actualCash} onChange={e => setActualCash(e.target.value)} />
              </Field>

              <Field label="Handover Notes / Discrepancy Reason (optional)">
                <input className="input" placeholder="e.g. ₹50 advance paid to helper, petty cash note..."
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </Field>
            </div>

            {variance !== null && (
              <div style={{
                marginTop: '1.25rem', padding: '0.85rem 1.25rem', borderRadius: '12px',
                background: Math.abs(variance) < 1 ? 'rgba(34,197,94,0.1)' : 'rgba(220,38,38,0.1)',
                border: `1.5px solid ${Math.abs(variance) < 1 ? 'var(--success)' : 'var(--danger)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: "'JetBrains Mono', monospace"
              }}>
                <span style={{ fontWeight: 700, color: Math.abs(variance) < 1 ? 'var(--success)' : 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {Math.abs(variance) < 1 ? <><CheckCircle2 size={14} /> Drawer perfectly balanced</> : variance > 0 ? <><ArrowUpRight size={14} /> Cash surplus (Over)</> : <><ArrowDownRight size={14} /> Cash discrepancy (Short)</>}
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: Math.abs(variance) < 1 ? 'var(--success)' : 'var(--danger)' }}>
                  {variance > 0 ? '+' : ''}{formatRupees(variance)}
                </span>
              </div>
            )}

            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button onClick={handleSaveShiftClose} disabled={savingShift || actualCash === ''} className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.65rem 1.25rem' }}>
                {savingShift ? <><Spinner size="sm" /> Recording EOD Settlement...</> : <><Save size={14} /> Record &amp; Finalize EOD Settlement</>}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

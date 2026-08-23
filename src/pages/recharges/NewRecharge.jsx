import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, todayISO, validateFirstName, validateMobile } from '../../lib/helpers'
import { Field, ErrorMsg, TrialWarningModal, Spinner, DateInput } from '../../components/UI'
import SplitPayment from '../../components/SplitPayment'
import { useAuth } from '../../context/AuthContext'
import { Zap } from 'lucide-react'

export default function NewRecharge() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    customer_id: null,
    game_platform: '',
    cost_price: '',
    charge_price: '',
    note: '',
    date: todayISO()
  })
  const [cashAmount, setCashAmount] = useState('')
  const [onlineAmount, setOnlineAmount] = useState('')

  const [platforms, setPlatforms] = useState([])
  const [customPlatform, setCustomPlatform] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })
  
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    api.get('/platforms').then(d => {
      setPlatforms(d.platforms || [])
      if (d.platforms?.length > 0) {
        f('game_platform', d.platforms[0].name)
      }
    }).catch(() => {})
  }, [])

  const cost = Number(form.cost_price || 0)
  const charge = Number(form.charge_price || 0)
  const margin = form.cost_price !== '' && form.charge_price !== '' ? charge - cost : null
  const marginPct = cost > 0 && margin !== null ? ((margin / cost) * 100).toFixed(1) : null

  const handleNameChange = async (val) => {
    f('name', val)
    if (val.length >= 2) {
      try {
        const d = await api.get(`/customers?search=${encodeURIComponent(val)}&type=recharge`)
        setCustomerSuggestions(d.customers || [])
      } catch {
        setCustomerSuggestions([])
      }
    } else {
      setCustomerSuggestions([])
    }
  }

  const handleSubmit = async () => {
    if (form.name) {
      const nameErr = validateFirstName(form.name)
      if (nameErr) { setError(nameErr); return }
    }
    const mobileErr = validateMobile(form.mobile)
    if (mobileErr) { setError(mobileErr); return }

    if (!form.cost_price || !form.charge_price) {
      setError('Cost and charge price are required')
      return
    }

    const c = Number(cashAmount || 0)
    const o = Number(onlineAmount || 0)
    const totalCollected = c + o
    const paymentMethod = (c > 0 && o > 0) ? 'split' : (o > 0 ? 'online' : 'cash')
    const finalReceived = totalCollected > 0 ? totalCollected : charge

    setLoading(true)
    setError('')

    try {
      await api.post('/recharges', {
        ...form,
        cost_price: Number(form.cost_price),
        charge_price: Number(form.charge_price),
        payment_received: finalReceived,
        payment_method: paymentMethod
      })
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Recharge Entry' })
      } else {
        navigate('/recharges')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => { setTrialModal({ isOpen: false, action: '' }); navigate('/recharges') }} />
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">New Recharge Entry</h1>
        <p className="page-sub">Log platform, store costs, margins, and tender collections</p>
      </div>

      <ErrorMsg error={error} />
      
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Customer Profile">
            <div style={{ position: 'relative' }}>
              <input className="input" placeholder="Walk-in Client" value={form.name} onChange={e => handleNameChange(e.target.value)} />
              {customerSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
                  boxShadow: 'var(--shadow-md)', borderRadius: '10px', marginTop: '0.45rem',
                  overflow: 'hidden'
                }}>
                  {customerSuggestions.map(c => (
                    <button key={c.id} onClick={() => { f('name', c.name); f('mobile', c.mobile||''); f('customer_id', c.id); setCustomerSuggestions([]) }}
                      className="btn-ghost"
                      style={{ width: '100%', textAlign: 'left', padding: '0.65rem 0.85rem', fontSize: '0.85rem', borderRadius: 0, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label="Recharge Platform">
            {platforms.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <select className="input" value={customPlatform ? '__custom__' : form.game_platform} onChange={e => {
                  if (e.target.value === '__custom__') {
                    setCustomPlatform(true)
                    f('game_platform', '')
                  } else {
                    setCustomPlatform(false)
                    f('game_platform', e.target.value)
                  }
                }}>
                  {platforms.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  <option value="__custom__">+ Other Custom Platform</option>
                </select>
                {customPlatform && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <input
                      className="input"
                      placeholder="e.g. Steam, EA Play..."
                      value={form.game_platform}
                      onChange={e => f('game_platform', e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setCustomPlatform(false); f('game_platform', platforms[0]?.name || '') }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-text)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left', padding: '0' }}
                    >
                      ← Back to platform list
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <input className="input" placeholder="e.g. Steam, EA Play..." value={form.game_platform} onChange={e => f('game_platform', e.target.value)} />
            )}
          </Field>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Merchant Cost (₹)" required>
            <input type="number" className="input" placeholder="Purchase price" value={form.cost_price} onChange={e => f('cost_price', e.target.value)} />
          </Field>
          <Field label="Client Charge (₹)" required>
            <input type="number" className="input" placeholder="Sale price" value={form.charge_price} onChange={e => f('charge_price', e.target.value)} />
          </Field>
        </div>

        {/* Smart Margin Calculator Card */}
        {margin !== null && (
          <div style={{
            padding: '0.85rem 1.15rem', borderRadius: '12px',
            background: margin >= 0 ? 'rgba(34,197,94, 0.08)' : 'rgba(239,68,68, 0.08)',
            border: `1px solid ${margin >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Zap size={13} style={{ color: 'var(--accent)' }} /> Smart Margin Calculator
              </p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: margin >= 0 ? 'var(--success)' : 'var(--danger)', fontFamily: "'JetBrains Mono', monospace", marginTop: '0.15rem' }}>
                {margin >= 0 ? '+' : ''}{formatRupees(margin)}
              </p>
            </div>
            {marginPct !== null && (
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${margin >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', fontFamily: "'JetBrains Mono', monospace" }}>
                  {marginPct}% margin
                </span>
              </div>
            )}
          </div>
        )}

        {/* Split Payment Component */}
        <div style={{ background: 'var(--bg-elevated)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <SplitPayment
            cashValue={cashAmount}
            onlineValue={onlineAmount}
            onCashChange={setCashAmount}
            onOnlineChange={setOnlineAmount}
            totalBill={charge}
            label="Recharge Payment Collection (Cash / UPI / Split)"
          />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Operational Date">
            <DateInput value={form.date} onChange={e => f('date', e.target.value)} showTodayButton={true} />
          </Field>
          <Field label="Reference notes">
            <input className="input" placeholder="Transaction IDs, codes..." value={form.note} onChange={e => f('note', e.target.value)} />
          </Field>
        </div>
        
        <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ padding: '0.65rem 1.35rem' }}>
            {loading ? <><Spinner size="sm" /> Logging RC...</> : 'Log Recharge Entry'}
          </button>
          <button onClick={() => navigate('/recharges')} className="btn-secondary" style={{ padding: '0.65rem 1.35rem' }}>Abort Command</button>
        </div>
      </div>
    </div>
  )
}

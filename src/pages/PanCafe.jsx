// ─── PanCafe Page ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatTime, formatDate, todayISO, validateName, validateMobile } from '../lib/helpers'
import { useAuth } from '../context/AuthContext'
import { PageLoader, EmptyState, ErrorMsg, Field, Modal, Spinner, TrialWarningModal, DateInput } from '../components/UI'
import LogSessionModal from '../components/LogSessionModal'
import { Coffee, Calendar } from 'lucide-react'
import { toast } from 'react-toastify'


export function PanCafe() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || todayISO())
  const [closing, setClosing] = useState(null)
  const [closeForm, setCloseForm] = useState({ time_out: '', amount_received: '', payment_method: 'cash' })
  const [closeSaving, setCloseSaving] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })
  const navigate = useNavigate()

  useEffect(() => { load() }, [dateFilter])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.get(`/pancafe?date=${dateFilter}`)
      setSessions(data.sessions || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleCloseSession = async () => {
    if (!closing) return
    setCloseSaving(true)
    try {
      await api.patch(`/pancafe/${closing.id}`, {
        time_out: closeForm.time_out || new Date().toTimeString().slice(0,5),
        amount_received: closeForm.amount_received !== '' ? Number(closeForm.amount_received) : closing.amount_received,
        payment_method: closeForm.payment_method || 'cash',
      })
      setClosing(null)
      load()
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Close PanCafe Session' })
      }
    } catch (err) { setError(err.message) }
    finally { setCloseSaving(false) }
  }

  return (
    <div>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => setTrialModal({ isOpen: false, action: '' })} />
      <LogSessionModal open={showLogModal} onClose={() => setShowLogModal(false)} />
      <Modal open={!!closing} onClose={() => setClosing(null)} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <img src="/assets/favicon_PanCafe.ico" alt="PanCafe" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
          <span>Close PanCafe Session</span>
        </div>
      }>
        {closing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'var(--bg-input)', padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.875rem' }}>
              Closing session for <strong>{closing.name || closing.pancafe_username}</strong> · {closing.device_label}
            </div>

            <Field label="Time Out (Auto: Now)">
              <input type="time" className="input" defaultValue={new Date().toTimeString().slice(0, 5)} onChange={e => setCloseForm(c => ({ ...c, time_out: e.target.value }))} />
            </Field>

            <Field label="Amount Received (₹)">
              <input type="number" className="input" defaultValue={closing.amount_received} onChange={e => setCloseForm(c => ({ ...c, amount_received: e.target.value }))} />
            </Field>

            <Field label="Payment Method">
              <select className="input" value={closeForm.payment_method} onChange={e => setCloseForm(c => ({ ...c, payment_method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="online">Online / UPI</option>
                <option value="credit">Credit / Ledger</option>
              </select>
            </Field>

            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '0.75rem' }}>
              <button onClick={handleCloseSession} disabled={closeSaving} className="btn-primary" style={{ flex: 1 }}>
                {closeSaving ? <><Spinner size="sm" /> Closing...</> : 'Close Session'}
              </button>
              <button onClick={() => setClosing(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <img src="/assets/favicon_PanCafe.ico" alt="PanCafe" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <h1 className="page-title" style={{ margin: 0 }}>PanCafe Sessions</h1>
          </div>
          <p className="page-sub" style={{ marginTop: '0.25rem' }}>Membership plan session log · PC only</p>
        </div>
        <button onClick={() => setShowLogModal(true)} className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>+ Log Session</button>
      </div>


      <ErrorMsg error={error} />

      {/* Filter strip */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
          <DateInput
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            showSteppers={true}
            showTodayButton={true}
          />
        </div>
        <span className="badge badge-accent">{sessions.filter(s => !s.time_out).length} Active</span>
      </div>


      {loading ? <PageLoader /> : sessions.length === 0 ? (
        <EmptyState icon={<img src="/assets/favicon_PanCafe.ico" alt="PanCafe" style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.85 }} />} title="No PanCafe Logs" description={`No membership sessions recorded for ${formatDate(dateFilter)}`}
          action={<Link to="/pancafe/new" className="btn-primary">Add PanCafe Log</Link>} />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Client Profile', 'PanCafe ID', 'Plan', 'Device', 'Time In', 'Time Out', 'Amount Collected', 'Pay Method', 'Notes', 'Logged By'].map(h =>
                  <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, idx) => (
                <tr key={s.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent', cursor: !s.time_out ? 'pointer' : 'default' }}
                  onClick={() => !s.time_out && setClosing(s)}>
                  <td className="table-cell" style={{ fontWeight: 700 }}>
                    {s.name || <span style={{ color: 'var(--text-faint)' }}>Anonymous</span>}
                    {s.shop_name && <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.1rem' }}>{s.shop_name}</p>}
                    {s.is_predated && (
                      <span className="badge badge-neutral" style={{ fontSize: '0.58rem', padding: '0.1rem 0.35rem', marginTop: '0.2rem', display: 'inline-block' }} title="Recorded after the session took place">
                        BACKDATED
                      </span>
                    )}
                  </td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 750, color: 'var(--accent-text)' }}>{s.pancafe_username}</td>
                  <td className="table-cell">
                    {s.plan_label
                      ? <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{s.plan_label}</span>
                      : <span style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>Custom</span>}
                  </td>
                  <td className="table-cell"><span className="badge badge-accent">{s.device_label || '—'}</span></td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatTime(s.time_in)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
                    {s.time_out
                      ? formatTime(s.time_out)
                      : <span className="badge badge-success" style={{ fontSize: '0.65rem', cursor: 'pointer' }}>● ACTIVE — click to close</span>}
                  </td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{formatRupees(s.amount_received)}</td>
                  <td className="table-cell">
                    <span className={`badge ${s.payment_method === 'online' ? 'badge-warning' : 'badge-accent'}`} style={{ fontSize: '0.6rem' }}>
                      {s.payment_method || 'cash'}
                    </span>
                  </td>
                  <td className="table-cell" style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>{s.remark || '—'}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.725rem', fontWeight: 600 }}>@{s.created_by_username || 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── New PanCafe Session ───────────────────────────────────────
export function NewPanCafe() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState({
    name: '', mobile: '', customer_id: null,
    pancafe_username: '', device_id: '', plan_id: '',
    date: todayISO(), time_in: new Date().toTimeString().slice(0,5),
    time_out: '', amount_received: '', remark: '', payment_method: 'cash'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  const isPredated = Boolean(form.date && form.date < todayISO())

  useEffect(() => {
    Promise.all([
      api.get('/devices'),
      api.get('/pancafe-plans'),
    ]).then(([d, p]) => {
      setDevices((d.devices || []).filter(dev => dev.type === 'PC'))
      setPlans(p.plans || [])
    })
  }, [])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handlePlanChange = (planId) => {
    f('plan_id', planId)
    if (planId) {
      const plan = plans.find(p => p.id === Number(planId))
      if (plan) f('amount_received', String(plan.price))
    }
  }

  const handleNameChange = async (val) => {
    f('name', val)
    if (val.length >= 2) {
      try { const d = await api.get(`/customers?search=${encodeURIComponent(val)}&type=pancafe`); setCustomerSuggestions(d.customers || []) }
      catch { setCustomerSuggestions([]) }
    } else setCustomerSuggestions([])
  }

  const handleSubmit = async () => {
    const nameErr = validateName(form.name)
    if (nameErr) { setError(nameErr); return }

    const mobileErr = validateMobile(form.mobile)
    if (mobileErr) { setError(mobileErr); return }

    if (!form.pancafe_username || !form.amount_received) {
      setError('PanCafe username and amount received are required'); return
    }

    setLoading(true); setError('')
    try {
      const res = await api.post('/pancafe', {
        ...form,
        plan_id: form.plan_id ? Number(form.plan_id) : null,
        device_id: form.device_id ? Number(form.device_id) : null,
        amount_received: Number(form.amount_received),
        amount_spent: 0,  // no longer tracked as cost; just log receipt
        time_in: form.time_in ? new Date(`${form.date}T${form.time_in}`).toISOString() : null,
        time_out: form.time_out ? new Date(`${form.date}T${form.time_out}`).toISOString() : null,
      })
      toast.success(isPredated ? `Backdated PanCafe session #${res.id} recorded for ${form.date}` : `PanCafe session #${res.id} logged`)
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Log PanCafe Session' })
      } else {
        navigate(`/pancafe?date=${form.date}`)
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const selectedPlan = plans.find(p => p.id === Number(form.plan_id))

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => { setTrialModal({ isOpen: false, action: '' }); navigate('/pancafe') }} />
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <img src="/assets/favicon_PanCafe.ico" alt="PanCafe" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <h1 className="page-title" style={{ margin: 0 }}>Log PanCafe Session</h1>
        </div>
        <p className="page-sub" style={{ marginTop: '0.25rem' }}>Record a membership plan session</p>
      </div>

      {isPredated && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.85rem 1.1rem',
          background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '10px', fontSize: '0.825rem', color: 'var(--accent-text)', fontWeight: 650,
          marginBottom: '1.25rem'
        }}>
          <Calendar size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>Backdated Entry Mode:</strong> Recording historical PanCafe session for <strong>{form.date}</strong>.
          </span>
        </div>
      )}

      <ErrorMsg error={error} />

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Customer fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Field label="Customer Name">
            <div style={{ position: 'relative' }}>
              <input className="input" placeholder="Anonymous Client" value={form.name} onChange={e => handleNameChange(e.target.value)} />
              {customerSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
                  boxShadow: 'var(--shadow-md)', borderRadius: '10px', marginTop: '0.45rem', overflow: 'hidden'
                }}>
                  {customerSuggestions.map(c => (
                    <button key={c.id} onClick={() => {
                      f('name', c.name); f('mobile', c.mobile || ''); f('customer_id', c.id)
                      if (c.pancafe_username) f('pancafe_username', c.pancafe_username)
                      setCustomerSuggestions([])
                    }} className="btn-ghost" style={{
                      width: '100%', textAlign: 'left', padding: '0.65rem 0.85rem',
                      fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between',
                      borderRadius: 0, borderBottom: '1px solid var(--border)'
                    }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{c.name}</span>
                      <div style={{ textAlign: 'right' }}>
                        {c.pancafe_username && <span style={{ color: 'var(--accent-text)', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>{c.pancafe_username}</span>}
                        {c.mobile && <span style={{ color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', display: 'block' }}>{c.mobile}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <Field label="PanCafe Username / ID" required>
            <input className="input" placeholder="e.g. pc_user99" value={form.pancafe_username} onChange={e => f('pancafe_username', e.target.value)} />
          </Field>
        </div>

        {/* Plan selector */}
        <Field label="Membership Plan">
          <select className="input" value={form.plan_id} onChange={e => handlePlanChange(e.target.value)}>
            <option value="">Custom / No plan</option>
            {plans.filter(p => p.is_active).map(p => (
              <option key={p.id} value={p.id}>
                {p.is_signup_plan ? '[Sign-up] ' : ''}{p.label} — {p.hours}h for {formatRupees(p.price)}
              </option>
            ))}
          </select>
          {selectedPlan && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              {selectedPlan.hours} hours · {formatRupees(selectedPlan.price)} auto-filled below
            </p>
          )}
        </Field>

        {/* Device & Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Field label="PC Station">
            <select className="input" value={form.device_id} onChange={e => f('device_id', e.target.value)}>
              <option value="">Select Station</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Session Date">
            <DateInput value={form.date} onChange={e => f('date', e.target.value)} showTodayButton={true} />
          </Field>

        </div>

        {/* Timestamps */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Field label="Time In">
            <input type="time" className="input" value={form.time_in} onChange={e => f('time_in', e.target.value)} />
          </Field>
          <Field label="Time Out (leave blank if still active)">
            <input type="time" className="input" placeholder="Active" value={form.time_out} onChange={e => f('time_out', e.target.value)} />
          </Field>
        </div>

        {/* Amount */}
        <Field label="Amount Collected from Member (₹)" required>
          <input type="number" className="input" placeholder="Auto-filled from plan, or enter manually"
            value={form.amount_received} onChange={e => f('amount_received', e.target.value)} />
        </Field>

        {/* Payment method */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="label" style={{ marginBottom: 0 }}>Payment Method</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['cash', 'online', 'credit'].map(m => (
              <button key={m} onClick={() => f('payment_method', m)}
                style={{
                  padding: '0.35rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                  border: `1.5px solid ${form.payment_method === m ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.payment_method === m ? 'var(--accent-dim)' : 'var(--bg-input)',
                  color: form.payment_method === m ? 'var(--accent-text)' : 'var(--text-muted)',
                  fontWeight: 650, fontSize: '0.75rem', textTransform: 'capitalize'
                }}>{m}</button>
            ))}
          </div>
        </div>

        <Field label="Notes / Remarks">
          <input className="input" placeholder="Any access codes, comments..." value={form.remark} onChange={e => f('remark', e.target.value)} />
        </Field>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '0.85rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ padding: '0.65rem 1.35rem' }}>
            {loading ? <><Spinner size="sm" /> Saving...</> : 'Save PanCafe Log'}
          </button>
          <button onClick={() => navigate('/pancafe')} className="btn-secondary" style={{ padding: '0.65rem 1.35rem' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

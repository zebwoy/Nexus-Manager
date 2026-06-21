// ─── PanCafe Page ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatTime, formatDate, todayISO } from '../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, Field } from '../components/UI'

export function PanCafe() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())

  useEffect(() => { load() }, [dateFilter])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.get(`/pancafe?date=${dateFilter}`)
      setSessions(data.sessions || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyBreak: 'space-between', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">PanCafe Sessions</h1>
          <p className="page-sub">Third-party console session managers</p>
        </div>
        <Link to="/pancafe/new" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>+ Log Session</Link>
      </div>

      <ErrorMsg error={error} />

      {/* Filter strip */}
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.85rem 1.25rem', marginBottom: '1.5rem'
      }}>
        <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input" style={{ width: 'auto', padding: '0.45rem 0.75rem' }} />
      </div>

      {loading ? <PageLoader /> : sessions.length === 0 ? (
        <EmptyState icon="☕" title="No PanCafe Logs" description={`No third-party logs recorded for date: ${formatDate(dateFilter)}`}
          action={<Link to="/pancafe/new" className="btn-primary">Add PanCafe Log</Link>} />
      ) : (
        /* Beveled table */
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Client Profile', 'PanCafe Username/ID', 'Device Seat', 'Time In', 'Time Out', 'Cash Received', 'Spent on Top-up', 'Operator Margin', 'Logged By'].map(h =>
                  <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, idx) => (
                <tr key={s.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                  <td className="table-cell" style={{ fontWeight: 700 }}>{s.name || <span style={{ color: 'var(--text-faint)' }}>Anonymous</span>}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 750, color: 'var(--accent-text)' }}>{s.pancafe_username}</td>
                  <td className="table-cell"><span className="badge badge-accent">{s.device_label || '—'}</span></td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatTime(s.time_in)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
                    {s.time_out ? formatTime(s.time_out) : <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Active</span>}
                  </td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(s.amount_received)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(s.amount_spent)}</td>
                  <td className="table-cell">
                    <span className={`badge ${s.margin >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatRupees(s.margin)}
                    </span>
                  </td>
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
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [form, setForm] = useState({
    name: '', mobile: '', customer_id: null,
    pancafe_username: '', device_id: '',
    date: todayISO(), time_in: new Date().toTimeString().slice(0,5),
    time_out: '', amount_received: '', amount_spent: '', remark: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState([])

  useEffect(() => {
    api.get('/devices').then(d => setDevices((d.devices || []).filter(dev => dev.type === 'PC')))
  }, [])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleNameChange = async (val) => {
    f('name', val)
    if (val.length >= 2) {
      try { const d = await api.get(`/customers?search=${encodeURIComponent(val)}`); setCustomerSuggestions(d.customers || []) }
      catch { setCustomerSuggestions([]) }
    } else setCustomerSuggestions([])
  }

  const margin = form.amount_received && form.amount_spent
    ? Number(form.amount_received) - Number(form.amount_spent) : null

  const handleSubmit = async () => {
    if (!form.pancafe_username || !form.amount_received || !form.amount_spent) {
      setError('PanCafe username, amount received, and amount spent are required'); return
    }
    setLoading(true); setError('')
    try {
      await api.post('/pancafe', {
        ...form,
        device_id: form.device_id ? Number(form.device_id) : null,
        amount_received: Number(form.amount_received),
        amount_spent: Number(form.amount_spent),
        time_in: form.time_in ? new Date(`${form.date}T${form.time_in}`).toISOString() : null,
        time_out: form.time_out ? new Date(`${form.date}T${form.time_out}`).toISOString() : null,
      })
      navigate('/pancafe')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">New PanCafe Session</h1>
        <p className="page-sub">Launch a logged third-party transaction slot</p>
      </div>

      <ErrorMsg error={error} />

      {/* Form chassis */}
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
                  boxShadow: 'var(--shadow-md)', borderRadius: '10px', marginTop: '0.45rem',
                  overflow: 'hidden'
                }}>
                  {customerSuggestions.map(c => (
                    <button key={c.id} onClick={() => { f('name', c.name); f('mobile', c.mobile || ''); f('customer_id', c.id); setCustomerSuggestions([]) }}
                      className="btn-ghost"
                      style={{
                        width: '100%', textAlign: 'left', padding: '0.65rem 0.85rem',
                        fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between',
                        borderRadius: 0, borderBottom: '1px solid var(--border)'
                      }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{c.name}</span>
                      {c.mobile && <span style={{ color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>{c.mobile}</span>}
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

        {/* Device & Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Field label="PC Station Seat">
            <select className="input" value={form.device_id} onChange={e => f('device_id', e.target.value)}>
              <option value="">Select Station</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Session Date">
            <input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} />
          </Field>
        </div>

        {/* Timestamps */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Field label="Time In">
            <input type="time" className="input" value={form.time_in} onChange={e => f('time_in', e.target.value)} />
          </Field>
          <Field label="Time Out (leaving time)">
            <input type="time" className="input" placeholder="Active" value={form.time_out} onChange={e => f('time_out', e.target.value)} />
          </Field>
        </div>

        {/* Financial margins */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Field label="Amount Received from Client (₹)" required>
            <input type="number" className="input" placeholder="e.g. 300" value={form.amount_received} onChange={e => f('amount_received', e.target.value)} />
          </Field>
          <Field label="Cost of PanCafe Top-up (₹)" required>
            <input type="number" className="input" placeholder="e.g. 280" value={form.amount_spent} onChange={e => f('amount_spent', e.target.value)} />
          </Field>
        </div>

        {/* Margin display */}
        {margin !== null && (
          <div style={{ display: 'flex' }}>
            <span className={`badge ${margin >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', fontFamily: "'JetBrains Mono', monospace" }}>
              Net Operator Margin: {formatRupees(margin)}
            </span>
          </div>
        )}

        <Field label="Session remark">
          <input className="input" placeholder="Account top-up codes, comments..." value={form.remark} onChange={e => f('remark', e.target.value)} />
        </Field>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '0.85rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ padding: '0.65rem 1.35rem' }}>
            {loading ? 'Storing log...' : 'Save PanCafe Log'}
          </button>
          <button onClick={() => navigate('/pancafe')} className="btn-secondary" style={{ padding: '0.65rem 1.35rem' }}>Abort Command</button>
        </div>
      </div>
    </div>
  )
}

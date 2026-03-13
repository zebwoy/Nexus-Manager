// ─── PanCafe Page ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatTime, formatDate, todayISO } from '../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, Field, Spinner } from '../components/UI'

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
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">PanCafe</h1>
          <p className="page-subtitle">Third-party platform session log</p>
        </div>
        <Link to="/pancafe/new" className="btn-primary">+ New Session</Link>
      </div>
      <ErrorMsg error={error} />
      <div className="flex items-center gap-4 mb-4">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input w-auto" />
      </div>
      {loading ? <PageLoader /> : sessions.length === 0 ? (
        <EmptyState icon="☕" title="No PanCafe sessions" description="No sessions found for this date"
          action={<Link to="/pancafe/new" className="btn-primary">Add Session</Link>} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>{['Customer', 'PanCafe ID', 'PC', 'Time In', 'Time Out', 'Received', 'Spent', 'Margin', 'Logged By'].map(h =>
                <th key={h} className="table-header text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-surface-800/50">
                  <td className="table-cell">{s.name || '—'}</td>
                  <td className="table-cell font-mono text-brand-400">{s.pancafe_username}</td>
                  <td className="table-cell"><span className="badge badge-blue">{s.device_label || '—'}</span></td>
                  <td className="table-cell font-mono text-sm">{formatTime(s.time_in)}</td>
                  <td className="table-cell font-mono text-sm">{s.time_out ? formatTime(s.time_out) : <span className="badge badge-yellow">Active</span>}</td>
                  <td className="table-cell font-mono">{formatRupees(s.amount_received)}</td>
                  <td className="table-cell font-mono">{formatRupees(s.amount_spent)}</td>
                  <td className="table-cell"><span className="badge badge-green">{formatRupees(s.margin)}</span></td>
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
    <div className="max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">New PanCafe Session</h1>
        <p className="page-subtitle">Log a PanCafe platform session</p>
      </div>
      <ErrorMsg error={error} />
      <div className="card space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer Name">
            <div className="relative">
              <input className="input" placeholder="Name (optional)" value={form.name} onChange={e => handleNameChange(e.target.value)} />
              {customerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 bg-surface-800 border border-surface-700 rounded-lg mt-1 overflow-hidden shadow-xl">
                  {customerSuggestions.map(c => (
                    <button key={c.id} onClick={() => { f('name', c.name); f('mobile', c.mobile || ''); f('customer_id', c.id); setCustomerSuggestions([]) }}
                      className="w-full text-left px-3 py-2 hover:bg-surface-700 text-sm">
                      <span className="text-white">{c.name}</span>
                      {c.mobile && <span className="text-slate-500 ml-2 font-mono text-xs">{c.mobile}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <Field label="PanCafe Username / ID" required>
            <input className="input" placeholder="e.g. user123" value={form.pancafe_username} onChange={e => f('pancafe_username', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="PC Station">
            <select className="input" value={form.device_id} onChange={e => f('device_id', e.target.value)}>
              <option value="">Select PC</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Time In">
            <input type="time" className="input" value={form.time_in} onChange={e => f('time_in', e.target.value)} />
          </Field>
          <Field label="Time Out (manual — when they leave)">
            <input type="time" className="input" value={form.time_out} onChange={e => f('time_out', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount Received from Customer (₹)" required>
            <input type="number" className="input" placeholder="e.g. 500" value={form.amount_received} onChange={e => f('amount_received', e.target.value)} />
          </Field>
          <Field label="Amount Spent on PanCafe Top-up (₹)" required>
            <input type="number" className="input" placeholder="e.g. 490" value={form.amount_spent} onChange={e => f('amount_spent', e.target.value)} />
          </Field>
        </div>
        {margin !== null && (
          <div className="flex items-center gap-2">
            <span className="badge badge-green">Your margin: {formatRupees(margin)}</span>
          </div>
        )}
        <Field label="Remark">
          <input className="input" placeholder="Optional note" value={form.remark} onChange={e => f('remark', e.target.value)} />
        </Field>
        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? <span className="flex items-center gap-2"><Spinner size="sm" /> Saving...</span> : 'Save Session'}
          </button>
          <button onClick={() => navigate('/pancafe')} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

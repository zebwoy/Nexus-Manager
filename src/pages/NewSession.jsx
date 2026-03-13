import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { DURATION_OPTIONS, formatRupees, todayISO, nowTimeInput, toISO, addMinutes, formatDuration } from '../lib/helpers'
import { Field, ErrorMsg, Spinner, Modal } from '../components/UI'

const DEVICE_TYPES = { PC: 'PC', XBOX: 'XBOX', PS: 'PS' }

export default function NewSession() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [pricing, setPricing] = useState({})
  const [settings, setSettings] = useState({ controller_fee: 25, extra_person_fee: 15, extra_person_from: 3 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState([])

  // Form state
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    customer_id: null,
    device_id: '',
    device_type: '',
    duration_mins: 60,
    date: todayISO(),
    time_in: nowTimeInput(),
    payment_received: '',
    remark: '',
  })

  // PC controller state
  const [pcControllers, setPcControllers] = useState(0)

  // Console players state
  const [players, setPlayers] = useState([{ own_controller: false }])

  // Computed
  const [charge, setCharge] = useState(0)
  const [timeOut, setTimeOut] = useState('')

  useEffect(() => { loadSetup() }, [])

  const loadSetup = async () => {
    const [devData, priceData, settData] = await Promise.all([
      api.get('/devices'),
      api.get('/pricing'),
      api.get('/settings'),
    ])
    setDevices(devData.devices || [])
    // Build pricing map: { PC: { 30: 40, 60: 70, ... }, XBOX: {...}, PS: {...} }
    const map = {}
    for (const row of (priceData.pricing || [])) {
      if (!map[row.device_type]) map[row.device_type] = {}
      map[row.device_type][row.duration_mins] = row.price
    }
    setPricing(map)
    if (settData.settings) {
      const s = {}
      for (const row of settData.settings) s[row.key] = Number(row.value)
      setSettings(prev => ({ ...prev, ...s }))
    }
  }

  // Recompute charge whenever device/duration/players/controllers change
  useEffect(() => {
    const base = pricing[form.device_type]?.[form.duration_mins] || 0
    setCharge(base)

    // Compute time out
    if (form.time_in && form.duration_mins) {
      const dt = new Date(`${form.date}T${form.time_in}`)
      const tout = addMinutes(dt, form.duration_mins)
      setTimeOut(tout.toTimeString().slice(0, 5))
    }
  }, [form.device_type, form.duration_mins, form.time_in, form.date, pricing])

  // Controller totals
  const controllerTotal = (() => {
    if (form.device_type === 'PC') return pcControllers * settings.controller_fee
    if (!form.device_type) return 0
    return players.reduce((sum, p) => sum + (p.own_controller ? 0 : settings.controller_fee), 0)
  })()

  const extraPersonTotal = (() => {
    if (form.device_type === 'PC') return 0
    const extraFrom = settings.extra_person_from || 3
    return players.reduce((sum, _, i) => {
      return sum + (i + 1 >= extraFrom ? settings.extra_person_fee : 0)
    }, 0)
  })()

  const total = charge + controllerTotal + extraPersonTotal

  const handleDeviceChange = (deviceId) => {
    const dev = devices.find(d => d.id === Number(deviceId))
    setForm(f => ({ ...f, device_id: deviceId, device_type: dev?.type || '' }))
    setPlayers([{ own_controller: false }])
    setPcControllers(0)
  }

  const handleNameChange = async (val) => {
    setForm(f => ({ ...f, name: val, customer_id: null }))
    if (val.length >= 2) {
      try {
        const data = await api.get(`/customers?search=${encodeURIComponent(val)}`)
        setCustomerSuggestions(data.customers || [])
      } catch { setCustomerSuggestions([]) }
    } else {
      setCustomerSuggestions([])
    }
  }

  const selectCustomer = (c) => {
    setForm(f => ({ ...f, name: c.name, mobile: c.mobile || '', customer_id: c.id }))
    setCustomerSuggestions([])
  }

  const addPlayer = () => setPlayers(p => [...p, { own_controller: false }])
  const removePlayer = (i) => setPlayers(p => p.filter((_, idx) => idx !== i))
  const toggleOwnController = (i) => setPlayers(p => p.map((pl, idx) =>
    idx === i ? { ...pl, own_controller: !pl.own_controller } : pl
  ))

  const handleSubmit = async () => {
    if (!form.device_id || !form.duration_mins) {
      setError('Please select a device and duration')
      return
    }
    setLoading(true)
    setError('')
    try {
      const timeInISO  = toISO(form.date, form.time_in)
      const timeOutISO = toISO(form.date, timeOut)
      const payment    = form.payment_received !== '' ? Number(form.payment_received) : null
      const credit     = payment != null ? Math.max(0, total - payment) : null

      const playersPayload = form.device_type === 'PC'
        ? Array.from({ length: pcControllers }, (_, i) => ({
            player_number: i + 1,
            own_controller: false,
            controller_fee: settings.controller_fee,
            extra_person_fee: 0,
          }))
        : players.map((p, i) => ({
            player_number: i + 1,
            own_controller: p.own_controller,
            controller_fee: p.own_controller ? 0 : settings.controller_fee,
            extra_person_fee: i + 1 >= (settings.extra_person_from || 3) ? settings.extra_person_fee : 0,
          }))

      await api.post('/sessions', {
        customer_id: form.customer_id,
        name: form.name,
        mobile: form.mobile,
        device_id: Number(form.device_id),
        duration_mins: Number(form.duration_mins),
        time_in: timeInISO,
        time_out: timeOutISO,
        date: form.date,
        charge,
        controller_total: controllerTotal,
        extra_person_total: extraPersonTotal,
        total,
        payment_received: payment,
        credit,
        remark: form.remark,
        players: playersPayload,
      })
      navigate('/sessions')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isConsole = form.device_type === 'XBOX' || form.device_type === 'PS'

  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">New Session</h1>
        <p className="page-subtitle">Log a new gaming session</p>
      </div>

      <ErrorMsg error={error} />

      <div className="card space-y-5">
        {/* Customer */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer Name">
            <div className="relative">
              <input className="input" placeholder="Name (optional)"
                value={form.name} onChange={e => handleNameChange(e.target.value)} />
              {customerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 bg-surface-800 border border-surface-700 rounded-lg mt-1 overflow-hidden shadow-xl">
                  {customerSuggestions.map(c => (
                    <button key={c.id} onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-surface-700 text-sm">
                      <span className="text-white">{c.name}</span>
                      {c.mobile && <span className="text-slate-500 ml-2 font-mono text-xs">{c.mobile}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <Field label="Mobile">
            <input className="input" placeholder="Mobile (optional)"
              value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
          </Field>
        </div>

        {/* Device + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Device" required>
            <select className="input" value={form.device_id} onChange={e => handleDeviceChange(e.target.value)}>
              <option value="">Select device</option>
              {devices.filter(d => d.is_active).map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Duration" required>
            <select className="input" value={form.duration_mins}
              onChange={e => setForm(f => ({ ...f, duration_mins: Number(e.target.value) }))}>
              {DURATION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="Date">
            <input type="date" className="input" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label="Time In">
            <input type="time" className="input" value={form.time_in}
              onChange={e => setForm(f => ({ ...f, time_in: e.target.value }))} />
          </Field>
          <Field label="Time Out (auto)">
            <input type="time" className="input bg-surface-950 cursor-not-allowed"
              value={timeOut} readOnly />
          </Field>
        </div>

        {/* PC Controller */}
        {form.device_type === 'PC' && (
          <div className="bg-surface-800 rounded-xl p-4 border border-surface-700">
            <p className="font-display font-semibold text-white mb-3">🎮 Controller Add-on</p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-brand-500"
                  checked={pcControllers > 0}
                  onChange={e => setPcControllers(e.target.checked ? 1 : 0)} />
                <span className="text-slate-300 text-sm">Customer wants a controller?</span>
              </label>
              {pcControllers > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">How many?</span>
                  <select className="input w-20 py-1"
                    value={pcControllers}
                    onChange={e => setPcControllers(Number(e.target.value))}>
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="text-slate-400 text-sm font-mono">× {formatRupees(settings.controller_fee)} = {formatRupees(controllerTotal)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Console Players */}
        {isConsole && (
          <div className="bg-surface-800 rounded-xl p-4 border border-surface-700">
            <div className="flex items-center justify-between mb-3">
              <p className="font-display font-semibold text-white">👾 Players</p>
              <button onClick={addPlayer} className="btn-secondary text-xs py-1 px-3">+ Add Player</button>
            </div>
            <div className="space-y-2">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-surface-700 last:border-0">
                  <span className="text-slate-400 text-sm font-mono w-16">Player {i + 1}</span>
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input type="checkbox" className="w-4 h-4 accent-brand-500"
                      checked={p.own_controller}
                      onChange={() => toggleOwnController(i)} />
                    <span className="text-slate-300 text-sm">Own controller</span>
                  </label>
                  <div className="text-right text-xs font-mono text-slate-400">
                    {!p.own_controller && <span className="text-slate-300">+{formatRupees(settings.controller_fee)} ctrl</span>}
                    {i + 1 >= (settings.extra_person_from || 3) && (
                      <span className="text-yellow-400 ml-2">+{formatRupees(settings.extra_person_fee)} add-on</span>
                    )}
                  </div>
                  {players.length > 1 && (
                    <button onClick={() => removePlayer(i)} className="text-slate-600 hover:text-red-400 text-sm">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bill Summary */}
        {form.device_id && (
          <div className="bg-brand-950/50 border border-brand-800/50 rounded-xl p-4">
            <p className="font-display font-semibold text-brand-300 mb-2 text-sm tracking-wide uppercase">Bill Summary</p>
            <div className="space-y-1 text-sm font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Session ({formatDuration(form.duration_mins)} · {devices.find(d => d.id === Number(form.device_id))?.label})</span>
                <span>{formatRupees(charge)}</span>
              </div>
              {controllerTotal > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Controllers</span>
                  <span>{formatRupees(controllerTotal)}</span>
                </div>
              )}
              {extraPersonTotal > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Extra person add-on</span>
                  <span>{formatRupees(extraPersonTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold border-t border-brand-800/50 pt-1 mt-1">
                <span>Total</span>
                <span className="text-brand-400">{formatRupees(total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment + Remark */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment Received (₹)">
            <input type="number" className="input" placeholder="Leave blank if unpaid"
              value={form.payment_received}
              onChange={e => setForm(f => ({ ...f, payment_received: e.target.value }))} />
          </Field>
          <Field label="Remark">
            <input className="input" placeholder="Optional note"
              value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} />
          </Field>
        </div>

        {/* Credit display */}
        {form.payment_received !== '' && Number(form.payment_received) < total && (
          <div className="flex items-center gap-2">
            <span className="badge badge-red">
              Credit: {formatRupees(total - Number(form.payment_received))}
            </span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? <span className="flex items-center gap-2"><Spinner size="sm" /> Saving...</span> : 'Save Session'}
          </button>
          <button onClick={() => navigate('/sessions')} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

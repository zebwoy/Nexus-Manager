import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { DURATION_OPTIONS, formatRupees, todayISO, nowTimeInput, toISO, addMinutes, formatDuration, validateName, validateMobile, calculateDynamicTariff } from '../lib/helpers'
import { Field, ErrorMsg, Spinner, DateInput } from '../components/UI'
import DurationSelector from '../components/DurationSelector'
import { toast } from 'react-toastify'
import {
  Banknote, CreditCard, Smartphone, Moon,
  Gamepad2, Users, Plus, Minus, X, Receipt, CheckCircle2, Calendar, Coffee
} from 'lucide-react'

const DEVICE_TYPES = { PC: 'PC', XBOX: 'XBOX', PS: 'PS' }

export default function NewSession() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
    remark: '',
  })

  // Payment split
  const [cashAmount, setCashAmount] = useState('')
  const [onlineAmount, setOnlineAmount] = useState('')

  // PC controller state
  const [pcControllers, setPcControllers] = useState(0)

  // Console players state
  const [players, setPlayers] = useState([{ own_controller: false }])

  // Cafeteria / Refreshments state
  const [inventory, setInventory] = useState([])
  const [cafeCart, setCafeCart] = useState([])

  // Computed
  const [charge, setCharge] = useState(0)
  const [timeOut, setTimeOut] = useState('')

  useEffect(() => { loadSetup() }, [])

  const loadSetup = async () => {
    try {
      const [devData, priceData, settData, invData] = await Promise.all([
        api.get('/devices'),
        api.get('/pricing'),
        api.get('/settings'),
        api.get('/inventory').catch(() => ({ items: [] })),
      ])
      const devList = devData.devices || []
      setDevices(devList)
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
      setInventory((invData.items || []).filter(item => item.is_active !== false && item.stock_qty > 0))

      // Check for preselected device_id in query params
      const preDevId = searchParams.get('device_id')
      if (preDevId) {
        const dev = devList.find(d => d.id === Number(preDevId))
        if (dev) {
          setForm(f => ({ ...f, device_id: String(dev.id), device_type: dev.type }))
        }
      }
    } catch (err) { setError(err.message) }
  }

  // Recompute charge and time_out whenever relevant fields change
  useEffect(() => {
    if (!form.device_type) {
      setCharge(0)
    } else {
      const hourlyRate = Number(pricing[form.device_type]?.[60]) || (form.device_type === 'PC' ? 70 : form.device_type === 'XBOX' ? 100 : 120)
      const base = calculateDynamicTariff(hourlyRate, form.duration_mins)
      setCharge(base)
    }

    if (form.time_in && form.duration_mins) {
      const dt = new Date(`${form.date}T${form.time_in}`)
      const tout = addMinutes(dt, form.duration_mins)
      setTimeOut(tout.toTimeString().slice(0, 5))
    }
  }, [form.device_type, form.duration_mins, form.time_in, form.date, pricing])

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

  const cafeTotal = cafeCart.reduce((sum, i) => sum + i.sell_price * i.qty, 0)
  const total = charge + controllerTotal + extraPersonTotal + cafeTotal

  const addItemToCart = (item) => {
    setCafeCart(c => {
      const ex = c.find(i => i.id === item.id)
      if (ex) {
        if (ex.qty >= item.stock_qty) return c
        return c.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...c, { id: item.id, name: item.name, sell_price: Number(item.sell_price || 0), qty: 1, stock_qty: item.stock_qty }]
    })
  }

  const updateCartQty = (id, qty) => {
    if (qty <= 0) {
      setCafeCart(c => c.filter(i => i.id !== id))
    } else {
      setCafeCart(c => c.map(i => i.id === id ? { ...i, qty } : i))
    }
  }

  // Payment totals
  const cash   = cashAmount   !== '' ? Number(cashAmount)   : 0
  const online = onlineAmount !== '' ? Number(onlineAmount) : 0
  const totalPaid = cash + online
  const credit = Math.max(0, total - totalPaid)

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

  const [playerSuggestions, setPlayerSuggestions] = useState({})

  const addPlayer = () => setPlayers(p => [...p, { own_controller: false, player_name: '', customer_id: null }])
  const removePlayer = (i) => {
    setPlayers(p => p.filter((_, idx) => idx !== i))
    setPlayerSuggestions(p => {
      const copy = { ...p }
      delete copy[i]
      return copy
    })
  }
  const toggleOwnController = (i) => setPlayers(p => p.map((pl, idx) =>
    idx === i ? { ...pl, own_controller: !pl.own_controller } : pl
  ))

  const handlePlayerNameChange = async (i, val) => {
    setPlayers(p => p.map((pl, idx) => idx === i ? { ...pl, player_name: val, customer_id: null } : pl))
    if (val.trim().length >= 2) {
      try {
        const d = await api.get(`/customers?search=${encodeURIComponent(val.trim())}`)
        setPlayerSuggestions(p => ({ ...p, [i]: d.customers || [] }))
      } catch {
        setPlayerSuggestions(p => ({ ...p, [i]: [] }))
      }
    } else {
      setPlayerSuggestions(p => ({ ...p, [i]: [] }))
    }
  }

  const selectPlayerCustomer = (i, cust) => {
    setPlayers(p => p.map((pl, idx) => idx === i ? { ...pl, player_name: cust.name, customer_id: cust.id } : pl))
    setPlayerSuggestions(p => ({ ...p, [i]: [] }))
  }

  const isPredated = Boolean(form.date && form.date < todayISO())

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    setError('')
    if (!form.device_id) return setError('Device is required')
    if (form.name) {
      const nameErr = validateName(form.name)
      if (nameErr) return setError(nameErr)
    }
    if (form.mobile) {
      const mobileErr = validateMobile(form.mobile, false)
      if (mobileErr) return setError(mobileErr)
    }

    const hasSplit = cashAmount !== '' || onlineAmount !== ''
    if (hasSplit) {
      if (cash < 0 || online < 0) return setError('Payment amounts cannot be negative')
      if (totalPaid > total) return setError(`Total paid (₹${totalPaid}) cannot exceed total charge (₹${total})`)
    }

    try {
      setLoading(true)
      const startDt = new Date(`${form.date}T${form.time_in}`)
      const timeInISO = startDt.toISOString()
      const endDt = addMinutes(startDt, Number(form.duration_mins))
      const timeOutISO = endDt.toISOString()

      const playersPayload = isConsole
        ? players.map((p, i) => ({
            player_number: i + 1,
            player_name: i === 0 ? (form.name || p.player_name || null) : (p.player_name || null),
            customer_id: i === 0 ? (form.customer_id || p.customer_id || null) : (p.customer_id || null),
            own_controller: p.own_controller,
            controller_fee: p.own_controller ? 0 : settings.controller_fee,
            extra_person_fee: i + 1 >= (settings.extra_person_from || 3) ? settings.extra_person_fee : 0,
          }))
        : []

      const payload = {
        customer_id: form.customer_id,
        name: form.name || null,
        mobile: form.mobile || null,
        device_id: Number(form.device_id),
        duration_mins: Number(form.duration_mins),
        time_in: timeInISO,
        time_out: timeOutISO,
        date: form.date,
        charge,
        controller_total: controllerTotal,
        extra_person_total: extraPersonTotal,
        total,
        credit,
        remark: form.remark,
        players: playersPayload,
        items: cafeCart.map(i => ({ item_id: i.id, qty: i.qty, unit_price: i.sell_price })),
      }

      if (hasSplit) {
        payload.cash_amount   = cash
        payload.online_amount = online
      } else {
        payload.payment_received = 0
        payload.payment_method   = 'credit'
      }

      const res = await api.post('/sessions', payload)
      toast.success(isPredated ? `Backdated session #${res.id} recorded for ${form.date}` : `Session #${res.id} created`)
      navigate(`/sessions?date=${form.date}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isConsole = form.device_type === 'XBOX' || form.device_type === 'PS'

  // Detect post-midnight crossing for display
  const crossesMidnight = (() => {
    if (!form.time_in || !timeOut) return false
    const [h1] = form.time_in.split(':').map(Number)
    const [h2] = timeOut.split(':').map(Number)
    return h2 < h1
  })()

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">New Session</h1>
        <p className="page-sub">Start a new gaming session and assign station</p>
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
            <strong>Backdated Entry Mode:</strong> Recording historical session for <strong>{form.date}</strong>. This record will not occupy today&apos;s live station grid or alter today&apos;s cash drawer.
          </span>
        </div>
      )}

      <ErrorMsg error={error} />

      {/* 2-Column Responsive Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Left Column: Station & Players Configuration + Quick Refreshments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Main Session Configuration Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Row 1: Customer Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Customer Name">
              <div style={{ position: 'relative' }}>
                <input className="input" placeholder="Anonymous Client"
                  value={form.name} onChange={e => handleNameChange(e.target.value)} />
                {customerSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
                    boxShadow: 'var(--shadow-md)', borderRadius: '10px', marginTop: '0.45rem',
                    overflow: 'hidden'
                  }}>
                    {customerSuggestions.map(c => (
                      <button key={c.id} onClick={() => selectCustomer(c)}
                        className="btn-ghost"
                        style={{
                          width: '100%', textAlign: 'left', padding: '0.65rem 0.85rem',
                          fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between',
                          borderRadius: 0, borderBottom: '1px solid var(--border)'
                        }}>
                        <span>{c.name}</span>
                        {c.mobile && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.mobile}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <Field label="Mobile Phone (optional)">
              <input className="input" placeholder="e.g. 9876543210" maxLength={10}
                value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} />
            </Field>
          </div>

          {/* Row 2: Device Station & Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'flex-start' }}>
            <Field label="Device Station" required>
              <select className="input" value={form.device_id} onChange={e => handleDeviceChange(e.target.value)}>
                <option value="">Choose device terminal</option>
                {devices.filter(d => d.is_active).map(d => (
                  <option key={d.id} value={d.id}>{d.label} ({d.type})</option>
                ))}
              </select>
            </Field>
            <Field label="Session Duration">
              <DurationSelector
                value={form.duration_mins}
                onChange={mins => setForm(f => ({ ...f, duration_mins: mins }))}
                hourlyRate={form.device_type ? (pricing[form.device_type]?.[60] || (form.device_type === 'PC' ? 70 : form.device_type === 'XBOX' ? 100 : 120)) : null}
              />
            </Field>
          </div>

          {/* Row 3: Date & Access Times */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <Field label="Session Date">
              <DateInput
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                showTodayButton={true}
              />
            </Field>

            <Field label="Time In">
              <input type="time" className="input" value={form.time_in}
                onChange={e => setForm(f => ({ ...f, time_in: e.target.value }))} />
            </Field>
            <Field label={crossesMidnight ? 'Time Out (+1 day)' : 'Time Out'}>
              <input type="time" className="input" style={{ background: 'var(--bg-input)', cursor: 'default',
                ...(crossesMidnight ? { color: 'var(--warning)', fontWeight: 700 } : {}) }}
                value={timeOut} readOnly />
            </Field>
          </div>

          {crossesMidnight && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
              background: 'rgba(var(--warning-rgb, 234,179,8), 0.08)', border: '1px solid rgba(234,179,8,0.2)',
              borderRadius: '8px', fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600 }}>
              <Moon size={14} /> Post-midnight session — time-out will be recorded on the next calendar day
            </div>
          )}

          {/* Console Accessories Section */}
          {form.device_type === 'PC' && (
            <div className="card" style={{
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-inset)', padding: '1.15rem'
            }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 750, color: 'var(--text)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Gamepad2 size={15} style={{ color: 'var(--accent-text)' }} /> Hardware Controllers
              </p>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <input type="checkbox" style={{ cursor: 'pointer' }}
                    checked={pcControllers > 0}
                    onChange={e => setPcControllers(e.target.checked ? 1 : 0)} />
                  <span>Requires external PC controllers?</span>
                </label>
                {pcControllers > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Qty:</span>
                    <select className="input" style={{ width: '4.5rem', padding: '0.25rem 0.5rem' }}
                      value={pcControllers}
                      onChange={e => setPcControllers(Number(e.target.value))}>
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 550, fontFamily: "'JetBrains Mono', monospace" }}>
                      × {formatRupees(settings.controller_fee)} = {formatRupees(controllerTotal)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Console Players Allocations list */}
          {isConsole && (
            <div className="card" style={{
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-inset)', padding: '1.15rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 750, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Users size={15} style={{ color: 'var(--accent-text)' }} /> Console Players &amp; Controller Allocation
                  </p>
                  <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                    Tag co-players for loyalty tracking or leave as guest
                  </p>
                </div>
                {players.length < 4 && (
                  <button type="button" onClick={addPlayer} className="btn-secondary btn-sm" style={{ padding: '0.25rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Plus size={12} strokeWidth={2.5} /> Add Player
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {players.map((p, i) => {
                  const isHost = i === 0
                  const suggestions = playerSuggestions[i] || []

                  return (
                    <div key={i} style={{
                      display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem 0.85rem',
                      background: isHost ? 'rgba(var(--accent-rgb, 59,130,246), 0.04)' : 'var(--bg-card)',
                      border: isHost ? '1.5px solid var(--accent-border)' : '1px solid var(--border)',
                      borderRadius: '10px', boxShadow: 'var(--shadow)'
                    }}>
                      {/* Top Bar: Player Label + Fee breakdown + Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          fontSize: '0.775rem', fontWeight: 800, color: isHost ? 'var(--accent-text)' : 'var(--text)',
                          whiteSpace: 'nowrap'
                        }}>
                          <span>{isHost ? '👑' : '🎮'}</span>
                          <span>{isHost ? 'Player 1 (Host)' : `Player ${i + 1}`}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            fontSize: '0.725rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-faint)'
                          }}>
                            {!p.own_controller && (
                              <span style={{ color: 'var(--text-muted)' }}>+{formatRupees(settings.controller_fee)} controller</span>
                            )}
                            {i + 1 >= (settings.extra_person_from || 3) && (
                              <span className="badge badge-warning" style={{ fontSize: '0.625rem', padding: '0.1rem 0.4rem' }}>
                                +{formatRupees(settings.extra_person_fee)} seat
                              </span>
                            )}
                          </div>

                          {!isHost && (
                            <button
                              type="button"
                              onClick={() => removePlayer(i)}
                              className="btn-secondary btn-icon"
                              style={{ width: '1.4rem', height: '1.4rem', padding: 0, borderRadius: '50%' }}
                              title="Remove player"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bottom Bar: Name Input + Own Controller Checkbox */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          {isHost ? (
                            <div style={{
                              height: '38px', display: 'flex', alignItems: 'center',
                              fontSize: '0.8125rem', fontWeight: 650, color: 'var(--text)',
                              background: 'var(--bg-elevated)', padding: '0 0.75rem',
                              borderRadius: '6px', border: '1px dashed var(--border)'
                            }}>
                              {form.name ? form.name : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Primary Customer</span>}
                            </div>
                          ) : (
                            <>
                              <input
                                className="input"
                                style={{ height: '38px', padding: '0 0.75rem', fontSize: '0.8125rem' }}
                                placeholder={`e.g. Player ${i + 1} Name / Friend`}
                                value={p.player_name || ''}
                                onChange={e => handlePlayerNameChange(i, e.target.value)}
                                autoComplete="off"
                              />
                              {suggestions.length > 0 && (
                                <div style={{
                                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
                                  background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                                  boxShadow: '0 8px 20px rgba(0,0,0,0.35)', borderRadius: '8px',
                                  maxHeight: '160px', overflowY: 'auto'
                                }}>
                                  {suggestions.map(c => (
                                    <div
                                      key={c.id}
                                      onClick={() => selectPlayerCustomer(i, c)}
                                      style={{
                                        padding: '0.45rem 0.65rem', cursor: 'pointer',
                                        fontSize: '0.8rem', borderBottom: '1px solid var(--border)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{c.name}</span>
                                      {c.mobile && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.mobile}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <label style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                          cursor: 'pointer', fontSize: '0.775rem', color: 'var(--text-muted)',
                          fontWeight: 600, flexShrink: 0, height: '38px', padding: '0 0.5rem',
                          borderRadius: '6px', background: p.own_controller ? 'var(--bg-elevated)' : 'transparent',
                          border: p.own_controller ? '1px solid var(--border)' : '1px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            style={{ cursor: 'pointer' }}
                            checked={p.own_controller}
                            onChange={() => toggleOwnController(i)}
                          />
                          <span style={{ whiteSpace: 'nowrap' }}>Own controller</span>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          </div>

          {/* Standalone Quick Refreshments & Snacks Card */}
          <div className="card" style={{
            display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.9rem 1.15rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.825rem', fontWeight: 750, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
                  <Coffee size={14} style={{ color: 'var(--accent-text)' }} /> Quick Refreshments &amp; Snacks
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                  Optional drinks or snacks to attach to check-in invoice
                </p>
              </div>
              {cafeCart.length > 0 && (
                <span className="badge badge-accent" style={{ fontSize: '0.68rem', fontWeight: 750 }}>
                  {cafeCart.reduce((sum, i) => sum + i.qty, 0)} items ({formatRupees(cafeTotal)})
                </span>
              )}
            </div>

            <div style={{
              display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.2rem'
            }}>
              {inventory.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>No inventory items currently in stock</span>
              ) : (
                inventory.map(item => {
                  const inCart = cafeCart.find(i => i.id === item.id)
                  const qty = inCart?.qty || 0
                  const isDrink = item.name.toLowerCase().includes('drink') || item.name.toLowerCase().includes('water') || item.name.toLowerCase().includes('bull') || item.name.toLowerCase().includes('monster') || item.name.toLowerCase().includes('sting') || item.name.toLowerCase().includes('coffee') || item.name.toLowerCase().includes('tea') || item.name.toLowerCase().includes('cola') || item.name.toLowerCase().includes('lahori')

                  return (
                    <div
                      key={item.id}
                      style={{
                        flex: '0 0 130px',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        padding: '0.55rem 0.65rem', borderRadius: '8px',
                        background: qty > 0 ? 'rgba(var(--accent-rgb, 59,130,246), 0.06)' : 'var(--bg-input)',
                        border: qty > 0 ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '1rem' }}>{isDrink ? '🥤' : '🍿'}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {item.stock_qty} left
                          </span>
                        </div>
                        <p style={{
                          fontSize: '0.75rem', fontWeight: 750, color: 'var(--text)',
                          lineHeight: 1.2, marginBottom: '0.15rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }} title={item.name}>
                          {item.name}
                        </p>
                        <p style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--accent-text)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatRupees(item.sell_price)}
                        </p>
                      </div>

                      <div style={{ marginTop: '0.45rem' }}>
                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => addItemToCart(item)}
                            className="btn-secondary btn-sm"
                            style={{
                              width: '100%', padding: '0.2rem 0.4rem', fontSize: '0.7rem',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem'
                            }}
                          >
                            <Plus size={11} /> Add
                          </button>
                        ) : (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'var(--bg-elevated)', borderRadius: '5px', border: '1px solid var(--accent-border)',
                            padding: '0.1rem 0.2rem'
                          }}>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, qty - 1)}
                              style={{
                                width: '1.25rem', height: '1.25rem', borderRadius: '3px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                color: 'var(--text)', cursor: 'pointer'
                              }}
                            >
                              <Minus size={10} />
                            </button>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-text)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, qty + 1)}
                              disabled={qty >= item.stock_qty}
                              style={{
                                width: '1.25rem', height: '1.25rem', borderRadius: '3px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                color: 'var(--text)', cursor: qty >= item.stock_qty ? 'not-allowed' : 'pointer',
                                opacity: qty >= item.stock_qty ? 0.35 : 1
                              }}
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Billing, Payment & Checkout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Computed Invoice Card */}
          <div className="card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: 'var(--shadow)'
          }}>
            <p style={{
              fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem',
              borderBottom: '1px dashed var(--border)', paddingBottom: '0.4rem',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
              <Receipt size={14} /> Computed Session Invoice
            </p>

            {(form.device_id || cafeCart.length > 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
                {form.device_id && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Seat Charge ({formatDuration(form.duration_mins)} · {devices.find(d => d.id === Number(form.device_id))?.label})</span>
                    <span style={{ color: 'var(--text)' }}>{formatRupees(charge)}</span>
                  </div>
                )}
                
                {controllerTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Controller Rentals</span>
                    <span style={{ color: 'var(--text)' }}>{formatRupees(controllerTotal)}</span>
                  </div>
                )}
                
                {extraPersonTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Additional Seat Allocations</span>
                    <span style={{ color: 'var(--text)' }}>{formatRupees(extraPersonTotal)}</span>
                  </div>
                )}

                {cafeCart.length > 0 && (
                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.45rem', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Refreshments &amp; Snacks</span>
                    {cafeCart.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                        <span>{item.name} ×{item.qty}</span>
                        <span style={{ color: 'var(--text)' }}>{formatRupees(item.sell_price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div style={{
                  display: 'flex', justifyContent: 'space-between', fontWeight: 800,
                  borderTop: '1px dashed var(--border)', paddingTop: '0.65rem', marginTop: '0.35rem',
                  fontSize: '1rem'
                }}>
                  <span style={{ color: 'var(--text)' }}>TOTAL ESTIMATED BILL</span>
                  <span style={{ color: 'var(--accent-text)', textShadow: '0 0 8px var(--accent-dim)' }}>{formatRupees(total)}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '1.25rem 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.8125rem' }}>
                Select a station terminal or refreshments to view live billing estimate
              </div>
            )}
          </div>

          {/* Payment & Checkout Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Payment Collection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p className="label" style={{ marginBottom: 0, fontWeight: 750, color: 'var(--text)' }}>
                Payment Collection (Optional at check-in)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Field label="Cash Received (₹)">
                  <div style={{ position: 'relative' }}>
                    <Banknote size={13} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
                    <input type="number" className="input" placeholder="0"
                      style={{ paddingLeft: '2rem' }}
                      value={cashAmount}
                      onChange={e => setCashAmount(e.target.value)} />
                  </div>
                </Field>
                <Field label="Online Received (₹)">
                  <div style={{ position: 'relative' }}>
                    <Smartphone size={13} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
                    <input type="number" className="input" placeholder="0"
                      style={{ paddingLeft: '2rem' }}
                      value={onlineAmount}
                      onChange={e => setOnlineAmount(e.target.value)} />
                  </div>
                </Field>
              </div>

              {/* Payment summary strip */}
              {(cashAmount !== '' || onlineAmount !== '') && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {cash > 0 && <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>Cash: {formatRupees(cash)}</span>}
                  {online > 0 && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Online: {formatRupees(online)}</span>}
                  {totalPaid > 0 && total > 0 && (
                    credit > 0
                      ? <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Outstanding: {formatRupees(credit)}</span>
                      : <span className="badge badge-success" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={11} /> Fully Paid</span>
                  )}
                </div>
              )}
            </div>

            {/* Remark */}
            <Field label="Session Notes / Remarks">
              <input className="input" placeholder="e.g. Extra controller, LAN tournament, specific game note..."
                value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} />
            </Field>

            {/* Action Controls */}
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1.5px solid var(--border)' }}>
              <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ flex: 1, padding: '0.65rem 1.25rem' }}>
                {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Spinner size="sm" /> Starting...</span> : 'Start Session'}
              </button>
              <button onClick={() => navigate('/sessions')} className="btn-secondary" style={{ padding: '0.65rem 1.25rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

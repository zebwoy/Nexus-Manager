import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatTime, formatDate, formatDuration, todayISO, validateName, validateMobile, toISO, addMinutes } from '../lib/helpers'
import { PageLoader, ErrorMsg, Field, Modal, Spinner } from '../components/UI'
import { ArrowLeft, Plus, Minus, CreditCard, Banknote, Clock, ShoppingCart, History, ChevronRight, Edit3 } from 'lucide-react'


// ─── Payment method toggle ────────────────────────────────────
function PayMethodToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {['cash', 'online'].map(m => (
        <button key={m} onClick={() => onChange(m)}
          style={{
            padding: '0.4rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
            border: `1.5px solid ${value === m ? 'var(--accent)' : 'var(--border)'}`,
            background: value === m ? 'var(--accent-dim)' : 'var(--bg-input)',
            color: value === m ? 'var(--accent-text)' : 'var(--text-muted)',
            fontWeight: 650, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
            transition: 'all 0.15s'
          }}>
          {m === 'cash' ? <Banknote size={13} /> : <CreditCard size={13} />}
          {m === 'cash' ? 'Cash' : 'Online'}
        </button>
      ))}
    </div>
  )
}

// ─── Live countdown ───────────────────────────────────────────
function Countdown({ timeOut }) {
  const [remaining, setRemaining] = useState('')
  const [isOverdue, setIsOverdue] = useState(false)
  useEffect(() => {
    const tick = () => {
      const diff = new Date(timeOut) - new Date()
      if (diff <= 0) { setRemaining('Session overdue'); setIsOverdue(true); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(`${h > 0 ? `${h}h ` : ''}${m}m ${s}s remaining`)
      setIsOverdue(false)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timeOut])
  return (
    <span style={{
      fontSize: '0.8125rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
      color: isOverdue ? 'var(--danger)' : 'var(--success)',
      animation: isOverdue ? 'pulse 1s infinite' : 'none'
    }}>
      {remaining}
    </span>
  )
}

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Cart for adding items
  const [cart, setCart] = useState([])
  const [cartPayNow, setCartPayNow] = useState(false)
  const [cartPayMethod, setCartPayMethod] = useState('cash')
  const [cartSaving, setCartSaving] = useState(false)

  // Payment collection
  const [collectAmount, setCollectAmount] = useState('')
  const [collectMethod, setCollectMethod] = useState('cash')
  const [collectSaving, setCollectSaving] = useState(false)

  // Extension
  const [extMins, setExtMins] = useState(30)
  const [extSaving, setExtSaving] = useState(false)
  const [extResult, setExtResult] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [detail, inv] = await Promise.all([
        api.get(`/sessions/${id}`),
        api.get('/inventory'),
      ])
      setData(detail)
      setInventory(inv.items || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  // Edit details modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', mobile: '', time_in: '', duration_mins: 60, remark: '' })
  const [editSaving, setEditSaving] = useState(false)

  const openEditModal = () => {
    if (!s) return
    const timeInStr = s.time_in ? new Date(s.time_in).toTimeString().slice(0, 5) : '12:00'
    setEditForm({
      name: s.name || '',
      mobile: s.mobile || '',
      time_in: timeInStr,
      duration_mins: s.duration_mins || 60,
      remark: s.remark || '',
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    const nameErr = validateName(editForm.name)
    if (nameErr) { setError(nameErr); return }
    const mobileErr = validateMobile(editForm.mobile, true)
    if (mobileErr) { setError(mobileErr); return }

    setEditSaving(true)
    setError('')
    try {
      const timeInISO = toISO(s.date, editForm.time_in)
      const timeOutISO = addMinutes(timeInISO, s.duration_mins).toISOString()

      await api.patch(`/sessions/${id}`, {
        name: editForm.name,
        mobile: editForm.mobile,
        time_in: timeInISO,
        time_out: timeOutISO,
      })
      setShowEditModal(false)
      showToast('Session details updated ✓')
      load()
    } catch (e) { setError(e.message) }
    finally { setEditSaving(false) }
  }

  if (loading) return <PageLoader />
  if (!data) return <ErrorMsg error={error || 'Session not found'} />

  const { session: s, players, payments } = data

  const isActive = s.time_out && new Date(s.time_out) > new Date()
  const cafeTotal = data.sales?.reduce((sum, sa) => sum + Number(sa.total), 0) || 0
  const grandTotal = Number(s.total) + cafeTotal
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const creditRemaining = Math.max(0, grandTotal - totalPaid)

  // --- Compute extension preview ---
  const currentEnd = s.time_out ? new Date(s.time_out) : new Date()
  const newEnd = addMinutes(currentEnd, extMins)
  const newEndTimeStr = newEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const perMinRate = Number(s.charge) / Number(s.duration_mins || 60)
  const extCharge = perMinRate * extMins
  const newOutstanding = creditRemaining + extCharge

  // --- Cart helpers ---
  const addToCart = (item) => setCart(c => {
    const ex = c.find(i => i.id === item.id)
    if (ex) return c.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
    return [...c, { ...item, qty: 1 }]
  })
  const updateCartQty = (id, qty) => {
    if (qty <= 0) setCart(c => c.filter(i => i.id !== id))
    else setCart(c => c.map(i => i.id === id ? { ...i, qty } : i))
  }
  const cartTotal = cart.reduce((sum, i) => sum + i.sell_price * i.qty, 0)

  const handleAddItems = async () => {
    if (!cart.length) return
    setCartSaving(true)
    try {
      await api.post('/sales', {
        session_id: Number(id), sale_type: 'session',
        date: todayISO(), total: cartTotal,
        payment_received: cartPayNow ? cartTotal : 0,
        payment_method: cartPayNow ? cartPayMethod : 'cash',
        items: cart.map(i => ({ item_id: i.id, qty: i.qty, unit_price: i.sell_price }))
      })
      if (cartPayNow) {
        await api.post(`/sessions/${id}/payments`, {
          amount: cartTotal,
          payment_method: cartPayMethod,
          note: `Paid for cafe items: ${cart.map(i => `${i.name} x${i.qty}`).join(', ')}`
        })
      }
      setCart([])
      setCartPayNow(false)
      showToast('Items added to session ✓')
      load()
    } catch (e) { setError(e.message) }
    finally { setCartSaving(false) }
  }

  const handleCollect = async () => {
    if (!collectAmount || Number(collectAmount) <= 0) {
      setError('Enter a valid amount')
      return
    }
    setCollectSaving(true)
    try {
      await api.post(`/sessions/${id}/payments`, {
        amount: Number(collectAmount),
        payment_method: collectMethod,
        note: null,
      })
      setCollectAmount('')
      showToast('Payment recorded ✓')
      load()
    } catch (e) { setError(e.message) }
    finally { setCollectSaving(false) }
  }

  const handleExtend = async () => {
    setExtSaving(true)
    setExtResult(null)
    try {
      const res = await api.patch(`/sessions/${id}/extend`, {
        packets: extMins / 30,
        collect_now: 0,
      })
      setExtResult(res)
      showToast(`Session extended by ${extMins} mins ✓`)
      load()
    } catch (e) { setError(e.message) }
    finally { setExtSaving(false) }
  }

  const sectionCard = (title, icon, children) => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{
        fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem',
        display: 'flex', alignItems: 'center', gap: '0.5rem'
      }}>{icon} {title}</p>
      {children}
    </div>
  )

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 100,
          background: 'var(--success)', color: '#fff',
          padding: '0.65rem 1.25rem', borderRadius: '12px',
          fontWeight: 700, fontSize: '0.875rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          animation: 'slideDown 0.2s ease'
        }}>{toast}</div>
      )}

      {/* Edit Details Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Session Details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <Field label="Customer Full Name (First & Last Name)" required>
            <input className="input" value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" />
          </Field>

          <Field label="Mobile Number (10 Digits)" required>
            <input className="input" value={editForm.mobile}
              onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} placeholder="9876543210" maxLength={10} />
          </Field>

          <Field label="Time In">
            <input type="time" className="input" value={editForm.time_in}
              onChange={e => setEditForm(f => ({ ...f, time_in: e.target.value }))} />
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <button onClick={handleSaveEdit} disabled={editSaving} className="btn-primary" style={{ flex: 1 }}>
              {editSaving ? <><Spinner size="sm" /> Saving...</> : 'Save Changes'}
            </button>
            <button onClick={() => setShowEditModal(false)} className="btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <button onClick={() => navigate('/sessions')} className="btn-secondary btn-sm"
              style={{ padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ArrowLeft size={13} /> Back
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>
              SESSION #{s.id}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="page-title" style={{ marginBottom: '0.15rem' }}>
              {s.name || 'Anonymous Client'}
            </h1>
            <button onClick={openEditModal} className="btn-secondary btn-sm"
              style={{ padding: '0.25rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <Edit3 size={13} /> Edit Details
            </button>
          </div>
          <p className="page-sub">
            {s.device_label} · {formatDate(s.date)} · {formatTime(s.time_in)} → {formatTime(s.time_out)}
            {s.mobile && <span style={{ marginLeft: '0.5rem', fontFamily: "'JetBrains Mono', monospace" }}>· {s.mobile}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          {isActive
            ? <><span className="badge-active-session animate-pulse">ACTIVE</span><Countdown timeOut={s.time_out} /></>
            : <span className="badge badge-warning">COMPLETED</span>}
        </div>
      </div>


      <ErrorMsg error={error} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>

        {/* ─── LEFT COLUMN ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Bill summary */}
          {sectionCard('Session Invoice', '📊', (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
              <BillRow label={`Seat Charge (${formatDuration(s.duration_mins)} · ${s.device_label})`} value={s.charge} />
              {Number(s.controller_total) > 0 && <BillRow label="Controller Rentals" value={s.controller_total} />}
              {Number(s.extra_person_total) > 0 && <BillRow label="Extra Seat Fees" value={s.extra_person_total} />}

              {/* Attached item sales */}
              {data.sales?.map((sale, i) => (
                sale.items?.map((item, j) => (
                  <BillRow key={`${i}-${j}`}
                    label={`${item.name} ×${item.qty}`}
                    value={item.unit_price * item.qty}
                    muted />
                ))
              ))}

              <div style={{ borderTop: '1.5px dashed var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <BillRow label="TOTAL BILL" value={Number(s.total) + (data.sales?.reduce((sum, sa) => sum + Number(sa.total), 0) || 0)} bold accent />
              </div>
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }}>
                <BillRow label="Total Collected" value={totalPaid} />
                {creditRemaining > 0
                  ? <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>OUTSTANDING</span>
                      <span className="badge badge-danger">{formatRupees(creditRemaining)}</span>
                    </div>
                  : <div style={{ color: 'var(--success)', fontWeight: 700, textAlign: 'right', fontSize: '0.75rem' }}>✓ Fully Paid</div>}
              </div>
              {s.remark && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Note: {s.remark}
                </div>
              )}
            </div>
          ))}

          {/* Add cafe items */}
          {sectionCard('Add Cafe Items', <ShoppingCart size={14} />, (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Product grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
                {inventory.filter(i => i.stock_qty > 0).map(item => {
                  const inCart = cart.find(c => c.id === item.id)
                  return (
                    <button key={item.id} onClick={() => addToCart(item)}
                      className="card"
                      style={{
                        padding: '0.75rem', cursor: 'pointer', textAlign: 'left',
                        border: inCart ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        background: inCart ? 'var(--accent-dim)' : 'var(--bg-card)'
                      }}>
                      <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem' }}>{item.name}</p>
                      <p style={{ fontSize: '0.8rem', fontWeight: 750, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent-text)' }}>
                        {formatRupees(item.sell_price)}
                      </p>
                      {inCart && (
                        <span className="badge badge-accent" style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>×{inCart.qty}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Cart summary */}
              {cart.length > 0 && (
                <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '0.85rem', border: '1px solid var(--border)' }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 650, color: 'var(--text)' }}>{item.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button onClick={() => updateCartQty(item.id, item.qty - 1)} className="btn-secondary btn-icon"
                          style={{ width: '1.35rem', height: '1.35rem', borderRadius: '4px', padding: 0 }}><Minus size={10} /></button>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.8rem', minWidth: '1rem', textAlign: 'center' }}>{item.qty}</span>
                        <button onClick={() => updateCartQty(item.id, item.qty + 1)} className="btn-secondary btn-icon"
                          style={{ width: '1.35rem', height: '1.35rem', borderRadius: '4px', padding: 0 }}><Plus size={10} /></button>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '3rem', textAlign: 'right' }}>
                          {formatRupees(item.sell_price * item.qty)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.6rem', display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)' }}>Cart Total</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: 'var(--accent-text)' }}>{formatRupees(cartTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="label" style={{ marginBottom: 0 }}>Payment Status</span>
                      <select className="input" style={{ width: 'auto', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                        value={cartPayNow ? 'pay_now' : 'add_bill'} onChange={e => setCartPayNow(e.target.value === 'pay_now')}>
                        <option value="add_bill">Add to Session Bill</option>
                        <option value="pay_now">Collect Payment Now</option>
                      </select>
                    </div>
                    {cartPayNow && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="label" style={{ marginBottom: 0 }}>Pay Method</span>
                        <PayMethodToggle value={cartPayMethod} onChange={setCartPayMethod} />
                      </div>
                    )}
                  </div>
                  <button onClick={handleAddItems} disabled={cartSaving} className="btn-primary" style={{ width: '100%', marginTop: '0.75rem' }}>
                    {cartSaving ? <><Spinner size="sm" /> Adding...</> : `Add to Session — ${formatRupees(cartTotal)}`}
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Payment history */}
          {payments.length > 0 && sectionCard('Payment History', <History size={14} />, (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {payments.map((p, i) => (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.55rem 0.75rem', borderRadius: '8px',
                  background: i % 2 === 0 ? 'var(--bg-input)' : 'transparent',
                  fontSize: '0.8125rem'
                }}>
                  <div>
                    <span style={{ fontWeight: 650, color: 'var(--text)' }}>{formatRupees(p.amount)}</span>
                    <span className={`badge ${p.payment_method === 'cash' ? 'badge-accent' : 'badge-warning'}`}
                      style={{ fontSize: '0.6rem', marginLeft: '0.5rem' }}>
                      {p.payment_method}
                    </span>
                    {p.note && <span style={{ color: 'var(--text-faint)', marginLeft: '0.5rem' }}>— {p.note}</span>}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem', fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatTime(p.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Collect payment */}
          {sectionCard('Collect Payment', <Banknote size={14} />, (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {creditRemaining > 0 && (
                <div style={{
                  padding: '0.65rem 1rem', borderRadius: '10px',
                  background: 'rgba(var(--danger-rgb, 220,38,38), 0.08)',
                  border: '1px solid rgba(var(--danger-rgb, 220,38,38), 0.2)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 650 }}>Balance due</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: 'var(--danger)' }}>
                    {formatRupees(creditRemaining)}
                  </span>
                </div>
              )}
              <Field label="Amount to Collect (₹)">
                <input type="number" className="input" placeholder={creditRemaining || 'Enter amount'}
                  value={collectAmount} onChange={e => setCollectAmount(e.target.value)} />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="label" style={{ marginBottom: 0 }}>Payment Method</span>
                <PayMethodToggle value={collectMethod} onChange={setCollectMethod} />
              </div>
              <button onClick={handleCollect} disabled={collectSaving} className="btn-primary"
                style={{ padding: '0.65rem 1.25rem' }}>
                {collectSaving ? <><Spinner size="sm" /> Recording...</> : 'Record Payment'}
              </button>
            </div>
          ))}

          {/* Extend session */}
          {isActive && sectionCard('Extend Session', <Clock size={14} />, (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setExtMins(30)}
                  className={extMins === 30 ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                  + 30 Mins
                </button>
                <button onClick={() => setExtMins(60)}
                  className={extMins === 60 ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                  + 1 Hour
                </button>
              </div>

              <div style={{
                padding: '0.75rem 1rem', borderRadius: '12px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: '0.5rem',
                fontSize: '0.8125rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Extend Until</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)' }}>
                    {newEndTimeStr}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Extension Cost</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--accent-text)' }}>
                    {formatRupees(extCharge)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 650 }}>New Balance Due</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: 'var(--danger)' }}>
                    {formatRupees(newOutstanding)}
                  </span>
                </div>
              </div>

              <button onClick={handleExtend} disabled={extSaving} className="btn-primary"
                style={{ padding: '0.65rem 1.25rem' }}>
                {extSaving ? <><Spinner size="sm" /> Extending...</> : `Confirm Extension`}
              </button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

function BillRow({ label, value, bold, accent, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontWeight: bold ? 800 : muted ? 500 : 600,
      fontSize: bold ? '0.95rem' : '0.8125rem',
      color: muted ? 'var(--text-faint)' : 'var(--text-muted)' }}>
      <span>{label}</span>
      <span style={{ color: accent ? 'var(--accent-text)' : muted ? 'var(--text-faint)' : 'var(--text)', fontWeight: bold ? 800 : 650 }}>
        {formatRupees(value)}
      </span>
    </div>
  )
}

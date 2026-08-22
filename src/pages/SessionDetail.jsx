import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatRupees, formatTime, formatDate, formatDuration, todayISO, validateName, validateMobile, toISO, addMinutes, showUndoToast } from '../lib/helpers'
import { PageLoader, ErrorMsg, Field, Modal, Spinner, SlidePanel, PanelSection, ConfirmModal, FilterBar } from '../components/UI'
import {
  ArrowLeft, Plus, Minus, CreditCard, Banknote, Clock,
  ShoppingCart, History, Edit3, Trash2, SlidersHorizontal,
  Share2, Printer, ArrowRightLeft, PowerOff, CheckCircle,
  Coffee, Receipt, Users, CheckCircle2
} from 'lucide-react'
import { toast } from 'react-toastify'

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
  const { isAdmin } = useAuth()

  const [data, setData] = useState(null)
  const [devices, setDevices] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cart for adding items
  const [cart, setCart] = useState([])
  const [cartPayNow, setCartPayNow] = useState(false)
  const [cartPayMethod, setCartPayMethod] = useState('cash')
  const [cartSaving, setCartSaving] = useState(false)

  // Payment collection
  const [collectAmount, setCollectAmount] = useState('')
  const [collectOnline, setCollectOnline] = useState('')
  const [collectSaving, setCollectSaving] = useState(false)

  // Extension
  const [extMins, setExtMins] = useState(30)
  const [extSaving, setExtSaving] = useState(false)

  // Right slide panel
  const [panelOpen, setPanelOpen] = useState(false)

  // Modals
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', mobile: '', time_in: '', remark: '' })
  const [editSaving, setEditSaving] = useState(false)

  // End Early modal
  const [showEndEarlyModal, setShowEndEarlyModal] = useState(false)
  const [recalcBill, setRecalcBill] = useState(true)
  const [endEarlySaving, setEndEarlySaving] = useState(false)

  // Thermal Receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  // Dynamic Cafe / Organization Name
  const [cafeName, setCafeName] = useState(() => localStorage.getItem('nexus_tenant_name') || 'Headshot Gaming Lounge')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [detail, inv, devR, setR] = await Promise.all([
        api.get(`/sessions/${id}`),
        api.get('/inventory'),
        api.get('/devices'),
        api.get('/settings').catch(() => ({ settings: [] })),
      ])
      setData(detail)
      setInventory(inv.items || [])
      setDevices(devR.devices || [])
      const nameSetting = setR.settings?.find(s => s.key === 'cafe_name')?.value
      if (nameSetting) {
        setCafeName(nameSetting)
        localStorage.setItem('nexus_tenant_name', nameSetting)
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])


  const openEditModal = () => {
    if (!data?.session) return
    const s = data.session
    const timeInStr = s.time_in ? new Date(s.time_in).toTimeString().slice(0, 5) : '12:00'
    setEditForm({
      name: s.name || '',
      mobile: s.mobile || '',
      device_id: String(s.device_id || ''),
      time_in: timeInStr,
      remark: s.remark || '',
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    const s = data?.session
    if (!s) return
    if (editForm.name) {
      const nameErr = validateName(editForm.name)
      if (nameErr) { setError(nameErr); return }
    }
    const mobileErr = validateMobile(editForm.mobile, false)
    if (mobileErr) { setError(mobileErr); return }

    setEditSaving(true)
    setError('')
    try {
      const cleanDate = typeof s.date === 'string' ? s.date.slice(0, 10) : todayISO()
      const timeInISO = toISO(cleanDate, editForm.time_in)
      const timeOutISO = addMinutes(timeInISO, Number(s.duration_mins || 60)).toISOString()

      await api.patch(`/sessions/${id}`, {
        name: editForm.name.trim(),
        mobile: editForm.mobile ? editForm.mobile.trim() : null,
        device_id: editForm.device_id ? Number(editForm.device_id) : s.device_id,
        time_in: timeInISO,
        time_out: timeOutISO,
        remark: editForm.remark,
      })
      setShowEditModal(false)
      toast.success('Session details updated')
      load()
    } catch (e) { setError(e.message) }
    finally { setEditSaving(false) }
  }


  const handleEndEarly = async () => {
    setEndEarlySaving(true)
    try {
      await api.patch(`/sessions/${id}/end-early`, {
        recalculate: recalcBill
      })
      setShowEndEarlyModal(false)
      toast.success('Session checkout complete! Station released.')
      load()
    } catch (e) {
      toast.error('Failed to end session: ' + e.message)
    } finally {
      setEndEarlySaving(false)
    }
  }

  const handleSwitchStation = async () => {
    if (!targetDevice) return
    setSwitchSaving(true)
    try {
      await api.patch(`/sessions/${id}/switch-station`, {
        new_device_id: Number(targetDevice)
      })
      setShowSwitchModal(false)
      toast.success('Gamer transferred to new station')
      load()
    } catch (e) {
      toast.error('Failed to switch station: ' + e.message)
    } finally {
      setSwitchSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/sessions?id=${id}`)
      showUndoToast({
        message: `Deleted session #${id}`,
        onUndo: async () => {
          try {
            await api.post(`/sessions?action=restore&id=${id}`)
            toast.success(`Restored session #${id}`)
          } catch (err) {
            toast.error('Failed to restore session: ' + err.message)
          }
        }
      })
      navigate('/sessions')
    } catch (e) {
      setError(e.message)
      setShowDelete(false)
    } finally { setDeleting(false) }
  }

  if (loading) return <PageLoader />
  if (!data) return <ErrorMsg error={error || 'Session not found'} />

  const { session: s, players, payments } = data

  const isActive = s.time_out && new Date(s.time_out) > new Date()
  const cafeTotal = data.sales?.reduce((sum, sa) => sum + Number(sa.total), 0) || 0
  const grandTotal = Number(s.total) + cafeTotal
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const creditRemaining = Math.max(0, grandTotal - totalPaid)

  // Extension preview
  const currentEnd = s.time_out ? new Date(s.time_out) : new Date()
  const newEnd = addMinutes(currentEnd, extMins)
  const newEndTimeStr = newEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const perMinRate = Number(s.charge) / Number(s.duration_mins || 60)
  const extCharge = perMinRate * extMins
  const newOutstanding = creditRemaining + extCharge

  // Cart helpers
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
      toast.success('Cafe items added to session')
      load()
    } catch (e) { setError(e.message) }
    finally { setCartSaving(false) }
  }

  const handleCollect = async () => {
    const cashAmt = Number(collectAmount || 0)
    const onlineAmt = Number(collectOnline || 0)
    const totalCollecting = cashAmt + onlineAmt
    if (totalCollecting <= 0) { setError('Enter a valid amount to collect'); return }
    setCollectSaving(true)
    try {
      if (cashAmt > 0) {
        await api.post(`/sessions/${id}/payments`, { amount: cashAmt, payment_method: 'cash' })
      }
      if (onlineAmt > 0) {
        await api.post(`/sessions/${id}/payments`, { amount: onlineAmt, payment_method: 'online' })
      }
      setCollectAmount('')
      setCollectOnline('')
      toast.success(`Collected ${formatRupees(totalCollecting)} successfully`)
      load()
    } catch (e) { setError(e.message) }
    finally { setCollectSaving(false) }
  }

  const handleExtend = async () => {
    setExtSaving(true)
    try {
      await api.patch(`/sessions/${id}/extend`, {
        packets: extMins / 30,
        payment_method: 'cash'
      })
      toast.success(`Extended by ${extMins} mins`)
      setPanelOpen(false)
      load()
    } catch (e) { setError(e.message) }
    finally { setExtSaving(false) }
  }

  const handleWhatsAppReceipt = () => {
    const cleanMobile = (s.mobile || '').replace(/\D/g, '')
    const phone = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile
    const snackLines = (data.sales || []).flatMap(sa => (sa.items || []).map(it => `• ${it.name} x${it.qty} = ₹${it.unit_price * it.qty}`)).join('%0A')
    const orgTitle = encodeURIComponent(cafeName.toUpperCase())
    const orgFoot = encodeURIComponent(cafeName)
    const text = `*${orgTitle} - Session Invoice*%0A--------------------------%0A*Session:* %23${s.id}%0A*Station:* ${s.device_label}%0A*Client:* ${s.name || 'Gamer'}%0A*Duration:* ${formatDuration(s.duration_mins)} (${formatTime(s.time_in)} - ${formatTime(s.time_out)})%0A*Gaming Charge:* ₹${s.charge}%0A${Number(s.controller_total) > 0 ? `*Controllers:* ₹${s.controller_total}%0A` : ''}${snackLines ? `*Cafeteria Items:*%0A${snackLines}%0A` : ''}--------------------------%0A*TOTAL BILL:* ₹${grandTotal}%0A*Total Paid:* ₹${totalPaid}%0A${creditRemaining > 0 ? `*Due Balance:* ₹${creditRemaining}%0A` : '*Status:* Fully Paid (Complete)%0A'}Thank you for playing at ${orgFoot}!`
    
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
    } else {
      window.open(`https://wa.me/?text=${text}`, '_blank')
    }
  }

  const sectionCard = (title, icon, children) => (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 750, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  )

  return (
    <div>
      {/* Edit modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Session Details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Customer Full Name">
            <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Mobile Number (10 digits)">
            <input className="input" maxLength={10} value={editForm.mobile} onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} />
          </Field>
          <Field label={`Station Terminal (${s.device_type || 'Platform'} Only)`}>
            <select
              className="input"
              value={editForm.device_id}
              onChange={e => setEditForm(f => ({ ...f, device_id: e.target.value }))}
            >
              {devices
                .filter(d => d.type === s.device_type && d.is_active)
                .map(d => (
                  <option key={d.id} value={d.id}>
                    {d.label} {d.id === s.device_id ? '(Current Station)' : ''}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Time In">
            <input type="time" className="input" value={editForm.time_in} onChange={e => setEditForm(f => ({ ...f, time_in: e.target.value }))} />
          </Field>
          <Field label="Remarks / Notes">
            <input className="input" value={editForm.remark} onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))} />
          </Field>
          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleSaveEdit} disabled={editSaving} className="btn-primary" style={{ flex: 1 }}>
              {editSaving ? <><Spinner size="sm" /> Saving...</> : 'Save Changes'}
            </button>
            <button onClick={() => setShowEditModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>


      {/* End Early Modal */}
      <Modal open={showEndEarlyModal} onClose={() => setShowEndEarlyModal(false)} title="End Session &amp; Release Station">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Checkout <strong>{s.name || 'Client'}</strong> and release <strong>{s.device_label}</strong> immediately.
          </p>
          <div style={{
            background: 'var(--bg-input)', padding: '0.85rem', borderRadius: '10px',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <input type="checkbox" id="recalcCheckDetail" checked={recalcBill} onChange={e => setRecalcBill(e.target.checked)} style={{ cursor: 'pointer' }} />
            <label htmlFor="recalcCheckDetail" style={{ fontSize: '0.825rem', color: 'var(--text)', cursor: 'pointer', fontWeight: 650, marginBottom: 0 }}>
              Prorate tariff based on actual time elapsed
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleEndEarly} disabled={endEarlySaving} className="btn-danger" style={{ flex: 1 }}>
              {endEarlySaving ? <><Spinner size="sm" /> Checking out...</> : 'End Session & Free Station'}
            </button>
            <button onClick={() => setShowEndEarlyModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Printable Thermal Receipt Modal */}
      <Modal open={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="Thermal POS Receipt Slip">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div id="printable-receipt" style={{
            background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px',
            padding: '1.25rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem'
          }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cafeName}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Gaming Console &amp; Cyber Cafe</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date: {formatDate(s.date)}</p>
            </div>


            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span>Invoice #</span>
              <span style={{ fontWeight: 700 }}>#{s.id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span>Client:</span>
              <span>{s.name || 'Walk-in Gamer'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span>Station:</span>
              <span>{s.device_label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span>Timing:</span>
              <span>{formatTime(s.time_in)} - {formatTime(s.time_out)}</span>
            </div>

            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Seat ({formatDuration(s.duration_mins)}):</span>
                <span>{formatRupees(s.charge)}</span>
              </div>
              {Number(s.controller_total) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Extra Controllers:</span>
                  <span>{formatRupees(s.controller_total)}</span>
                </div>
              )}
              {(data.sales || []).flatMap(sa => (sa.items || [])).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>{item.name} x{item.qty}:</span>
                  <span>{formatRupees(item.unit_price * item.qty)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1.5px dashed var(--border)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-text)' }}>
              <span>TOTAL BILL:</span>
              <span>{formatRupees(grandTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem' }}>
              <span>Paid:</span>
              <span>{formatRupees(totalPaid)}</span>
            </div>
            {creditRemaining > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                <span>Balance Due:</span>
                <span>{formatRupees(creditRemaining)}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => window.print()} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <Printer size={14} /> Print Slip
            </button>
            <button onClick={handleWhatsAppReceipt} className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#16a34a' }}>
              <Share2 size={14} /> WhatsApp
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Session Record"
        message={`Are you sure you want to permanently delete session #${id} for ${s.name || 'Anonymous'} on ${s.device_label}? Any attached cafeteria sales will be removed and stock will be restored.`}
        danger
      />

      {/* Slide Panel for add items & extend */}
      <SlidePanel open={panelOpen} onClose={() => setPanelOpen(false)} title="Session Actions & Add-ons">
        <PanelSection title="Add Cafeteria Refreshments" icon={<Coffee size={15} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
              {inventory.filter(i => i.stock_qty > 0).map(item => (
                <button key={item.id} onClick={() => addToCart(item)} className="btn-secondary btn-sm"
                  style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.65rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 650 }}>{item.name}</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(item.sell_price)}</span>
                </button>
              ))}
            </div>

            {cart.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <span>{item.name} (x{item.qty})</span>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <button onClick={() => updateCartQty(item.id, item.qty - 1)} className="btn-secondary btn-icon" style={{ width: '1.25rem', height: '1.25rem', padding: 0 }}>-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateCartQty(item.id, item.qty + 1)} className="btn-secondary btn-icon" style={{ width: '1.25rem', height: '1.25rem', padding: 0 }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px dashed var(--border)', paddingTop: '0.4rem', marginTop: '0.25rem' }}>
                  <span>Total</span>
                  <span>{formatRupees(cartTotal)}</span>
                </div>
                <button onClick={handleAddItems} disabled={cartSaving} className="btn-primary btn-sm" style={{ width: '100%', marginTop: '0.25rem' }}>
                  {cartSaving ? 'Adding...' : 'Attach to Session Bill'}
                </button>
              </div>
            )}
          </div>
        </PanelSection>

        {isActive && (
          <PanelSection title="Extend Station Time" icon={<Clock size={15} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                {[30, 60, 90].map(mins => (
                  <button key={mins} onClick={() => setExtMins(mins)}
                    className={extMins === mins ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} style={{ padding: '0.4rem' }}>
                    +{mins}m
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                New Time Out: <strong>{newEndTimeStr}</strong> (+{formatRupees(extCharge)})
              </p>
              <button onClick={handleExtend} disabled={extSaving} className="btn-primary" style={{ width: '100%' }}>
                {extSaving ? 'Extending...' : `Confirm +${extMins}m Extension`}
              </button>
            </div>
          </PanelSection>
        )}
      </SlidePanel>

      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <button onClick={() => navigate(s.date ? `/sessions?date=${s.date}` : '/sessions')} className="btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem', padding: '0.35rem 0.75rem' }}>
          <ArrowLeft size={14} /> Back to Sessions
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ margin: 0 }}>
                {s.name || 'Anonymous Client'}
              </h1>
              <span className="badge badge-accent">{s.device_label}</span>
              {isActive
                ? <span className="badge-active-session animate-pulse">ACTIVE</span>
                : <span className="badge badge-neutral">COMPLETED</span>}
              {s.is_predated && (
                <span className="badge badge-neutral" style={{ border: '1px solid var(--border)', fontSize: '0.68rem' }} title="This session was recorded on a date after it took place">
                  Backdated Entry
                </span>
              )}
            </div>
            <p className="page-sub" style={{ marginTop: '0.35rem' }}>
              {formatDate(s.date)} · {formatTime(s.time_in)} to {formatTime(s.time_out)} ({formatDuration(s.duration_mins)})
            </p>
          </div>

          {isActive && (
            <div className="card" style={{ padding: '0.65rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Clock size={16} style={{ color: 'var(--accent-text)' }} />
              <Countdown timeOut={s.time_out} />
            </div>
          )}
        </div>

        {/* Action / Toolbar */}
        <FilterBar style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button onClick={() => setPanelOpen(true)} className="btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShoppingCart size={13} /> Add Refreshments
            </button>
            {isActive && (
              <>
                <button onClick={() => setPanelOpen(true)} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={13} /> Extend Time
                </button>
                <button onClick={() => setShowEndEarlyModal(true)} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--warning)' }}>
                  <PowerOff size={13} /> End Early
                </button>
              </>
            )}
            <button onClick={() => setShowReceiptModal(true)} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Printer size={13} /> Thermal Slip
            </button>
            <button onClick={handleWhatsAppReceipt} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#16a34a' }}>
              <Share2 size={13} /> WhatsApp
            </button>
            <button onClick={openEditModal} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Edit3 size={13} /> Edit Info
            </button>
          </div>

          {isAdmin && (
            <button onClick={() => setShowDelete(true)} className="btn-secondary btn-sm"
              style={{ padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--danger)', borderColor: 'var(--danger-border)', marginLeft: 'auto' }}>
              <Trash2 size={13} /> Delete
            </button>
          )}
        </FilterBar>
      </div>

      <ErrorMsg error={error} />

      {/* Grid view */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left column: Bill Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {sectionCard('Session Invoice Breakdown', <Receipt size={14} />, (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
              <BillRow label={`Seat Charge (${formatDuration(s.duration_mins)} · ${s.device_label})`} value={s.charge} />
              {Number(s.controller_total) > 0 && <BillRow label="Controller Rentals" value={s.controller_total} />}
              {Number(s.extra_person_total) > 0 && <BillRow label="Extra Seat Fees" value={s.extra_person_total} />}

              {data.sales?.map((sale, i) => (
                sale.items?.map((item, j) => (
                  <BillRow key={`${i}-${j}`} label={`${item.name} ×${item.qty}`} value={item.unit_price * item.qty} muted />
                ))
              ))}

              <div style={{ borderTop: '1.5px dashed var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <BillRow label="TOTAL BILL" value={grandTotal} bold accent />
              </div>
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }}>
                <BillRow label="Total Collected" value={totalPaid} />
                {creditRemaining > 0
                  ? <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>OUTSTANDING</span>
                      <span className="badge badge-danger">{formatRupees(creditRemaining)}</span>
                    </div>
                  : <div style={{ color: 'var(--success)', fontWeight: 700, textAlign: 'right', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                      <CheckCircle2 size={12} /> Fully Paid
                    </div>}
              </div>
              {s.remark && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Note: {s.remark}
                </div>
              )}
            </div>
          ))}

          {players.length > 0 && sectionCard('Player Allocations', <Users size={14} />, (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {players.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem 0.75rem', borderRadius: '8px',
                  background: i % 2 === 0 ? 'var(--bg-input)' : 'transparent',
                  fontSize: '0.8125rem'
                }}>
                  <span style={{ fontWeight: 650, color: 'var(--text)' }}>Player {p.player_number}</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {!p.own_controller && <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>Rented controller</span>}
                    {Number(p.extra_person_fee) > 0 && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Extra seat</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right column: Payments & Collection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {creditRemaining > 0 && sectionCard('Collect Payment', <Banknote size={14} />, (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                padding: '0.65rem 1rem', borderRadius: '10px',
                background: 'rgba(220,38,38, 0.08)',
                border: '1px solid rgba(220,38,38, 0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 650 }}>Balance due</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: 'var(--danger)' }}>
                  {formatRupees(creditRemaining)}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="label" style={{ marginBottom: 0 }}>Payment Breakdown</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field label="Cash Amount (₹)">
                    <input type="number" className="input" placeholder="0"
                      value={collectAmount} onChange={e => setCollectAmount(e.target.value)} />
                  </Field>
                  <Field label="Online / UPI (₹)">
                    <input type="number" className="input" placeholder="0"
                      value={collectOnline} onChange={e => setCollectOnline(e.target.value)} />
                  </Field>
                </div>
                {(Number(collectAmount) > 0 || Number(collectOnline) > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem',
                    color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    <span>Total collecting</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-text)' }}>
                      {formatRupees(Number(collectAmount || 0) + Number(collectOnline || 0))}
                    </span>
                  </div>
                )}
              </div>

              <button onClick={handleCollect} disabled={collectSaving} className="btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
                {collectSaving ? <><Spinner size="sm" /> Recording...</> : 'Record Payment'}
              </button>
            </div>
          ))}

          {payments.length > 0 && sectionCard('Payment History Ledger', <History size={14} />, (
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

      </div>
    </div>
  )
}

function BillRow({ label, value, bold, accent, muted }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontWeight: bold ? 800 : muted ? 500 : 600,
      fontSize: bold ? '0.95rem' : '0.8125rem',
      color: muted ? 'var(--text-faint)' : 'var(--text-muted)'
    }}>
      <span>{label}</span>
      <span style={{ color: accent ? 'var(--accent-text)' : muted ? 'var(--text-faint)' : 'var(--text)', fontWeight: bold ? 800 : 650 }}>
        {formatRupees(value)}
      </span>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, formatDate, formatTime, todayISO, validateFirstName, validateMobile } from '../../lib/helpers'
import { Field, ErrorMsg, TrialWarningModal, Modal, ConfirmModal, Spinner, Tabs, FilterBar, DateInput, EmptyState, PageLoader } from '../../components/UI'
import SplitPayment from '../../components/SplitPayment'
import { useAuth } from '../../context/AuthContext'
import { ShoppingBag, Share2, Printer, CheckCircle, Plus, Edit3, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'react-toastify'

export default function WalkInSale() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const isRealAdmin = user?.role === 'admin' && user?.username !== 'trial'

  const initialTab = searchParams.get('tab') === 'sales' ? 'sales' : 'sell'
  const [tab, setTab] = useState(initialTab)

  // Sync tab with URL
  const handleTabChange = (newTab) => {
    setTab(newTab)
    setSearchParams(newTab === 'sales' ? { tab: 'sales' } : {})
  }

  // --- SELL TAB STATE ---
  const [items, setItems] = useState([])
  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState({ id: null, name: '', shop_name: '', mobile: '' })
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [cashAmount, setCashAmount] = useState('')
  const [onlineAmount, setOnlineAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })
  const [completedSale, setCompletedSale] = useState(null)

  // --- SALES LOG TAB STATE ---
  const [sales, setSales] = useState([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState(todayISO())
  const [editSale, setEditSale] = useState(null)
  const [editSaleSaving, setEditSaleSaving] = useState(false)
  const [deleteSaleId, setDeleteSaleId] = useState(null)
  const [deleteSaleSaving, setDeleteSaleSaving] = useState(false)

  // Receipt modal for existing sale reprint
  const [reprintSale, setReprintSale] = useState(null)
  const [cafeName, setCafeName] = useState(() => localStorage.getItem('nexus_tenant_name') || 'Headshot Gaming Lounge')

  useEffect(() => {
    loadInventory()
    api.get('/settings').then(res => {
      const nameSetting = res.settings?.find(s => s.key === 'cafe_name')?.value
      if (nameSetting) {
        setCafeName(nameSetting)
        localStorage.setItem('nexus_tenant_name', nameSetting)
      }
    }).catch(() => {})
  }, [])


  useEffect(() => {
    if (tab === 'sales') {
      loadSales()
    }
  }, [tab, dateFilter])

  const loadInventory = async () => {
    try {
      const d = await api.get('/inventory')
      setItems(d.items || [])
    } catch (e) {
      setError(e.message)
    }
  }

  const loadSales = async () => {
    try {
      setSalesLoading(true)
      const d = await api.get(`/sales?sale_type=walkin${dateFilter ? `&date=${dateFilter}` : ''}`)
      setSales(d.sales || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setSalesLoading(false)
    }
  }

  const handleNameChange = async (val) => {
    setCustomer(c => ({ ...c, name: val }))
    if (val.length >= 2) {
      try {
        const d = await api.get(`/customers?search=${encodeURIComponent(val)}`)
        setCustomerSuggestions(d.customers || [])
      } catch {
        setCustomerSuggestions([])
      }
    } else {
      setCustomerSuggestions([])
    }
  }

  const selectCustomer = (c) => {
    setCustomer({ id: c.id, name: c.name, shop_name: c.shop_name || '', mobile: c.mobile || '' })
    setCustomerSuggestions([])
  }

  const addToCart = (item) => {
    setCart(c => {
      const existing = c.find(i => i.id === item.id)
      if (existing) return c.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { ...item, qty: 1 }]
    })
  }

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart(c => c.filter(i => i.id !== id))
    else setCart(c => c.map(i => i.id === id ? { ...i, qty } : i))
  }

  const total = cart.reduce((sum, i) => sum + i.sell_price * i.qty, 0)

  const handleSubmit = async () => {
    if (cart.length === 0) { setError('Cart is empty — select items to sell'); return }

    // Mandatory Customer Name
    if (!customer.name || !customer.name.trim()) {
      setError('Customer Name is mandatory')
      return
    }
    const nameErr = validateFirstName(customer.name)
    if (nameErr) { setError(nameErr); return }

    // Mandatory Shop Name
    if (!customer.shop_name || !customer.shop_name.trim()) {
      setError('Shop / Business Name is mandatory')
      return
    }

    // Mobile Validation (if entered)
    const mobileErr = validateMobile(customer.mobile)
    if (mobileErr) { setError(mobileErr); return }

    setLoading(true)
    setError('')
    try {
      const saleTotal = total
      const cash = Number(cashAmount || 0)
      const online = Number(onlineAmount || 0)
      const paidAmount = (cash + online) > 0 ? (cash + online) : saleTotal
      const payMethod = cash > 0 && online > 0 ? 'split' : online > 0 ? 'online' : 'cash'
      const res = await api.post('/sales', {
        sale_type: 'walkin',
        date: todayISO(),
        customer_id: customer.id,
        name: customer.name.trim(),
        shop_name: customer.shop_name.trim(),
        mobile: customer.mobile ? customer.mobile.trim() : null,
        total: saleTotal,
        payment_received: paidAmount,
        payment_method: payMethod,
        items: cart.map(i => ({ item_id: i.id, qty: i.qty, unit_price: i.sell_price }))
      })

      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Foreign Sale' })
      } else {
        setCompletedSale({
          id: res.id,
          date: todayISO(),
          customerName: customer.name.trim(),
          customerMobile: customer.mobile,
          shopName: customer.shop_name.trim(),
          items: [...cart],
          total: saleTotal,
          paid: paidAmount,
          method: payMethod
        })
        // Reset form
        setCart([])
        setCustomer({ id: null, name: '', shop_name: '', mobile: '' })
        setCashAmount('')
        setOnlineAmount('')
        loadInventory()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleWhatsAppShare = (saleData) => {
    const s = saleData || completedSale
    if (!s) return
    const cleanMobile = (s.customerMobile || s.customer_mobile || '').replace(/\D/g, '')
    const phone = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile
    const sItems = s.items || []
    const itemLines = sItems.filter(i => i.name).map(i => `• ${i.name} x${i.qty} = ₹${(i.sell_price || i.unit_price) * i.qty}`).join('%0A')
    const orgTitle = encodeURIComponent(cafeName.toUpperCase())
    const orgFoot = encodeURIComponent(cafeName)
    const text = `*${orgTitle} - Cafeteria Receipt*%0A--------------------------%0A*Customer:* ${s.customerName || s.customer_name}${s.shopName || s.shop_name ? ` (${s.shopName || s.shop_name})` : ''}%0A*Date:* ${s.date || todayISO()}%0A*Items:*%0A${itemLines}%0A--------------------------%0A*Total:* ₹${s.total}%0A*Paid:* ₹${s.paid || s.payment_received} (${s.method || s.payment_method})%0A${Number(s.total) > Number(s.paid || s.payment_received) ? `*Due Balance:* ₹${Number(s.total) - Number(s.paid || s.payment_received)}%0A` : ''}Thank you for your business at ${orgFoot}!`
    
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
    } else {
      window.open(`https://wa.me/?text=${text}`, '_blank')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Edit & Delete Sales handlers
  const handleEditSale = async () => {
    if (!editSale) return
    setEditSaleSaving(true)
    try {
      await api.patch(`/sales/${editSale.id}`, {
        date: editSale.date,
        total: Number(editSale.total),
        payment_received: Number(editSale.payment_received),
        payment_method: editSale.payment_method,
      })
      toast.success('Sale record updated')
      setEditSale(null)
      loadSales()
    } catch (e) {
      setError(e.message)
    } finally {
      setEditSaleSaving(false)
    }
  }

  const handleDeleteSale = async () => {
    if (!deleteSaleId) return
    setDeleteSaleSaving(true)
    try {
      await api.delete(`/sales/${deleteSaleId}`)
      toast.success('Walk-in sale deleted and stock restored')
      setDeleteSaleId(null)
      loadSales()
      loadInventory()
    } catch (e) {
      setError(e.message)
      setDeleteSaleId(null)
    } finally {
      setDeleteSaleSaving(false)
    }
  }

  const totalSalesRevenue = sales.reduce((sum, s) => sum + Number(s.total || 0), 0)
  const totalSalesPaid = sales.reduce((sum, s) => sum + Number(s.payment_received || s.total || 0), 0)

  return (
    <div>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => { setTrialModal({ isOpen: false, action: '' }); navigate('/inventory') }} />

      {/* Edit Sale Modal */}
      <Modal open={!!editSale} onClose={() => setEditSale(null)} title="Edit Walk-in Sale Record">
        {editSale && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <Field label="Sale Date">
              <DateInput
                value={editSale.date || todayISO()}
                onChange={e => setEditSale(s => ({ ...s, date: e.target.value }))}
                showTodayButton={true}
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Total Amount (₹)">
                <input type="number" className="input" value={editSale.total || ''}
                  onChange={e => setEditSale(s => ({ ...s, total: e.target.value }))} />
              </Field>
              <Field label="Payment Received (₹)">
                <input type="number" className="input" value={editSale.payment_received || ''}
                  onChange={e => setEditSale(s => ({ ...s, payment_received: e.target.value }))} />
              </Field>
            </div>
            <Field label="Payment Method">
              <select className="input" value={editSale.payment_method || 'cash'}
                onChange={e => setEditSale(s => ({ ...s, payment_method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="online">Online / UPI</option>
                <option value="split">Split (Cash + Online)</option>
              </select>
            </Field>
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
              <button onClick={handleEditSale} disabled={editSaleSaving} className="btn-primary" style={{ flex: 1 }}>
                {editSaleSaving ? <><Spinner size="sm" /> Saving...</> : 'Save Changes'}
              </button>
              <button onClick={() => setEditSale(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Sale Confirm Modal */}
      <ConfirmModal
        open={!!deleteSaleId}
        onClose={() => setDeleteSaleId(null)}
        onConfirm={handleDeleteSale}
        loading={deleteSaleSaving}
        title="Delete Walk-in Sale"
        message="Permanently delete this walk-in sale? Item stock quantities will be restored to inventory automatically."
        danger
      />

      {/* Sale Receipt Modal (Post-Sale & Reprint) */}
      <Modal open={!!completedSale || !!reprintSale} onClose={() => { setCompletedSale(null); setReprintSale(null) }} title="Walk-in Sale Receipt">
        {(completedSale || reprintSale) && (() => {
          const s = completedSale || reprintSale
          const sItems = s.items || []
          const isFullPaid = Number(s.paid || s.payment_received || s.total) >= Number(s.total)

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <CheckCircle size={38} style={{ color: 'var(--success)', margin: '0 auto 0.4rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>Sale #{s.id} Receipt</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {s.shopName || s.shop_name ? `${s.customerName || s.customer_name} • ${s.shopName || s.shop_name}` : s.customerName || s.customer_name}
                </p>
              </div>

              {/* Receipt Summary Box */}
              <div style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '1rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                  <span>Customer:</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700 }}>{s.customerName || s.customer_name}</span>
                </div>
                {(s.shopName || s.shop_name) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                    <span>Shop:</span>
                    <span style={{ color: 'var(--text)', fontWeight: 700 }}>{s.shopName || s.shop_name}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem', marginBottom: '0.5rem' }}>
                  {sItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>{item.name} ×{item.qty}</span>
                      <span>{formatRupees((item.sell_price || item.unit_price) * item.qty)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--accent-text)', fontSize: '0.95rem' }}>
                  <span>TOTAL:</span>
                  <span>{formatRupees(s.total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', color: isFullPaid ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                  <span>Payment ({s.method || s.payment_method}):</span>
                  <span>{formatRupees(s.paid || s.payment_received || s.total)}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={() => handleWhatsAppShare(s)} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: '#16a34a' }}>
                  <Share2 size={14} /> WhatsApp Receipt
                </button>
                <button onClick={handlePrint} className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <Printer size={14} /> Print Receipt
                </button>
              </div>

              <button onClick={() => { setCompletedSale(null); setReprintSale(null) }} className="btn-secondary" style={{ width: '100%' }}>
                Close
              </button>
            </div>
          )
        })()}
      </Modal>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Link to="/inventory" className="btn-secondary btn-icon" style={{ width: '2rem', height: '2rem', borderRadius: '8px' }} title="Back to Inventory">
              <ArrowLeft size={15} />
            </Link>
            <h1 className="page-title" style={{ margin: 0 }}>Foreign Sale</h1>
          </div>
          <p className="page-sub" style={{ marginTop: '0.25rem' }}>Direct cafeteria sales for outside visitors, neighbor businesses, and walk-in customers</p>
        </div>

        <Link to="/inventory" className="btn-secondary" style={{ padding: '0.55rem 1.15rem' }}>
          View Inventory Stock
        </Link>
      </div>

      {/* View Switcher Tabs */}
      <Tabs
        tabs={[
          { key: 'sell', label: 'New Foreign Sale', icon: <Plus size={14} /> },
          { key: 'sales', label: 'View Walk-in Sales', icon: <ShoppingBag size={14} /> },
        ]}
        active={tab}
        onChange={handleTabChange}
      />

      <ErrorMsg error={error} />

      {/* ========================================================
          TAB 1: NEW FOREIGN SALE CHECKOUT WORKSTATION
          ======================================================== */}
      {tab === 'sell' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
          
          {/* Left Side: Product Grid */}
          <div>
            <p className="label" style={{ marginBottom: '0.75rem' }}>Cafeteria product catalog</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.85rem' }}>
              {items.filter(i => i.stock_qty > 0).map(item => (
                <button key={item.id} onClick={() => addToCart(item)}
                  className="card" style={{
                    padding: '1rem', display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
                    minHeight: '105px', transition: 'transform 0.1s ease, border-color 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.875rem' }}>{item.name}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{item.category}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatRupees(item.sell_price)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.675rem', color: 'var(--text-faint)', marginTop: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}>
                    Stock available: {item.stock_qty}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Right Side: Foreign Sale Checkout & Mandatory Identity */}
          <div>
            <p className="label" style={{ marginBottom: '0.75rem' }}>Foreign Sale Details &amp; Invoice</p>
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Mandatory Customer & Shop Details Form */}
              <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '12px', border: '1.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mandatory Client Identity
                </p>
                
                <Field label="Customer Name" required>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      placeholder="e.g. Rahul Sharma"
                      value={customer.name}
                      onChange={e => handleNameChange(e.target.value)}
                    />
                    {customerSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                        background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
                        boxShadow: 'var(--shadow-md)', borderRadius: '10px', marginTop: '0.35rem',
                        overflow: 'hidden'
                      }}>
                        {customerSuggestions.map(c => (
                          <button key={c.id} onClick={() => selectCustomer(c)}
                            type="button"
                            className="btn-ghost"
                            style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.85rem', fontSize: '0.8125rem', borderRadius: 0, borderBottom: '1px solid var(--border)' }}>
                            <span style={{ color: 'var(--text)', fontWeight: 700 }}>{c.name}</span>
                            {c.shop_name && <span style={{ color: 'var(--accent-text)', marginLeft: '0.5rem', fontWeight: 650 }}>({c.shop_name})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field label="Shop / Business Name" required>
                    <input
                      className="input"
                      placeholder="e.g. Gupta Medical"
                      value={customer.shop_name}
                      onChange={e => setCustomer(c => ({ ...c, shop_name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Mobile (optional)">
                    <input
                      className="input"
                      placeholder="10 Digits"
                      maxLength={10}
                      value={customer.mobile}
                      onChange={e => setCustomer(c => ({ ...c, mobile: e.target.value.replace(/\D/g, '') }))}
                    />
                  </Field>
                </div>
              </div>

              {cart.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Cart empty — click cafeteria items to add</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {cart.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px dashed var(--border)', paddingBottom: '0.65rem'
                      }}>
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{item.name}</p>
                          <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginTop: '0.1rem' }}>
                            {formatRupees(item.sell_price)} each
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button onClick={() => updateQty(item.id, item.qty - 1)} className="btn-secondary btn-icon" style={{ width: '1.5rem', height: '1.5rem', borderRadius: '4px', padding: 0 }}>−</button>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.85rem', width: '1.25rem', textAlign: 'center' }}>{item.qty}</span>
                          <button onClick={() => updateQty(item.id, item.qty + 1)} className="btn-secondary btn-icon" style={{ width: '1.5rem', height: '1.5rem', borderRadius: '4px', padding: 0 }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Billing totals */}
                  <div style={{ borderTop: '1.5px dashed var(--border)', paddingTop: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', fontFamily: "'JetBrains Mono', monospace", marginBottom: '1rem' }}>
                      <span style={{ color: 'var(--text)' }}>FOREIGN SALE TOTAL</span>
                      <span style={{ color: 'var(--accent-text)' }}>{formatRupees(total)}</span>
                    </div>
                    
                    <SplitPayment
                      cashValue={cashAmount}
                      onlineValue={onlineAmount}
                      onCashChange={setCashAmount}
                      onOnlineChange={setOnlineAmount}
                      totalBill={total}
                      label="Payment Collection"
                      compact
                    />
                    
                    <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.65rem 1.25rem' }}>
                      {loading ? <><Spinner size="sm" /> Processing Sale...</> : 'Finalize Foreign Sale'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}

      {/* ========================================================
          TAB 2: VIEW WALK-IN SALES LOG (Integrated from Inventory)
          ======================================================== */}
      {tab === 'sales' && (
        <div>
          <FilterBar style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
              <DateInput
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                showSteppers={true}
                showTodayButton={true}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {!salesLoading && sales.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div className="lcd-screen" style={{ padding: '0.35rem 0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>TOTAL SALES: </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{formatRupees(totalSalesRevenue)}</span>
                  </div>
                  <div className="lcd-screen success" style={{ padding: '0.35rem 0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>COLLECTED: </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{formatRupees(totalSalesPaid)}</span>
                  </div>
                </div>
              )}
              <button onClick={() => setDateFilter('')} className="btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem' }}>Show All Dates</button>
            </div>
          </FilterBar>

          {salesLoading ? <PageLoader /> : sales.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No Walk-in Sales"
              description={`No walk-in cafeteria sales recorded for ${dateFilter ? formatDate(dateFilter) : 'the selected period'}.`}
              action={
                <button onClick={() => handleTabChange('sell')} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Plus size={14} /> Record Foreign Sale
                </button>
              }
            />
          ) : (
            <div className="card-flush" style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    {['#', 'Client & Shop Name', 'Items Purchased', 'Total', 'Payment', 'Date / Time', 'Operator', 'Actions'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sa, idx) => {
                    const itemSummary = (sa.items || []).filter(i => i.name).map(i => `${i.name} ×${i.qty}`).join(', ')
                    const isFullyPaid = Number(sa.payment_received || sa.total) >= Number(sa.total)
                    return (
                      <tr key={sa.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                        <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.725rem', color: 'var(--text-faint)' }}>#{sa.id}</td>
                        <td className="table-cell">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontWeight: 750, color: 'var(--text)' }}>{sa.customer_name || 'Walk-in Client'}</span>
                            {sa.shop_name && (
                              <span style={{ fontSize: '0.725rem', color: 'var(--accent-text)', fontWeight: 600 }}>
                                🏪 {sa.shop_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '220px' }}>
                          {itemSummary || 'Cafeteria items'}
                        </td>
                        <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 750, color: 'var(--text)' }}>
                          {formatRupees(sa.total)}
                        </td>
                        <td className="table-cell">
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <span className={`badge ${sa.payment_method === 'online' ? 'badge-warning' : 'badge-accent'}`} style={{ fontSize: '0.65rem' }}>
                              {sa.payment_method}
                            </span>
                            {isFullyPaid
                              ? <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>Paid</span>
                              : <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>Due: {formatRupees(Number(sa.total) - Number(sa.payment_received || 0))}</span>}
                          </div>
                        </td>
                        <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.725rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                          {formatDate(sa.date || sa.created_at)} {formatTime(sa.created_at)}
                        </td>
                        <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.725rem', fontWeight: 600 }}>
                          @{sa.created_by_username || 'system'}
                        </td>
                        <td className="table-cell">
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <button
                              onClick={() => setReprintSale(sa)}
                              className="btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}
                              title="Print or Share Receipt"
                            >
                              <Printer size={11} /> Receipt
                            </button>
                            {isRealAdmin && (
                              <>
                                <button
                                  onClick={() => setEditSale({ ...sa })}
                                  className="btn-secondary btn-sm"
                                  style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}
                                  title="Edit Sale"
                                >
                                  <Edit3 size={11} />
                                </button>
                                <button
                                  onClick={() => setDeleteSaleId(sa.id)}
                                  className="btn-secondary btn-sm"
                                  style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                                  title="Delete Sale & Restore Stock"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

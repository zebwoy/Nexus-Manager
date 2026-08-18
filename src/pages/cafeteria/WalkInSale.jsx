import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, todayISO, validateFirstName, validateMobile } from '../../lib/helpers'
import { Field, ErrorMsg, TrialWarningModal, Modal, Spinner } from '../../components/UI'
import { useAuth } from '../../context/AuthContext'
import { ShoppingBag, Share2, Printer, CheckCircle } from 'lucide-react'

export default function WalkInSale() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState({ id: null, name: '', shop_name: '', mobile: '' })
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [payment, setPayment] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })
  
  // Completed sale receipt modal
  const [completedSale, setCompletedSale] = useState(null)

  useEffect(() => {
    api.get('/inventory').then(d => setItems(d.items || []))
  }, [])

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
    if (cart.length === 0) { setError('Cart is empty'); return }
    
    if (customer.name) {
      const nameErr = validateFirstName(customer.name)
      if (nameErr) { setError(nameErr); return }
    }
    const mobileErr = validateMobile(customer.mobile)
    if (mobileErr) { setError(mobileErr); return }

    setLoading(true)
    setError('')
    try {
      const saleTotal = total
      const paidAmount = payment !== '' ? Number(payment) : saleTotal
      const res = await api.post('/sales', {
        sale_type: 'walkin',
        date: todayISO(),
        customer_id: customer.id,
        name: customer.name || null,
        shop_name: customer.shop_name || null,
        mobile: customer.mobile || null,
        total: saleTotal,
        payment_received: paidAmount,
        payment_method: payMethod,
        items: cart.map(i => ({ item_id: i.id, qty: i.qty, unit_price: i.sell_price }))
      })

      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Foreign Sale' })
      } else {
        // Show completion & receipt dialog
        setCompletedSale({
          id: res.id,
          date: todayISO(),
          customerName: customer.name || 'Walk-in Client',
          customerMobile: customer.mobile,
          shopName: customer.shop_name,
          items: [...cart],
          total: saleTotal,
          paid: paidAmount,
          method: payMethod
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleWhatsAppShare = () => {
    if (!completedSale) return
    const phone = completedSale.customerMobile ? `91${completedSale.customerMobile.replace(/\D/g, '')}` : ''
    const itemLines = completedSale.items.map(i => `• ${i.name} x${i.qty} = ₹${i.sell_price * i.qty}`).join('%0A')
    const text = `*Nexus Gaming Cafe - Cafeteria Receipt*%0A--------------------------%0A*Customer:* ${completedSale.customerName}%0A*Date:* ${completedSale.date}%0A*Items:*%0A${itemLines}%0A--------------------------%0A*Total:* ₹${completedSale.total}%0A*Paid:* ₹${completedSale.paid} (${completedSale.method})%0A${completedSale.total > completedSale.paid ? `*Due Balance:* ₹${completedSale.total - completedSale.paid}%0A` : ''}Thank you for visiting Nexus Manager!`
    
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => { setTrialModal({ isOpen: false, action: '' }); navigate('/inventory') }} />

      {/* Post-Sale Completion & Receipt Modal */}
      <Modal open={!!completedSale} onClose={() => navigate('/inventory')} title="Foreign Sale Completed">
        {completedSale && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <CheckCircle size={40} style={{ color: 'var(--success)', margin: '0 auto 0.5rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>Sale #{completedSale.id} Recorded</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Inventory stock decremented successfully.</p>
            </div>

            {/* Receipt Summary Box */}
            <div style={{
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '1rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                <span>Customer:</span>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>{completedSale.customerName}</span>
              </div>
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem', marginBottom: '0.5rem' }}>
                {completedSale.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>{item.name} ×{item.qty}</span>
                    <span>{formatRupees(item.sell_price * item.qty)}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--accent-text)' }}>
                <span>TOTAL:</span>
                <span>{formatRupees(completedSale.total)}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={handleWhatsAppShare} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: '#16a34a' }}>
                <Share2 size={14} /> WhatsApp Receipt
              </button>
              <button onClick={handlePrint} className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Printer size={14} /> Print Receipt
              </button>
            </div>

            <button onClick={() => navigate('/inventory')} className="btn-secondary" style={{ width: '100%' }}>
              Done &amp; Return to Cafeteria
            </button>
          </div>
        )}
      </Modal>

      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Foreign Sale</h1>
        <p className="page-sub">Cafeteria sale workstation for outside clients and neighboring shop owners</p>
      </div>

      <ErrorMsg error={error} />
      
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
                  minHeight: '105px'
                }}>
                <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.875rem' }}>{item.name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{item.category}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatRupees(item.sell_price)}
                  </span>
                </div>
                <p style={{ fontSize: '0.675rem', color: 'var(--text-faint)', marginTop: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}>
                  Stock level: {item.stock_qty}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Foreign Sale Checkout & Identity */}
        <div>
          <p className="label" style={{ marginBottom: '0.75rem' }}>Foreign Sale Details & Invoice</p>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Customer Details Form */}
            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Foreign Client Identity
              </p>
              <Field label="Client Name (First Name required)">
                <div style={{ position: 'relative' }}>
                  <input className="input" placeholder="e.g. Rahul Sharma" value={customer.name} onChange={e => handleNameChange(e.target.value)} />
                  {customerSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                      background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
                      boxShadow: 'var(--shadow-md)', borderRadius: '10px', marginTop: '0.35rem',
                      overflow: 'hidden'
                    }}>
                      {customerSuggestions.map(c => (
                        <button key={c.id} onClick={() => selectCustomer(c)}
                          className="btn-ghost"
                          style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.85rem', fontSize: '0.8125rem', borderRadius: 0, borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text)', fontWeight: 700 }}>{c.name}</span>
                          {c.shop_name && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({c.shop_name})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Shop Name">
                  <input className="input" placeholder="e.g. Gupta Medical" value={customer.shop_name} onChange={e => setCustomer(c => ({ ...c, shop_name: e.target.value }))} />
                </Field>
                <Field label="Mobile Number">
                  <input className="input" placeholder="10 Digits" maxLength={10} value={customer.mobile} onChange={e => setCustomer(c => ({ ...c, mobile: e.target.value.replace(/\D/g, '') }))} />
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
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <Field label="Amount Paid (₹)">
                      <input type="number" className="input" placeholder={total} value={payment} onChange={e => setPayment(e.target.value)} />
                    </Field>
                    <Field label="Payment Mode">
                      <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                        <option value="cash">Cash</option>
                        <option value="online">Online / UPI</option>
                        <option value="credit">Credit / Due</option>
                      </select>
                    </Field>
                  </div>
                  
                  <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.65rem 1.25rem' }}>
                    {loading ? <><Spinner size="sm" /> Processing Sale...</> : 'Finalize Foreign Sale'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  )
}

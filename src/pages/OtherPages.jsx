import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatDate, todayISO, validateName, validateMobile } from '../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, Field, Modal, TrialWarningModal } from '../components/UI'
import { Plus, Trash2, ShoppingBag } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'


// ─── CAFETERIA ────────────────────────────────────────────────
export function Inventory() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.username === 'trial'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
  
  const [showEdit, setShowEdit] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
  
  const [activePopover, setActivePopover] = useState(null)
  const [saving, setSaving] = useState(false)
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  useEffect(() => { load() }, [])
  useEffect(() => {
    const handleClose = () => setActivePopover(null)
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [])

  const load = async () => {
    try { setLoading(true); const d = await api.get('/inventory'); setItems(d.items || []) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const ef = (k, v) => setEditForm(p => ({ ...p, [k]: v }))

  const handleAdd = async () => {
    if (!form.name || !form.sell_price) { return }
    setSaving(true)
    try {
      await api.post('/inventory', { ...form, buy_price: Number(form.buy_price || 0), sell_price: Number(form.sell_price), stock_qty: Number(form.stock_qty || 0) })
      setShowAdd(false); setForm({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
      toast.success(`Successfully added product: "${form.name}"`)
      load()
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Register Cafeteria Product' })
      }
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    if (!editForm.name || !editForm.sell_price) { return }
    setSaving(true)
    try {
      await api.put(`/inventory?id=${editItem.id}`, {
        name: editForm.name,
        category: editForm.category,
        buy_price: Number(editForm.buy_price || 0),
        sell_price: Number(editForm.sell_price),
        stock_qty: Number(editForm.stock_qty || 0)
      })
      setShowEdit(false)
      toast.success(`Updated details for "${editForm.name}"`)
      load()
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Update Cafeteria Product details' })
      }
    } catch (err) { toast.error('Failed to update product: ' + err.message) } finally { setSaving(false) }
  }

  const handleDelete = async (item) => {
    try {
      await api.delete(`/inventory?id=${item.id}`)
      setItems(prev => prev.filter(i => i.id !== item.id))
      
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Delete Cafeteria Product' })
      }

      toast.info(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>Deleted "{item.name}"</span>
          <button 
            className="btn-primary btn-sm" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', textTransform: 'uppercase' }}
            onClick={async (e) => {
              e.stopPropagation()
              try {
                await api.post(`/inventory?action=restore&id=${item.id}`)
                load()
                toast.success(`Restored "${item.name}"`)
              } catch (e) {
                toast.error('Failed to restore item: ' + e.message)
              }
            }}
          >
            Undo
          </button>
        </div>,
        { autoClose: 6000, closeOnClick: false }
      )
    } catch (err) {
      toast.error('Failed to delete item: ' + err.message)
    }
  }

  const CATEGORIES = ['Drinks', 'Snacks', 'Other']

  return (
    <div>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => setTrialModal({ isOpen: false, action: '' })} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Cafeteria</h1>
          <p className="page-sub">Refreshment drinks, snacks, and cafeteria stock levels</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/inventory/sell" className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}><ShoppingBag size={15} />Foreign Sale</Link>
          <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>+ Add Item</button>
        </div>
      </div>
      
      <ErrorMsg error={error} />
      
      {loading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState title="No Cafeteria Stock" description="Log products to track cafeteria inventory and calculate accurate profits."
          action={<button onClick={() => setShowAdd(true)} className="btn-primary">Add Item</button>} />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto', overflowY: 'visible' }}>
          <table className="tbl" style={{ overflow: 'visible' }}>
            <thead>
              <tr>
                {['Item name', 'Category', 'Unit Cost', 'Retail Price', 'Stock Level', 'Terminal Status'].map(h => (
                  <th key={h}>{h}</th>
                ))}
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                  <td className="table-cell" style={{ fontWeight: 700 }}>{item.name}</td>
                  <td className="table-cell"><span className="badge badge-neutral">{item.category}</span></td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(item.buy_price)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 650 }}>{formatRupees(item.sell_price)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{item.stock_qty}</td>
                  <td className="table-cell">
                    {item.stock_qty <= 0
                      ? <span className="badge badge-danger">Depleted</span>
                      : item.stock_qty <= 5
                        ? <span className="badge badge-warning">Low Stock</span>
                        : <span className="badge badge-success">In Stock</span>}
                  </td>
                  {isAdmin && (
                    <td className="table-cell" style={{ position: 'relative', overflow: 'visible' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePopover(activePopover === item.id ? null : item.id)
                        }}
                        className="btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.725rem' }}
                      >
                        ⚙️ Manage
                      </button>
                      
                      {activePopover === item.id && (
                        <div style={{
                          position: 'absolute', right: '10px', top: '100%', zIndex: 1000,
                          background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
                          borderRadius: '8px', padding: '0.5rem', minWidth: '120px',
                          display: 'flex', flexDirection: 'column', gap: '0.25rem',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}>
                          <button 
                            onClick={() => {
                              setEditItem(item)
                              setEditForm({
                                name: item.name,
                                category: item.category,
                                buy_price: item.buy_price,
                                sell_price: item.sell_price,
                                stock_qty: item.stock_qty
                              })
                              setShowEdit(true)
                              setActivePopover(null)
                            }}
                            className="btn-secondary btn-sm"
                            style={{ width: '100%', textAlign: 'left', padding: '0.35rem 0.5rem', fontSize: '0.725rem' }}
                          >
                            ✏️ Edit Details
                          </button>
                          <button 
                            onClick={() => {
                              handleDelete(item)
                              setActivePopover(null)
                            }}
                            className="btn-danger btn-sm"
                            style={{ width: '100%', textAlign: 'left', padding: '0.35rem 0.5rem', fontSize: '0.725rem' }}
                          >
                            🗑️ Delete Item
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Cafeteria Stock Item">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Product Name" required>
            <input className="input" placeholder="e.g. Coca-Cola 300ml" value={form.name} onChange={e => f('name', e.target.value)} />
          </Field>
          
          <Field label="Category">
            <select className="input" value={form.category} onChange={e => f('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
            <Field label="Cost (₹)">
              <input type="number" className="input" placeholder="Buy price" value={form.buy_price} onChange={e => f('buy_price', e.target.value)} />
            </Field>
            <Field label="Retail (₹)" required>
              <input type="number" className="input" placeholder="Sell price" value={form.sell_price} onChange={e => f('sell_price', e.target.value)} />
            </Field>
            <Field label="Stock Qty">
              <input type="number" className="input" placeholder="Count" value={form.stock_qty} onChange={e => f('stock_qty', e.target.value)} />
            </Field>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handleAdd} disabled={saving} className="btn-primary" style={{ flex: 1 }}>{saving ? 'Adding...' : 'Save Product'}</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Update Cafeteria Item">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Product Name" required>
            <input className="input" placeholder="e.g. Coca-Cola 300ml" value={editForm.name} onChange={e => ef('name', e.target.value)} />
          </Field>
          
          <Field label="Category">
            <select className="input" value={editForm.category} onChange={e => ef('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
            <Field label="Cost (₹)">
              <input type="number" className="input" placeholder="Buy price" value={editForm.buy_price} onChange={e => ef('buy_price', e.target.value)} />
            </Field>
            <Field label="Retail (₹)" required>
              <input type="number" className="input" placeholder="Sell price" value={editForm.sell_price} onChange={e => ef('sell_price', e.target.value)} />
            </Field>
            <Field label="Stock Qty">
              <input type="number" className="input" placeholder="Count" value={editForm.stock_qty} onChange={e => ef('stock_qty', e.target.value)} />
            </Field>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handleUpdate} disabled={saving} className="btn-primary" style={{ flex: 1 }}>{saving ? 'Updating...' : 'Update Product'}</button>
            <button onClick={() => setShowEdit(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── FOREIGN SALE ───────────────────────────────────────────────
export function WalkInSale() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState({ id: null, name: '', shop_name: '', mobile: '' })
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [payment, setPayment] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.get('/inventory').then(d => setItems(d.items || [])) }, [])

  const handleNameChange = async (val) => {
    setCustomer(c => ({ ...c, name: val }))
    if (val.length >= 2) {
      try {
        const d = await api.get(`/customers?search=${encodeURIComponent(val)}`)
        setCustomerSuggestions(d.customers || [])
      } catch { setCustomerSuggestions([]) }
    } else setCustomerSuggestions([])
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
      const nameErr = validateName(customer.name)
      if (nameErr) { setError(nameErr); return }
    }
    const mobileErr = validateMobile(customer.mobile)
    if (mobileErr) { setError(mobileErr); return }

    setLoading(true); setError('')
    try {
      await api.post('/sales', {
        sale_type: 'walkin',
        date: todayISO(),
        customer_id: customer.id,
        name: customer.name || null,
        shop_name: customer.shop_name || null,
        mobile: customer.mobile || null,
        total,
        payment_received: payment !== '' ? Number(payment) : total,
        payment_method: payMethod,
        items: cart.map(i => ({ item_id: i.id, qty: i.qty, unit_price: i.sell_price }))
      })
      navigate('/inventory')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Foreign Sale</h1>
        <p className="page-sub">Cafeteria sale workstation for outside clients and neighboring shop owners</p>
      </div>

      <ErrorMsg error={error} />
      
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: '1.75rem' }}>
        
        {/* Left Side: Product Grid */}
        <div>
          <p className="label" style={{ marginBottom: '0.75rem' }}>Cafeteria product catalog</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem' }}>
            {items.filter(i => i.stock_qty > 0).map(item => (
              <button key={item.id} onClick={() => addToCart(item)}
                className="card" style={{
                  padding: '1.15rem', display: 'flex', flexDirection: 'column',
                  justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
                  height: '110px'
                }}>
                <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>{item.name}</p>
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
              <Field label="Person Full Name (First & Last Name)">
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
                  <input className="input" placeholder="10 Digits" maxLength={10} value={customer.mobile} onChange={e => setCustomer(c => ({ ...c, mobile: e.target.value }))} />
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
                        <option value="online">Online</option>
                        <option value="credit">Credit / Due</option>
                      </select>
                    </Field>
                  </div>
                  
                  <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.65rem 1.25rem' }}>
                    {loading ? 'Processing Sale...' : 'Finalize Foreign Sale'}
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

// ─── RECHARGES ────────────────────────────────────────────────
export function Recharges() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())

  useEffect(() => { load() }, [dateFilter])
  
  const load = async () => {
    try { setLoading(true); const d = await api.get(`/recharges?date=${dateFilter}`); setItems(d.recharges || []) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Platform Recharges</h1>
          <p className="page-sub">Mobile and in-game RC transaction logs</p>
        </div>
        <Link to="/recharges/new" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>+ New Recharge</Link>
      </div>

      <ErrorMsg error={error} />
      
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.85rem 1.25rem', marginBottom: '1.5rem'
      }}>
        <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input" style={{ width: 'auto', padding: '0.45rem 0.75rem' }} />
      </div>

      {loading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState icon="⚡" title="No Recharges Logged" description={`No platform recharge operations recorded for date: ${formatDate(dateFilter)}`}
          action={<Link to="/recharges/new" className="btn-primary">Add Recharge Log</Link>} />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Client Profile', 'Game Platform', 'System Cost', 'Amount Charged', 'Net Profit', 'Cash Received', 'System Note', 'Operator'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r, idx) => (
                <tr key={r.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                  <td className="table-cell" style={{ fontWeight: 700 }}>{r.name || <span style={{ color: 'var(--text-faint)' }}>Walk-in Client</span>}</td>
                  <td className="table-cell"><span className="badge badge-accent">{r.game_platform || 'Generic'}</span></td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(r.cost_price)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 650 }}>{formatRupees(r.charge_price)}</td>
                  <td className="table-cell">
                    <span className={`badge ${r.margin >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatRupees(r.margin)}
                    </span>
                  </td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.payment_received != null ? formatRupees(r.payment_received) : '—'}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{r.note || '—'}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.725rem', fontWeight: 600 }}>@{r.created_by_username || 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function NewRecharge() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', mobile: '', customer_id: null, game_platform: '', cost_price: '', charge_price: '', payment_received: '', note: '', date: todayISO() })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const margin = form.cost_price && form.charge_price ? Number(form.charge_price) - Number(form.cost_price) : null

  const handleNameChange = async (val) => {
    f('name', val)
    if (val.length >= 2) {
      try { const d = await api.get(`/customers?search=${encodeURIComponent(val)}`); setCustomerSuggestions(d.customers || []) }
      catch { setCustomerSuggestions([]) }
    } else setCustomerSuggestions([])
  }

  const handleSubmit = async () => {
    if (form.name) {
      const nameErr = validateName(form.name)
      if (nameErr) { setError(nameErr); return }
    }
    const mobileErr = validateMobile(form.mobile)
    if (mobileErr) { setError(mobileErr); return }

    if (!form.cost_price || !form.charge_price) { setError('Cost and charge price are required'); return }
    setLoading(true); setError('')

    try {
      await api.post('/recharges', { ...form, cost_price: Number(form.cost_price), charge_price: Number(form.charge_price), payment_received: form.payment_received ? Number(form.payment_received) : null })
      navigate('/recharges')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">New Recharge Entry</h1>
        <p className="page-sub">Log platform, store costs, and margins</p>
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
            <input className="input" placeholder="e.g. BGMI, Steam, EA Play" value={form.game_platform} onChange={e => f('game_platform', e.target.value)} />
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

        {margin !== null && (
          <div style={{ display: 'flex' }}>
            <span className={`badge ${margin >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
              Net Platform Margin: {formatRupees(margin)}
            </span>
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Tender Received (₹)">
            <input type="number" className="input" placeholder="Client cash" value={form.payment_received} onChange={e => f('payment_received', e.target.value)} />
          </Field>
          <Field label="Operational Date">
            <input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} />
          </Field>
        </div>
        
        <Field label="Reference notes">
          <input className="input" placeholder="Transaction IDs, codes..." value={form.note} onChange={e => f('note', e.target.value)} />
        </Field>
        
        <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ padding: '0.65rem 1.35rem' }}>
            {loading ? 'Logging RC...' : 'Log Recharge Entry'}
          </button>
          <button onClick={() => navigate('/recharges')} className="btn-secondary" style={{ padding: '0.65rem 1.35rem' }}>Abort Command</button>
        </div>
      </div>
    </div>
  )
}

// ─── EXPENSES ─────────────────────────────────────────────────
export function Expenses() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())

  useEffect(() => { load() }, [dateFilter])
  
  const load = async () => {
    try { setLoading(true); const d = await api.get(`/expenses?date=${dateFilter}`); setItems(d.expenses || []) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  
  const total = items.reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Expenses Ledger</h1>
          <p className="page-sub">Operating expenditures logs</p>
        </div>
        <Link to="/expenses/new" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>+ Add Expense</Link>
      </div>

      <ErrorMsg error={error} />
      
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: '1.25rem',
        padding: '0.85rem 1.25rem', marginBottom: '1.5rem', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input" style={{ width: 'auto', padding: '0.45rem 0.75rem' }} />
        </div>
        
        {!loading && items.length > 0 && (
          <div className="lcd-screen danger" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em' }}>TOTAL COST:</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(total)}</span>
          </div>
        )}
      </div>

      {loading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState icon="💸" title="No Expenses Logged" description={`No operating costs logged for date: ${formatDate(dateFilter)}`}
          action={<Link to="/expenses/new" className="btn-primary">Log System Expense</Link>} />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Expense Category', 'Bill Amount', 'Reference note', 'Operational Date', 'Operator Logged'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((e, idx) => (
                <tr key={e.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                  <td className="table-cell"><span className="badge badge-warning">{e.category}</span></td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--danger)' }}>{formatRupees(e.amount)}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{e.note || '—'}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatDate(e.date)}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.725rem', fontWeight: 600 }}>@{e.created_by_username || 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function NewExpense() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ category: 'Marketing', amount: '', note: '', date: todayISO() })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Cafeteria expense specific state (restock or add new)
  const [inventory, setInventory] = useState([])
  const [cafeMode, setCafeMode] = useState('existing') // 'existing' | 'new'
  const [itemId, setItemId] = useState('')
  const [units, setUnits] = useState('1')

  // New cafeteria item details (for instant catalog entry)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Drinks')
  const [newItemSellPrice, setNewItemSellPrice] = useState('')

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const CATS = ['Marketing', 'Employee', 'Inventory', 'Other', 'Cafeteria']

  useEffect(() => {
    if (form.category === 'Cafeteria') {
      api.get('/inventory')
        .then(res => setInventory(res.items || []))
        .catch(err => setError('Failed to load inventory: ' + err.message))
    }
  }, [form.category])

  const handleSubmit = async () => {
    if (!form.amount) { setError('Amount is required'); return }
    if (form.category === 'Cafeteria') {
      if (!units || Number(units) <= 0) { setError('Quantity (Units) must be a positive number'); return }
      if (cafeMode === 'existing' && !itemId) { setError('Please select an existing cafeteria item to restock'); return }
      if (cafeMode === 'new') {
        if (!newItemName.trim()) { setError('New item name is required'); return }
        if (!newItemSellPrice || Number(newItemSellPrice) <= 0) { setError('New item selling price must be positive'); return }
      }
    }

    setLoading(true); setError('')
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        units: form.category === 'Cafeteria' ? Number(units) : null,
        item_id: (form.category === 'Cafeteria' && cafeMode === 'existing') ? Number(itemId) : null,
        new_item: (form.category === 'Cafeteria' && cafeMode === 'new') ? {
          name: newItemName.trim(),
          category: newItemCategory,
          sell_price: Number(newItemSellPrice)
        } : null
      }
      await api.post('/expenses', payload)
      navigate('/expenses')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">New Expense Entry</h1>
        <p className="page-sub">Add administrative or inventory purchasing costs</p>
      </div>

      <ErrorMsg error={error} />
      
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Field label="Operating Category" required>
          <select className="input" value={form.category} onChange={e => f('category', e.target.value)}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Cost Amount (₹)" required>
            <input type="number" className="input" placeholder="Amount" value={form.amount} onChange={e => f('amount', e.target.value)} />
          </Field>
          <Field label="Operational Date">
            <input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} />
          </Field>
        </div>

        {form.category === 'Cafeteria' && (
          <div style={{
            background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
            padding: '1.15rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            <p style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
              📦 Cafeteria Inventory Linkage
            </p>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => setCafeMode('existing')}
                className={cafeMode === 'existing' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} style={{ flex: 1, padding: '0.35rem' }}>
                Existing Item
              </button>
              <button type="button" onClick={() => setCafeMode('new')}
                className={cafeMode === 'new' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} style={{ flex: 1, padding: '0.35rem' }}>
                New Item
              </button>
            </div>

            {cafeMode === 'existing' ? (
              <Field label="Select Cafeteria Item to Restock" required>
                <select className="input" value={itemId} onChange={e => setItemId(e.target.value)}>
                  <option value="">-- Choose Item --</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Current Stock: {item.stock_qty})
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Field label="New Item Name" required>
                  <input className="input" placeholder="e.g. Monster Energy" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field label="Category" required>
                    <select className="input" value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)}>
                      <option value="Drinks">Drinks</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                  <Field label="Selling Price (₹)" required>
                    <input type="number" className="input" placeholder="Price" value={newItemSellPrice} onChange={e => setNewItemSellPrice(e.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            <Field label="Total Quantity Received (Units / Pack Size)" required>
              <input type="number" className="input" placeholder="e.g. 24 or 30" value={units} onChange={e => setUnits(e.target.value)} />
            </Field>

            {form.amount && units && Number(units) > 0 && (
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 650 }}>
                Calculated Buy Price: <span style={{ color: 'var(--success)', fontWeight: 800 }}>{formatRupees((Number(form.amount) / Number(units)).toFixed(2))}</span> per unit.
              </p>
            )}
          </div>
        )}
        
        <Field label="Description / Details">
          <input className="input" placeholder="What was this logged for?" value={form.note} onChange={e => f('note', e.target.value)} />
        </Field>
        
        <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ padding: '0.65rem 1.35rem' }}>
            {loading ? 'Storing...' : 'Save Expense Log'}
          </button>
          <button onClick={() => navigate('/expenses')} className="btn-secondary" style={{ padding: '0.65rem 1.35rem' }}>Abort Command</button>
        </div>
      </div>
    </div>
  )
}

// ─── CUSTOMERS ────────────────────────────────────────────────
export function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])
  const load = async () => {
    try { setLoading(true); const d = await api.get('/customers'); setCustomers(d.customers || []) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile?.includes(search)
  )

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Client Registry</h1>
        <p className="page-sub">Auto-accumulated from logged session entries</p>
      </div>

      <ErrorMsg error={error} />
      
      <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: '380px', padding: '0.45rem 0.75rem' }} placeholder="Search client name or mobile registry..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <PageLoader /> : filtered.length === 0 ? (
        <EmptyState icon="👤" title="No Clients Registered" description="Clients register automatically when creating station sessions with names." />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Client Profile Name', 'Mobile Number', 'Member Registration Date', 'Total Session Logs'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                  <td className="table-cell" style={{ fontWeight: 700 }}>{c.name}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{c.mobile || '—'}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatDate(c.created_at)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{c.session_count || 0} sessions</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── REPORTS ──────────────────────────────────────────────────
export function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  useEffect(() => { load() }, [month])
  const load = async () => {
    try { setLoading(true); const d = await api.get(`/reports?month=${month}`); setData(d) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">P&L Reports</h1>
          <p className="page-sub">Monthly profit-and-loss and device utilization analysis</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label className="label" style={{ marginBottom: 0 }}>Report Period</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input" style={{ width: 'auto', padding: '0.45rem 0.75rem' }} />
        </div>
      </div>
      
      <ErrorMsg error={error} />
      
      {loading ? <PageLoader /> : !data ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* P&L LCD Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {[
              { label: 'Gross Revenue', value: data.gross_revenue, state: 'success', sub: 'TOTAL COMBINED LOGS' },
              { label: 'Total Expenses (incl COGS)', value: data.total_expenses, state: 'danger', sub: 'OPERATIONS + COST OF SALES' },
              { label: 'Net Profit', value: data.net_profit, state: data.net_profit >= 0 ? 'success' : 'danger', sub: 'SURPLUS ACCOUNT MARGIN' },
              { label: 'Outstanding Credits', value: data.outstanding_credit, state: 'warning', sub: 'ACCUMULATED UNPAID BILLS' },
            ].map(s => (
              <div key={s.label} className={`lcd-screen ${s.state}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '110px' }}>
                <div>
                  <p style={{ fontSize: '0.675rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>{s.label}</p>
                  <p style={{ fontSize: '1.85rem', fontWeight: 750, marginTop: '0.15rem', letterSpacing: '-0.02em', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(s.value)}</p>
                </div>
                <p style={{ fontSize: '0.625rem', letterSpacing: '0.05em', opacity: 0.6, fontWeight: 600 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Revenue Breakdown vs Expenses COGS breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            
            {/* Revenue breakdown */}
            <div className="card">
              <p className="label" style={{ borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 800 }}>💰 Revenue Streams</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {[
                  { label: 'Gaming Station Sessions', value: data.gaming_revenue },
                  { label: 'Shop Retail Sales (Walk-in)', value: data.walkin_revenue },
                  { label: 'Shop Retail Sales (Seat Tables)', value: data.session_sales_revenue },
                  { label: 'PanCafe Sub-sessions', value: data.pancafe_revenue },
                  { label: 'Console Platform Recharges', value: data.rc_revenue },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.45rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 650 }}>{r.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)' }}>{formatRupees(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Expenses breakdown */}
            <div className="card">
              <p className="label" style={{ borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 800 }}>💸 Expenditures & COGS</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {[
                  { label: 'Operating Expenses (Ledger)', value: data.operating_expenses, badge: 'badge-warning' },
                  { label: 'Inventory Cost of Sales (COGS)', value: data.inventory_cogs, badge: 'badge-neutral' },
                  { label: 'Recharge Purchase Costs (COGS)', value: data.recharges_cogs, badge: 'badge-accent' },
                  { label: 'PanCafe System Top-up Costs (COGS)', value: data.pancafe_cogs, badge: 'badge-accent' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.45rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span className={`badge ${r.badge}`} style={{ fontSize: '0.625rem', padding: '0.15rem 0.35rem' }} />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 650 }}>{r.label}</span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--danger)' }}>{formatRupees(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            
          </div>

          {/* Device utilization */}
          {data.device_stats?.length > 0 && (
            <div className="card">
              <p className="label" style={{ borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 800 }}>🖥️ Device Terminal Utilization</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
                {data.device_stats.map(d => {
                  const percent = Math.min(100, (d.session_count / (data.max_sessions || 1)) * 100)
                  return (
                    <div key={d.device_label} style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.65rem' }}>
                      <span className="badge badge-accent" style={{ width: '4.5rem', justifyContent: 'center' }}>{d.device_label}</span>
                      
                      {/* Skeuomorphic progress slider track */}
                      <div style={{
                        flex: 1, height: '0.85rem', background: 'var(--bg-input)',
                        borderRadius: '99px', border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-inset)', overflow: 'hidden', padding: '2px'
                      }}>
                        <div style={{
                          height: '100%', width: `${percent}%`,
                          background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%)',
                          borderRadius: '99px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)'
                        }} />
                      </div>
                      
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', color: 'var(--text-muted)', width: '6.5rem', textAlign: 'right' }}>
                        {d.session_count} sessions
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem', color: 'var(--accent-text)', fontWeight: 700, width: '6.5rem', textAlign: 'right' }}>
                        {formatRupees(d.total_revenue)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SETTINGS ─────────────────────────────────────────────────
export function Settings() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.username === 'trial'

  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', username: '', pin: '' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [resettingUser, setResettingUser] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [auditData, setAuditData] = useState({ logs: [], sessions: [] })
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  useEffect(() => { load() }, [])
  const load = async () => {
    try {
      setLoading(true)
      const [u, s] = await Promise.all([api.get('/users'), api.get('/settings')])
      setUsers(u.users || [])
      setSettings(s.settings || [])
      if (isAdmin) {
        const audit = await api.get('/auth?action=audit')
        setAuditData(audit || { logs: [], sessions: [] })
      }
    }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleAddUser = async () => {
    if (!newUser.full_name || !newUser.username || newUser.pin.length !== 4) { setError('All fields required. PIN must be 4 digits.'); return }
    setSaving(true)
    try {
      await api.post('/users', newUser)
      setShowAddUser(false); setNewUser({ full_name: '', username: '', pin: '' }); load()
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Add Staff Member' })
      }
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleResetPin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    setResetSaving(true)
    setError('')
    try {
      await api.put(`/users?id=${resettingUser.id}`, { pin: newPin })
      setResettingUser(null)
      setNewPin('')
      setSaveMsg('Security PIN reset successfully!')
      setTimeout(() => setSaveMsg(''), 2000)
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Reset Security PIN' })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setResetSaving(false)
    }
  }

  const handleSettingChange = (key, value) => {
    setSettings(s => s.map(r => r.key === key ? { ...r, value } : r))
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.post('/settings', { settings })
      setSaveMsg('Configuration updated!')
      setTimeout(() => setSaveMsg(''), 2000)
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Modify System Settings' })
      }
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [purging, setPurging] = useState(false)

  const handlePurgeData = async () => {
    setPurging(true)
    setError('')
    try {
      await api.post('/purge')
      setShowPurgeModal(false)
      setSaveMsg('Production reset complete! Test data purged.')
      setTimeout(() => setSaveMsg(''), 3000)
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Purge Transactional Logs' })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setPurging(false)
    }
  }

  const EDITABLE_SETTINGS = ['controller_fee', 'extra_person_fee', 'extra_person_from']

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => setTrialModal({ isOpen: false, action: '' })} />
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Settings Console</h1>
        <p className="page-sub">Manage system variables and staff directory</p>
      </div>
      
      <ErrorMsg error={error} />

      {/* Staff management panel */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Staff Registry</p>
          <button onClick={() => setShowAddUser(true)} className="btn-primary btn-sm">+ Add Staff</button>
        </div>
        
        {loading ? <PageLoader /> : users.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Empty user records</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.map((u, idx) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem', padding: '0.65rem 0.75rem',
                background: idx % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent',
                borderBottom: idx < users.length - 1 ? '1px solid var(--border)' : 'none',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--accent-dim)',
                    border: '1.5px solid var(--accent-border)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.85rem', fontWeight: 750, color: 'var(--accent-text)'
                  }}>
                    {u.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>{u.full_name}</p>
                    <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 550, fontFamily: "'JetBrains Mono', monospace" }}>
                      @{u.username}
                      <span style={{ textTransform: 'capitalize', fontSize: '0.65rem', background: 'var(--accent-dim)', padding: '0.1rem 0.35rem', borderRadius: '4px', color: 'var(--accent-text)', marginLeft: '0.35rem' }}>
                        {u.role || 'operator'}
                      </span>
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => setResettingUser(u)} className="btn-secondary btn-sm" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                    Reset PIN
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System variables configurations panel */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>System Variables</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {settings.filter(s => EDITABLE_SETTINGS.includes(s.key)).map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <label className="label" style={{ marginBottom: 0, textTransform: 'capitalize', fontSize: '0.85rem' }}>
                {s.key.replace(/_/g, ' ')}
              </label>
              <input type="number" className="input" style={{ width: '8.5rem', textAlign: 'right' }} value={s.value}
                onChange={e => handleSettingChange(s.key, e.target.value)} />
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
          <button onClick={saveSettings} disabled={saving} className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
            {saving ? 'Updating...' : 'Save Settings'}
          </button>
          {saveMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="led-indicator led-green" style={{ width: '6px', height: '6px' }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 650 }}>{saveMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Security & Audit Trail (Admin Only) */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
            🔒 Security & Audit Trail
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Login Sessions */}
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.65rem' }}>Operator Login Sessions</p>
              {auditData.sessions?.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No operator sessions logged.</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table className="tbl" style={{ fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th>Operator</th>
                        <th>Logged In</th>
                        <th>Logged Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditData.sessions?.map(sess => (
                        <tr key={sess.id}>
                          <td style={{ fontWeight: 700, color: 'var(--text)' }}>@{sess.username}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{new Date(sess.login_at).toLocaleString('en-IN')}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {sess.logout_at ? new Date(sess.logout_at).toLocaleString('en-IN') : (
                              <span className="badge-active-session animate-pulse" style={{ fontSize: '0.65rem' }}>ACTIVE NOW</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Audit Logs */}
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.65rem' }}>Critical System Audit Logs</p>
              {auditData.logs?.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No audit events logged.</p>
              ) : (
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table className="tbl" style={{ fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Action</th>
                        <th>Details</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditData.logs?.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontWeight: 700, color: 'var(--text)' }}>@{log.username || 'system'}</td>
                          <td>
                            <span className="badge badge-accent" style={{ fontSize: '0.6rem' }}>{log.action}</span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>{log.details}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--text-faint)' }}>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Production Cleanup / Purge Section */}
      <div className="card" style={{ border: '1.5px solid var(--danger-border)', background: 'var(--danger-dim)' }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.45rem' }}>
          Production Data Purge & System Reset
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '1.25rem' }}>
          Purge test sessions, sales, expenses, recharges, and daily opening records to prepare your console for production. Pricing rules, devices, and user accounts will remain intact.
        </p>
        <button onClick={() => setShowPurgeModal(true)} className="btn-danger" style={{ padding: '0.6rem 1.25rem' }}>
          Purge Test Data
        </button>
      </div>

      {/* Add Staff Modal */}
      <Modal open={showAddUser} onClose={() => setShowAddUser(false)} title="Add Console Staff Account">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Full Name" required>
            <input className="input" placeholder="e.g. Rahul Sharma" value={newUser.full_name} onChange={e => setNewUser(u => ({...u, full_name: e.target.value}))} />
          </Field>
          <Field label="Console Username" required>
            <input className="input" placeholder="e.g. rahul88" value={newUser.username} onChange={e => setNewUser(u => ({...u, username: e.target.value}))} />
          </Field>
          <Field label="4-digit Security PIN" required>
            <input type="password" inputMode="numeric" maxLength={4} className="input" placeholder="Numeric pin code" value={newUser.pin} onChange={e => setNewUser(u => ({...u, pin: e.target.value}))} />
          </Field>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handleAddUser} disabled={saving} className="btn-primary" style={{ flex: 1 }}>{saving ? 'Creating...' : 'Create Account'}</button>
            <button onClick={() => setShowAddUser(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Purge Confirmation Modal */}
      <Modal open={showPurgeModal} onClose={() => setShowPurgeModal(false)} title="Purge Test Data for Production">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Are you sure you want to <strong>purge all transactional test data</strong>? This will clear all logged sessions, sales, expenses, and opening balances to leave your database clean for live production use.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handlePurgeData} disabled={purging} className="btn-danger" style={{ flex: 1 }}>
              {purging ? 'Purging Data...' : 'Confirm Reset & Purge'}
            </button>
            <button onClick={() => setShowPurgeModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Reset PIN Modal */}
      <Modal open={!!resettingUser} onClose={() => setResettingUser(null)} title={`Reset PIN for ${resettingUser?.full_name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="New 4-digit Security PIN" required>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="input"
              placeholder="Enter new 4-digit PIN"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handleResetPin} disabled={resetSaving} className="btn-primary" style={{ flex: 1 }}>
              {resetSaving ? 'Saving...' : 'Update PIN'}
            </button>
            <button onClick={() => setResettingUser(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── EOD RECONCILIATION ───────────────────────────────────────

export function EODReconciliation() {
  const [snapshot, setSnapshot] = useState(null)
  const [opening, setOpening] = useState(null)
  const [rcData, setRcData] = useState({ cash: 0, online: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actualCash, setActualCash] = useState('')
  const today = new Date().toLocaleDateString('en-CA')

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [snap, openR, rcR] = await Promise.all([
        api.get('/dashboard-snapshot'),
        api.get(`/day-openings?date=${today}`),
        api.get(`/recharges?date=${today}`),
      ])
      setSnapshot(snap)
      setOpening(openR.opening)
      // Compute recharge cash/online
      const recharges = rcR.recharges || []
      setRcData({
        cash: recharges.filter(r => r.payment_method === 'cash').reduce((s, r) => s + Number(r.payment_received || r.charge_price), 0),
        online: recharges.filter(r => r.payment_method === 'online').reduce((s, r) => s + Number(r.payment_received || r.charge_price), 0),
      })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const openingCash = Number(opening?.opening_cash || 0)

  const cashInflows = snapshot
    ? Number(snapshot.cash_gaming || 0) +
      Number(snapshot.cash_sales || 0) +
      Number(snapshot.cash_pancafe || 0) +
      rcData.cash
    : 0

  const onlineInflows = snapshot
    ? Number(snapshot.online_gaming || 0) +
      Number(snapshot.online_sales || 0) +
      Number(snapshot.online_pancafe || 0) +
      rcData.online
    : 0

  const cashOutflows = Number(snapshot?.cash_expenses || 0)
  const expectedCash = openingCash + cashInflows - cashOutflows
  const actualNum = actualCash !== '' ? Number(actualCash) : null
  const variance = actualNum !== null ? actualNum - expectedCash : null

  const Row = ({ label, cash, online, highlight }) => (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      gap: '0.5rem', padding: '0.65rem 0',
      borderBottom: '1px dashed var(--border)',
      fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem'
    }}>
      <span style={{ color: highlight ? 'var(--text)' : 'var(--text-muted)', fontWeight: highlight ? 750 : 600 }}>{label}</span>
      <span style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 650 }}>{formatRupees(cash)}</span>
      <span style={{ textAlign: 'right', color: 'var(--accent-text)', fontWeight: 650 }}>{formatRupees(online)}</span>
    </div>
  )

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">End of Day Reconciliation</h1>
        <p className="page-sub">Cash drawer balance check · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <ErrorMsg error={error} />

      {loading ? <PageLoader /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Opening balance */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
            <div>
              <p style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opening Cash Balance</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', marginTop: '0.15rem' }}>{formatRupees(openingCash)}</p>
            </div>
            {opening
              ? <span className="badge badge-success">Set at {new Date(opening.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              : <span className="badge badge-danger">Not set today</span>}
          </div>

          {/* Inflows breakdown */}
          <div className="card">
            <p style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
              💰 Today's Inflows
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase' }}>Category</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Cash</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-text)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Online</span>
            </div>
            {snapshot && <>
              <Row label="Gaming Sessions" cash={snapshot.cash_gaming} online={snapshot.online_gaming} />
              <Row label="Shop Sales" cash={snapshot.cash_sales} online={snapshot.online_sales} />
              <Row label="PanCafe" cash={snapshot.cash_pancafe} online={snapshot.online_pancafe} />
              <Row label="Recharges" cash={rcData.cash} online={rcData.online} />
              <Row label="TOTAL INFLOWS" cash={cashInflows} online={onlineInflows} highlight />
            </>}
          </div>

          {/* Cash outflows */}
          <div className="card">
            <p style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
              💸 Cash Outflows (Expenses)
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ color: 'var(--text-muted)' }}>Expenses paid in cash</span>
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatRupees(cashOutflows)}</span>
            </div>
          </div>

          {/* Expected vs Actual */}
          <div className="card" style={{ background: 'var(--bg-elevated)' }}>
            <p style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
              🧾 Cash Drawer Summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Opening cash</span>
                <span>{formatRupees(openingCash)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>+ Cash collected today</span>
                <span style={{ color: 'var(--success)' }}>+{formatRupees(cashInflows)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>− Cash expenses</span>
                <span style={{ color: 'var(--danger)' }}>−{formatRupees(cashOutflows)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px dashed var(--border)', paddingTop: '0.5rem', fontWeight: 800, fontSize: '1rem' }}>
                <span>Expected in drawer</span>
                <span style={{ color: 'var(--accent-text)' }}>{formatRupees(expectedCash)}</span>
              </div>
            </div>

            {snapshot?.total_outstanding_credit > 0 && (
              <div style={{ padding: '0.65rem 1rem', borderRadius: '10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: 'var(--danger)', fontWeight: 650 }}>Outstanding credits (not in drawer)</span>
                <span style={{ color: 'var(--danger)', fontWeight: 800 }}>{formatRupees(snapshot.total_outstanding_credit)}</span>
              </div>
            )}

            <Field label="Actual cash counted in drawer (₹)">
              <input type="number" className="input" placeholder="Count and enter physical cash"
                value={actualCash} onChange={e => setActualCash(e.target.value)} />
            </Field>

            {variance !== null && (
              <div style={{
                marginTop: '1rem', padding: '0.85rem 1.25rem', borderRadius: '12px',
                background: Math.abs(variance) < 1 ? 'rgba(34,197,94,0.1)' : 'rgba(220,38,38,0.1)',
                border: `1.5px solid ${Math.abs(variance) < 1 ? 'var(--success)' : 'var(--danger)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: "'JetBrains Mono', monospace"
              }}>
                <span style={{ fontWeight: 700, color: Math.abs(variance) < 1 ? 'var(--success)' : 'var(--danger)' }}>
                  {Math.abs(variance) < 1 ? '✓ Drawer balanced' : variance > 0 ? '↑ Cash over' : '↓ Cash short'}
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: Math.abs(variance) < 1 ? 'var(--success)' : 'var(--danger)' }}>
                  {variance > 0 ? '+' : ''}{formatRupees(variance)}
                </span>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}


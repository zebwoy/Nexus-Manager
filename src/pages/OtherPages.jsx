import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatDate, todayISO } from '../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, Field, Modal } from '../components/UI'
import { Plus, Trash2, ShoppingBag } from 'lucide-react'

// ─── INVENTORY ────────────────────────────────────────────────
export function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    try { setLoading(true); const d = await api.get('/inventory'); setItems(d.items || []) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleAdd = async () => {
    if (!form.name || !form.sell_price) { return }
    setSaving(true)
    try {
      await api.post('/inventory', { ...form, buy_price: Number(form.buy_price || 0), sell_price: Number(form.sell_price), stock_qty: Number(form.stock_qty || 0) })
      setShowAdd(false); setForm({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' }); load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const CATEGORIES = ['Drinks', 'Snacks', 'Other']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Inventory Stock</h1>
          <p className="page-sub">Cafe refreshments and hardware stock levels</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/inventory/sell" className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}><ShoppingBag size={15} />Open Cash Register</Link>
          <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>+ Add Item</button>
        </div>
      </div>
      
      <ErrorMsg error={error} />
      
      {loading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState icon="📦" title="No Items in Stock" description="Log products to track inventory and calculate accurate profits."
          action={<button onClick={() => setShowAdd(true)} className="btn-primary">Add Item</button>} />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Item name', 'Category', 'Unit Cost', 'Retail Price', 'Stock Level', 'Terminal Status'].map(h => (
                  <th key={h}>{h}</th>
                ))}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="➕ Add Inventory Stock Item">
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
    </div>
  )
}

// ─── WALK-IN SALE (CASH REGISTER) ──────────────────────────────
export function WalkInSale() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [cart, setCart] = useState([])
  const [payment, setPayment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.get('/inventory').then(d => setItems(d.items || [])) }, [])

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
    setLoading(true); setError('')
    try {
      await api.post('/sales', {
        sale_type: 'walkin', date: todayISO(),
        total, payment_received: payment ? Number(payment) : total,
        items: cart.map(i => ({ item_id: i.id, qty: i.qty, unit_price: i.sell_price }))
      })
      navigate('/inventory')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Walk-in Cash Register</h1>
        <p className="page-sub">Direct retail sale workstation — not attached to gaming stations</p>
      </div>

      <ErrorMsg error={error} />
      
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: '1.75rem' }}>
        
        {/* Left Side: Product Grid */}
        <div>
          <p className="label" style={{ marginBottom: '0.75rem' }}>Product catalog selection</p>
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

        {/* Right Side: Cash Register Cart Receipt */}
        <div>
          <p className="label" style={{ marginBottom: '0.75rem' }}>Cashier invoice cart</p>
          <div className="card" style={{ padding: '1.25rem' }}>
            {cart.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Register empty</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
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
                    <span style={{ color: 'var(--text)' }}>RETAIL TOTAL</span>
                    <span style={{ color: 'var(--accent-text)' }}>{formatRupees(total)}</span>
                  </div>
                  
                  <Field label="Cash Tendered (₹)">
                    <input type="number" className="input" placeholder={total} value={payment} onChange={e => setPayment(e.target.value)} />
                  </Field>
                  
                  <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '1.15rem', padding: '0.65rem 1.25rem' }}>
                    {loading ? 'Processing Sale...' : 'Finalize Transaction'}
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
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const CATS = ['Marketing', 'Employee', 'Inventory', 'Other']

  const handleSubmit = async () => {
    if (!form.amount) { setError('Amount is required'); return }
    setLoading(true); setError('')
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount) })
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
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', username: '', pin: '' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => { load() }, [])
  const load = async () => {
    try { setLoading(true); const [u, s] = await Promise.all([api.get('/users'), api.get('/settings')]); setUsers(u.users || []); setSettings(s.settings || []) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleAddUser = async () => {
    if (!newUser.full_name || !newUser.username || newUser.pin.length !== 4) { setError('All fields required. PIN must be 4 digits.'); return }
    setSaving(true)
    try {
      await api.post('/users', newUser)
      setShowAddUser(false); setNewUser({ full_name: '', username: '', pin: '' }); load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
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
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const EDITABLE_SETTINGS = ['controller_fee', 'extra_person_fee', 'extra_person_from']

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Settings Console</h1>
        <p className="page-sub">Manage system variables and staff directory</p>
      </div>
      
      <ErrorMsg error={error} />

      {/* Staff management panel */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>👥 Staff Registry</p>
          <button onClick={() => setShowAddUser(true)} className="btn-primary btn-sm">+ Add Staff</button>
        </div>
        
        {loading ? <PageLoader /> : users.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Empty user records</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.map((u, idx) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.65rem 0.75rem',
                background: idx % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent',
                borderBottom: idx < users.length - 1 ? '1px solid var(--border)' : 'none',
                borderRadius: '8px'
              }}>
                <div style={{
                  width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--accent-dim)',
                  border: '1.5px solid var(--accent-border)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.85rem', fontWeight: 750, color: 'var(--accent-text)'
                }}>
                  {u.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>{u.full_name}</p>
                  <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 550, fontFamily: "'JetBrains Mono', monospace" }}>@{u.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System variables configurations panel */}
      <div className="card">
        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>🎛️ System Variables</p>
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

      {/* Add Staff Modal */}
      <Modal open={showAddUser} onClose={() => setShowAddUser(false)} title="➕ Add Console Staff Account">
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
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatDate, todayISO } from '../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, Field, Spinner, Modal } from '../components/UI'

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
      await api.post('/inventory', { ...form, buy_price: Number(form.buy_price), sell_price: Number(form.sell_price), stock_qty: Number(form.stock_qty) })
      setShowAdd(false); setForm({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' }); load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const CATEGORIES = ['Drinks', 'Snacks', 'Other']

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div><h1 className="page-title">Inventory</h1><p className="page-subtitle">Stock management</p></div>
        <div className="flex gap-3">
          <Link to="/inventory/sell" className="btn-secondary">Walk-in Sale</Link>
          <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Item</button>
        </div>
      </div>
      <ErrorMsg error={error} />
      {loading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState icon="📦" title="No items" description="Add your first inventory item"
          action={<button onClick={() => setShowAdd(true)} className="btn-primary">Add Item</button>} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead><tr>{['Item', 'Category', 'Buy Price', 'Sell Price', 'Stock', 'Status'].map(h =>
              <th key={h} className="table-header text-left">{h}</th>)}</tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="hover:bg-surface-800/50">
                  <td className="table-cell font-semibold text-white">{item.name}</td>
                  <td className="table-cell"><span className="badge badge-blue">{item.category}</span></td>
                  <td className="table-cell font-mono">{formatRupees(item.buy_price)}</td>
                  <td className="table-cell font-mono">{formatRupees(item.sell_price)}</td>
                  <td className="table-cell font-mono">{item.stock_qty}</td>
                  <td className="table-cell">
                    {item.stock_qty <= 0
                      ? <span className="badge badge-red">Out of stock</span>
                      : item.stock_qty <= 5
                        ? <span className="badge badge-yellow">Low stock</span>
                        : <span className="badge badge-green">In stock</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Inventory Item">
        <div className="space-y-4">
          <Field label="Item Name" required><input className="input" value={form.name} onChange={e => f('name', e.target.value)} /></Field>
          <Field label="Category"><select className="input" value={form.category} onChange={e => f('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Buy Price (₹)"><input type="number" className="input" value={form.buy_price} onChange={e => f('buy_price', e.target.value)} /></Field>
            <Field label="Sell Price (₹)" required><input type="number" className="input" value={form.sell_price} onChange={e => f('sell_price', e.target.value)} /></Field>
            <Field label="Opening Stock"><input type="number" className="input" value={form.stock_qty} onChange={e => f('stock_qty', e.target.value)} /></Field>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleAdd} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Add Item'}</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── WALK-IN SALE ─────────────────────────────────────────────
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
    <div className="max-w-4xl">
      <div className="page-header"><h1 className="page-title">Walk-in Sale</h1><p className="page-subtitle">Direct shop sale — not linked to a session</p></div>
      <ErrorMsg error={error} />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <p className="label mb-3">Select Items</p>
          <div className="grid grid-cols-2 gap-3">
            {items.filter(i => i.stock_qty > 0).map(item => (
              <button key={item.id} onClick={() => addToCart(item)}
                className="card text-left hover:border-brand-600/50 transition-colors">
                <p className="font-semibold text-white">{item.name}</p>
                <div className="flex justify-between mt-1">
                  <span className="badge badge-blue">{item.category}</span>
                  <span className="font-mono text-brand-400">{formatRupees(item.sell_price)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono">Stock: {item.stock_qty}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label mb-3">Cart</p>
          <div className="card space-y-3">
            {cart.length === 0 ? <p className="text-slate-500 text-sm text-center py-4">No items selected</p> : (
              <>
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between border-b border-surface-700 pb-2 last:border-0">
                    <div>
                      <p className="text-sm text-white">{item.name}</p>
                      <p className="text-xs font-mono text-slate-400">{formatRupees(item.sell_price)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-6 h-6 rounded bg-surface-700 text-white text-sm">−</button>
                      <span className="font-mono text-white w-5 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-6 h-6 rounded bg-surface-700 text-white text-sm">+</button>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-surface-700">
                  <div className="flex justify-between font-mono font-bold text-white mb-3">
                    <span>Total</span><span className="text-brand-400">{formatRupees(total)}</span>
                  </div>
                  <Field label="Payment Received (₹)">
                    <input type="number" className="input" placeholder={total} value={payment} onChange={e => setPayment(e.target.value)} />
                  </Field>
                  <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full mt-3 disabled:opacity-50">
                    {loading ? 'Saving...' : 'Complete Sale'}
                  </button>
                </div>
              </>
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
      <div className="page-header flex items-center justify-between">
        <div><h1 className="page-title">Recharges</h1><p className="page-subtitle">In-game RC log</p></div>
        <Link to="/recharges/new" className="btn-primary">+ New Recharge</Link>
      </div>
      <ErrorMsg error={error} />
      <div className="flex items-center gap-4 mb-4">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input w-auto" />
      </div>
      {loading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState icon="⚡" title="No recharges" description="No recharges for this date"
          action={<Link to="/recharges/new" className="btn-primary">Add Recharge</Link>} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead><tr>{['Customer', 'Platform', 'Cost', 'Charged', 'Margin', 'Payment', 'Note', 'Logged By'].map(h =>
              <th key={h} className="table-header text-left">{h}</th>)}</tr></thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} className="hover:bg-surface-800/50">
                  <td className="table-cell">{r.name || '—'}</td>
                  <td className="table-cell"><span className="badge badge-blue">{r.game_platform || '—'}</span></td>
                  <td className="table-cell font-mono">{formatRupees(r.cost_price)}</td>
                  <td className="table-cell font-mono">{formatRupees(r.charge_price)}</td>
                  <td className="table-cell"><span className="badge badge-green">{formatRupees(r.margin)}</span></td>
                  <td className="table-cell font-mono">{r.payment_received != null ? formatRupees(r.payment_received) : '—'}</td>
                  <td className="table-cell text-slate-400 text-xs">{r.note || '—'}</td>
                  <td className="table-cell text-slate-500 text-xs font-mono">{r.created_by_username || '—'}</td>
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
    if (val.length >= 2) { try { const d = await api.get(`/customers?search=${encodeURIComponent(val)}`); setCustomerSuggestions(d.customers || []) } catch { setCustomerSuggestions([]) } }
    else setCustomerSuggestions([])
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
    <div className="max-w-lg">
      <div className="page-header"><h1 className="page-title">New Recharge</h1><p className="page-subtitle">Log an in-game RC transaction</p></div>
      <ErrorMsg error={error} />
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer Name">
            <div className="relative">
              <input className="input" placeholder="Optional" value={form.name} onChange={e => handleNameChange(e.target.value)} />
              {customerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 bg-surface-800 border border-surface-700 rounded-lg mt-1 overflow-hidden shadow-xl">
                  {customerSuggestions.map(c => (<button key={c.id} onClick={() => { f('name', c.name); f('mobile', c.mobile||''); f('customer_id', c.id); setCustomerSuggestions([]) }} className="w-full text-left px-3 py-2 hover:bg-surface-700 text-sm"><span className="text-white">{c.name}</span></button>))}
                </div>
              )}
            </div>
          </Field>
          <Field label="Game Platform"><input className="input" placeholder="e.g. BGMI, FreeFire" value={form.game_platform} onChange={e => f('game_platform', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Your Cost (₹)" required><input type="number" className="input" value={form.cost_price} onChange={e => f('cost_price', e.target.value)} /></Field>
          <Field label="Amount Charged to Customer (₹)" required><input type="number" className="input" value={form.charge_price} onChange={e => f('charge_price', e.target.value)} /></Field>
        </div>
        {margin !== null && <div className="flex gap-2"><span className="badge badge-green">Margin: {formatRupees(margin)}</span></div>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment Received (₹)"><input type="number" className="input" value={form.payment_received} onChange={e => f('payment_received', e.target.value)} /></Field>
          <Field label="Date"><input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} /></Field>
        </div>
        <Field label="Note"><input className="input" placeholder="Optional" value={form.note} onChange={e => f('note', e.target.value)} /></Field>
        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={loading} className="btn-primary disabled:opacity-50">{loading ? 'Saving...' : 'Save Recharge'}</button>
          <button onClick={() => navigate('/recharges')} className="btn-secondary">Cancel</button>
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
      <div className="page-header flex items-center justify-between">
        <div><h1 className="page-title">Expenses</h1><p className="page-subtitle">Daily expense log</p></div>
        <Link to="/expenses/new" className="btn-primary">+ Add Expense</Link>
      </div>
      <ErrorMsg error={error} />
      <div className="flex items-center gap-4 mb-4">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input w-auto" />
        {!loading && items.length > 0 && <span className="stat-label ml-auto">Total: <span className="text-red-400 font-mono">{formatRupees(total)}</span></span>}
      </div>
      {loading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState icon="💸" title="No expenses" description="No expenses for this date"
          action={<Link to="/expenses/new" className="btn-primary">Add Expense</Link>} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead><tr>{['Category', 'Amount', 'Note', 'Date', 'Logged By'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr></thead>
            <tbody>
              {items.map(e => (
                <tr key={e.id} className="hover:bg-surface-800/50">
                  <td className="table-cell"><span className="badge badge-yellow">{e.category}</span></td>
                  <td className="table-cell font-mono text-red-400">{formatRupees(e.amount)}</td>
                  <td className="table-cell text-slate-400 text-sm">{e.note || '—'}</td>
                  <td className="table-cell font-mono text-sm text-slate-400">{formatDate(e.date)}</td>
                  <td className="table-cell text-slate-500 text-xs font-mono">{e.created_by_username || '—'}</td>
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
    <div className="max-w-md">
      <div className="page-header"><h1 className="page-title">New Expense</h1><p className="page-subtitle">Log a business expense</p></div>
      <ErrorMsg error={error} />
      <div className="card space-y-4">
        <Field label="Category" required><select className="input" value={form.category} onChange={e => f('category', e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount (₹)" required><input type="number" className="input" value={form.amount} onChange={e => f('amount', e.target.value)} /></Field>
          <Field label="Date"><input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} /></Field>
        </div>
        <Field label="Note"><input className="input" placeholder="What was this for?" value={form.note} onChange={e => f('note', e.target.value)} /></Field>
        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={loading} className="btn-primary disabled:opacity-50">{loading ? 'Saving...' : 'Save Expense'}</button>
          <button onClick={() => navigate('/expenses')} className="btn-secondary">Cancel</button>
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
      <div className="page-header"><h1 className="page-title">Customers</h1><p className="page-subtitle">Auto-built from sessions</p></div>
      <ErrorMsg error={error} />
      <div className="mb-4">
        <input className="input max-w-sm" placeholder="Search by name or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? <PageLoader /> : filtered.length === 0 ? (
        <EmptyState icon="👤" title="No customers yet" description="Customers are created automatically when you log sessions with a name" />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead><tr>{['Name', 'Mobile', 'Member Since', 'Total Sessions'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-surface-800/50">
                  <td className="table-cell font-semibold text-white">{c.name}</td>
                  <td className="table-cell font-mono text-slate-400">{c.mobile || '—'}</td>
                  <td className="table-cell text-slate-400 text-sm">{formatDate(c.created_at)}</td>
                  <td className="table-cell font-mono">{c.session_count || 0}</td>
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
      <div className="page-header flex items-center justify-between">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Monthly P&L and analytics</p></div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input w-auto" />
      </div>
      <ErrorMsg error={error} />
      {loading ? <PageLoader /> : !data ? null : (
        <div className="space-y-6">
          {/* P&L Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Gross Revenue', value: data.gross_revenue, color: 'text-brand-400' },
              { label: 'Total Expenses', value: data.total_expenses, color: 'text-red-400' },
              { label: 'Net Profit', value: data.net_profit, color: data.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Credits Outstanding', value: data.outstanding_credit, color: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <span className="stat-label">{s.label}</span>
                <span className={`stat-value ${s.color}`}>{formatRupees(s.value)}</span>
              </div>
            ))}
          </div>

          {/* Revenue breakdown */}
          <div className="card">
            <h2 className="font-display font-semibold text-white mb-4 tracking-wide">Revenue Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: 'Gaming Sessions', value: data.gaming_revenue },
                { label: 'Shop Sales (Walk-in)', value: data.walkin_revenue },
                { label: 'Shop Sales (Session)', value: data.session_sales_revenue },
                { label: 'PanCafe (received)', value: data.pancafe_revenue },
                { label: 'RC Recharges (charged)', value: data.rc_revenue },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between border-b border-surface-800 pb-2 last:border-0">
                  <span className="text-slate-400 text-sm">{r.label}</span>
                  <span className="font-mono text-white">{formatRupees(r.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Device utilization */}
          {data.device_stats?.length > 0 && (
            <div className="card">
              <h2 className="font-display font-semibold text-white mb-4 tracking-wide">Device Utilization</h2>
              <div className="space-y-2">
                {data.device_stats.map(d => (
                  <div key={d.device_label} className="flex items-center gap-4 border-b border-surface-800 pb-2 last:border-0">
                    <span className="badge badge-blue w-16 justify-center">{d.device_label}</span>
                    <div className="flex-1">
                      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.min(100, (d.session_count / (data.max_sessions || 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="font-mono text-sm text-slate-300 w-20 text-right">{d.session_count} sessions</span>
                    <span className="font-mono text-sm text-brand-400 w-24 text-right">{formatRupees(d.total_revenue)}</span>
                  </div>
                ))}
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
      setSaveMsg('Settings saved!')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const EDITABLE_SETTINGS = ['controller_fee', 'extra_person_fee', 'extra_person_from']

  return (
    <div className="max-w-2xl">
      <div className="page-header"><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage users and system configuration</p></div>
      <ErrorMsg error={error} />

      {/* Staff Management */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-white tracking-wide">Staff Accounts</h2>
          <button onClick={() => setShowAddUser(true)} className="btn-primary text-sm py-1.5">+ Add Staff</button>
        </div>
        {loading ? <PageLoader /> : users.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No users yet</p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 py-2 border-b border-surface-800 last:border-0">
                <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
                  {u.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{u.full_name}</p>
                  <p className="text-xs font-mono text-slate-500">@{u.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Settings */}
      <div className="card">
        <h2 className="font-display font-semibold text-white tracking-wide mb-4">System Settings</h2>
        <div className="space-y-4">
          {settings.filter(s => EDITABLE_SETTINGS.includes(s.key)).map(s => (
            <div key={s.key} className="flex items-center gap-4">
              <label className="label mb-0 w-56 capitalize">{s.key.replace(/_/g, ' ')}</label>
              <input type="number" className="input w-32" value={s.value}
                onChange={e => handleSettingChange(s.key, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={saveSettings} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saveMsg && <span className="text-emerald-400 text-sm">{saveMsg}</span>}
        </div>
      </div>

      {/* Add User Modal */}
      <Modal open={showAddUser} onClose={() => setShowAddUser(false)} title="Add Staff Account">
        <div className="space-y-4">
          <Field label="Full Name" required><input className="input" value={newUser.full_name} onChange={e => setNewUser(u => ({...u, full_name: e.target.value}))} /></Field>
          <Field label="Username" required><input className="input" placeholder="e.g. rahul99" value={newUser.username} onChange={e => setNewUser(u => ({...u, username: e.target.value}))} /></Field>
          <Field label="4-digit PIN" required><input type="password" inputMode="numeric" maxLength={4} className="input" value={newUser.pin} onChange={e => setNewUser(u => ({...u, pin: e.target.value}))} /></Field>
          <div className="flex gap-3 pt-2">
            <button onClick={handleAddUser} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Creating...' : 'Create Account'}</button>
            <button onClick={() => setShowAddUser(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

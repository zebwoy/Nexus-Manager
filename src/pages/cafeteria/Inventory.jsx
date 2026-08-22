import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, showUndoToast } from '../../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, Field, Modal, TrialWarningModal, ConfirmModal, Spinner } from '../../components/UI'
import { ShoppingBag, Edit3, Trash2, Plus, Package } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'

const CATEGORIES = ['Drinks', 'Snacks', 'Other']

export default function Inventory() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.username === 'trial'
  const isRealAdmin = user?.role === 'admin' && user?.username !== 'trial'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
  
  const [showEdit, setShowEdit] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
  
  const [activePopover, setActivePopover] = useState(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 })
  const [saving, setSaving] = useState(false)
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  useEffect(() => { load() }, [])
  useEffect(() => {
    const handleClose = () => setActivePopover(null)
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const d = await api.get('/inventory')
      setItems(d.items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const ef = (k, v) => setEditForm(prev => ({ ...prev, [k]: v }))

  const handleAdd = async () => {
    if (!form.name || !form.sell_price) { setError('Name and retail price are required'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/inventory', {
        ...form,
        buy_price: form.buy_price ? Number(form.buy_price) : 0,
        sell_price: Number(form.sell_price),
        stock_qty: form.stock_qty ? Number(form.stock_qty) : 0,
      })
      setShowAdd(false)
      setForm({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
      load()
      toast.success('Product added to inventory')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEdit = (item) => {
    setEditItem(item)
    setEditForm({
      name: item.name,
      category: item.category,
      buy_price: item.buy_price,
      sell_price: item.sell_price,
      stock_qty: item.stock_qty,
    })
    setShowEdit(true)
  }

  const handleUpdate = async () => {
    if (!editForm.name || !editForm.sell_price) { setError('Name and sell price are required'); return }
    setSaving(true)
    setError('')
    try {
      await api.put(`/inventory/${editItem.id}`, {
        ...editForm,
        buy_price: editForm.buy_price ? Number(editForm.buy_price) : 0,
        sell_price: Number(editForm.sell_price),
        stock_qty: editForm.stock_qty ? Number(editForm.stock_qty) : 0,
      })
      setShowEdit(false)
      setEditItem(null)
      load()
      toast.success('Product updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleQuickAdjust = async (id, delta) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newQty = Math.max(0, item.stock_qty + delta)
    try {
      await api.patch(`/inventory/${id}/stock`, { stock_qty: newQty })
      setItems(prev => prev.map(i => i.id === id ? { ...i, stock_qty: newQty } : i))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = (id, name) => {
    if (user?.username === 'trial') {
      setTrialModal({ isOpen: true, action: 'Delete Product' })
      return
    }

    const itemToDelete = items.find(i => i.id === id)
    setItems(prev => prev.filter(i => i.id !== id))

    showUndoToast({
      message: `Deleted "${name}"`,
      onUndo: () => {
        if (itemToDelete) {
          setItems(prev => [...prev, itemToDelete].sort((a, b) => a.name.localeCompare(b.name)))
        }
      },
      onCommit: async () => {
        try {
          await api.delete(`/inventory/${id}`)
        } catch (err) {
          setError(err.message)
          load()
        }
      }
    })
  }

  const lowStockItems = items.filter(i => i.stock_qty <= 5)
  const filteredItems = selectedCategory === 'All'
    ? items
    : items.filter(i => i.category === selectedCategory)

  return (
    <div>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => setTrialModal({ isOpen: false, action: '' })} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Cafeteria Inventory</h1>
          <p className="page-sub">Refreshments, snacks, and inventory stock tracking</p>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <Link to="/inventory/sell?tab=sales" className="btn-secondary" style={{ padding: '0.6rem 1.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <ShoppingBag size={14} /> View Walk-in Sales
          </Link>
          <Link to="/inventory/sell" className="btn-secondary" style={{ padding: '0.6rem 1.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Plus size={14} /> Foreign Sale
          </Link>
          <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={14} strokeWidth={2.5} /> Add Item
          </button>
        </div>
      </div>

      <ErrorMsg error={error} />

      {/* Low stock alert banner */}
      {lowStockItems.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          padding: '0.85rem 1.15rem', borderRadius: '12px', marginBottom: '1.5rem',
          background: 'var(--warning-dim)', border: '1px solid var(--warning-border)', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>LOW STOCK ALERT</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>
              {lowStockItems.length} product{lowStockItems.length > 1 ? 's' : ''} running low: {lowStockItems.map(i => `${i.name} (${i.stock_qty})`).join(', ')}
            </span>
          </div>
          <Link to="/expenses/new" className="btn-secondary btn-sm" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--warning-border)' }}>
            Restock Inventory →
          </Link>
        </div>
      )}

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={selectedCategory === cat ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: '8px' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* STOCK CATALOG TABLE */}
      {loading ? <PageLoader /> : filteredItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Cafeteria Stock"
          description="Log products to track cafeteria inventory and calculate accurate profits."
          action={<button onClick={() => setShowAdd(true)} className="btn-primary">Add Item</button>}
        />
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
              {filteredItems.map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                  <td className="table-cell" style={{ fontWeight: 700 }}>{item.name}</td>
                  <td className="table-cell"><span className="badge badge-neutral">{item.category}</span></td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(item.buy_price)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 650 }}>{formatRupees(item.sell_price)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{item.stock_qty}</td>
                  <td className="table-cell">
                    {item.stock_qty === 0 ? (
                      <span className="badge badge-danger">Out of stock</span>
                    ) : item.stock_qty <= 5 ? (
                      <span className="badge badge-warning">Low ({item.stock_qty})</span>
                    ) : (
                      <span className="badge badge-success">In Stock</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="table-cell">
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button onClick={() => handleQuickAdjust(item.id, -1)} className="btn-secondary btn-icon" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '4px', padding: 0 }} title="Subtract 1">−</button>
                        <button onClick={() => handleQuickAdjust(item.id, 1)} className="btn-secondary btn-icon" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '4px', padding: 0 }} title="Add 1">+</button>
                        <button onClick={() => handleOpenEdit(item)} className="btn-secondary btn-icon" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '4px', padding: 0 }} title="Edit Product"><Edit3 size={13} /></button>
                        <button onClick={() => handleDelete(item.id, item.name)} className="btn-secondary btn-icon" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '4px', padding: 0, color: 'var(--danger)', borderColor: 'var(--danger-border)' }} title="Delete Product"><Trash2 size={13} /></button>
                      </div>
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

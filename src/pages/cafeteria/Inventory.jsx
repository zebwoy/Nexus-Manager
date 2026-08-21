import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, formatDate, formatTime, todayISO, showUndoToast } from '../../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, Field, Modal, TrialWarningModal, ConfirmModal, Spinner, Tabs, FilterBar } from '../../components/UI'
import { ShoppingBag, Edit3, Trash2, Plus, Package, Settings } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'

const CATEGORIES = ['Drinks', 'Snacks', 'Other']

export default function Inventory() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.username === 'trial'
  const isRealAdmin = user?.role === 'admin' && user?.username !== 'trial'

  const [tab, setTab] = useState('stock')
  const [items, setItems] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())
  
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
  
  const [showEdit, setShowEdit] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
  
  const [activePopover, setActivePopover] = useState(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 })
  const [saving, setSaving] = useState(false)
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  // Sales edit & delete state
  const [editSale, setEditSale] = useState(null)
  const [editSaleSaving, setEditSaleSaving] = useState(false)
  const [deleteSaleId, setDeleteSaleId] = useState(null)
  const [deleteSaleSaving, setDeleteSaleSaving] = useState(false)

  useEffect(() => { load() }, [tab, dateFilter])
  useEffect(() => {
    const handleClose = () => setActivePopover(null)
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      if (tab === 'stock') {
        const d = await api.get('/inventory')
        setItems(d.items || [])
      } else {
        const d = await api.get(`/sales${dateFilter ? `?date=${dateFilter}` : ''}`)
        setSales(d.sales || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const ef = (k, v) => setEditForm(p => ({ ...p, [k]: v }))

  const handleAdd = async () => {
    if (!form.name || !form.sell_price) return
    setSaving(true)
    try {
      await api.post('/inventory', {
        ...form,
        buy_price: Number(form.buy_price || 0),
        sell_price: Number(form.sell_price),
        stock_qty: Number(form.stock_qty || 0),
      })
      setShowAdd(false)
      setForm({ name: '', category: 'Drinks', buy_price: '', sell_price: '', stock_qty: '' })
      toast.success(`Successfully added product: "${form.name}"`)
      load()
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Register Cafeteria Product' })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editForm.name || !editForm.sell_price) return
    setSaving(true)
    try {
      await api.put(`/inventory?id=${editItem.id}`, {
        name: editForm.name,
        category: editForm.category,
        buy_price: Number(editForm.buy_price || 0),
        sell_price: Number(editForm.sell_price),
        stock_qty: Number(editForm.stock_qty || 0),
      })
      setShowEdit(false)
      toast.success(`Updated details for "${editForm.name}"`)
      load()
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Update Cafeteria Product details' })
      }
    } catch (err) {
      toast.error('Failed to update product: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item) => {
    try {
      await api.delete(`/inventory?id=${item.id}`)
      setItems(prev => prev.filter(i => i.id !== item.id))
      
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Delete Cafeteria Product' })
      }

      showUndoToast({
        message: `Deleted "${item.name}"`,
        onUndo: async () => {
          try {
            await api.post(`/inventory?action=restore&id=${item.id}`)
            load()
            toast.success(`Restored "${item.name}"`)
          } catch (e) {
            toast.error('Failed to restore item: ' + e.message)
          }
        }
      })
    } catch (err) {
      toast.error('Failed to delete item: ' + err.message)
    }
  }

  // Sales edit & delete handlers
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
      load()
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
      toast.success('Walk-in sale deleted, stock restored, and audit recorded')
      setDeleteSaleId(null)
      load()
    } catch (e) {
      setError(e.message)
      setDeleteSaleId(null)
    } finally {
      setDeleteSaleSaving(false)
    }
  }

  const lowStockItems = items.filter(i => i.stock_qty <= 5)

  return (
    <div>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => setTrialModal({ isOpen: false, action: '' })} />

      {/* Edit Sale Modal */}
      <Modal open={!!editSale} onClose={() => setEditSale(null)} title="Edit Walk-in Sale Record">
        {editSale && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <Field label="Sale Date">
              <input type="date" className="input" value={editSale.date || ''}
                onChange={e => setEditSale(s => ({ ...s, date: e.target.value }))} />
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
                <option value="credit">Credit / Due</option>
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
        message="Permanently delete this walk-in sale? Item stock quantities will be restored to inventory automatically. This action is audited."
        danger
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Cafeteria</h1>
          <p className="page-sub">Refreshment drinks, snacks, inventory stock, and walk-in sales logs</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/inventory/sell" className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}><ShoppingBag size={15} /> Foreign Sale</Link>
          <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={14} strokeWidth={2.5} /> Add Item
          </button>
        </div>
      </div>
      
      <Tabs
        tabs={[
          { key: 'stock', label: 'Stock Catalog', icon: <Package size={14} /> },
          { key: 'sales', label: 'Walk-in Sales Log', icon: <ShoppingBag size={14} /> },
        ]}
        active={tab}
        onChange={setTab}
      />

      <ErrorMsg error={error} />

      {/* Low stock alert banner */}
      {tab === 'stock' && lowStockItems.length > 0 && (
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
      
      {/* TAB 1: STOCK CATALOG */}
      {tab === 'stock' && (
        loading ? <PageLoader /> : items.length === 0 ? (
          <EmptyState title="No Cafeteria Stock" description="Log products to track cafeteria inventory and calculate accurate profits."
            action={<button onClick={() => setShowAdd(true)} className="btn-primary">Add Item</button>} />
        ) : (
          <>
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
                        <td className="table-cell">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              setPopoverPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                              setActivePopover(activePopover === item.id ? null : item.id)
                            }}
                            className="btn-secondary btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.725rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Settings size={12} /> Manage
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fixed floating popover */}
            {activePopover !== null && (() => {
              const item = items.find(i => i.id === activePopover)
              if (!item) return null
              return (
                <div
                  style={{
                    position: 'fixed',
                    top: popoverPos.top,
                    right: popoverPos.right,
                    zIndex: 9999,
                    background: 'var(--bg-elevated)',
                    border: '1.5px solid var(--border)',
                    borderRadius: '10px',
                    padding: '0.4rem',
                    minWidth: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  }}
                  onClick={e => e.stopPropagation()}
                >
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
                    style={{ width: '100%', textAlign: 'left', padding: '0.4rem 0.65rem', fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Edit3 size={12} /> Edit Details
                  </button>
                  <button
                    onClick={() => {
                      handleDelete(item)
                      setActivePopover(null)
                    }}
                    className="btn-danger btn-sm"
                    style={{ width: '100%', textAlign: 'left', padding: '0.4rem 0.65rem', fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Trash2 size={12} /> Delete Item
                  </button>
                </div>
              )
            })()}
          </>
        )
      )}

      {/* TAB 2: WALK-IN SALES LOG */}
      {tab === 'sales' && (
        <div>
          <FilterBar style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input" style={{ width: 'auto', padding: '0.45rem 0.75rem' }} />
            </div>
            <button onClick={() => setDateFilter('')} className="btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem' }}>Show All Dates</button>
          </FilterBar>

          {loading ? <PageLoader /> : sales.length === 0 ? (
            <EmptyState icon={<ShoppingBag size={32} />} title="No Walk-in Sales" description="No foreign cafeteria sales logged for the selected period."
              action={<Link to="/inventory/sell" className="btn-primary">New Foreign Sale</Link>} />
          ) : (
            <div className="card-flush" style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    {['#', 'Client Name', 'Items Purchased', 'Total', 'Payment', 'Date / Time', 'Operator', ...(isRealAdmin ? ['Actions'] : [])].map(h => (
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
                        <td className="table-cell" style={{ fontWeight: 700 }}>
                          {sa.customer_name || 'Walk-in Client'}
                          {sa.shop_name && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.35rem' }}>({sa.shop_name})</span>}
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
                        {isRealAdmin && (
                          <td className="table-cell">
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button onClick={() => setEditSale({ ...sa })} className="btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
                                <Edit3 size={11} /> Edit
                              </button>
                              <button onClick={() => setDeleteSaleId(sa.id)} className="btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
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

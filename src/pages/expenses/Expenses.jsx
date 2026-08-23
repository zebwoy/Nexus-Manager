import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, formatDate, todayISO, showUndoToast } from '../../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, FilterBar, DateInput, Modal, Field, Spinner } from '../../components/UI'
import { TrendingDown, Plus, Edit3, Trash2, Image as ImageIcon, ExternalLink, MapPin, Building, Package, UploadCloud, X, Download } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'

const CATS = ['Marketing', 'Employee', 'Inventory', 'Cafeteria', 'Other']

export default function Expenses() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.username === 'trial'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())

  // Edit Expense State
  const [editExpense, setEditExpense] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editReceiptFile, setEditReceiptFile] = useState(null)
  const [editReceiptPreview, setEditReceiptPreview] = useState('')
  const editFileInputRef = useRef(null)

  // Receipt Viewer Modal State
  const [viewingReceipt, setViewingReceipt] = useState(null) // { url, title, amount, vendor }

  useEffect(() => { load() }, [dateFilter])
  
  const load = async () => {
    try {
      setLoading(true)
      const d = await api.get(`/expenses?date=${dateFilter}`)
      setItems(d.expenses || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (exp) => {
    setEditExpense({
      id: exp.id,
      category: exp.category || 'Other',
      amount: exp.amount || '',
      vendor_name: exp.vendor_name || '',
      vendor_address: exp.vendor_address || '',
      note: exp.note || '',
      date: exp.date || todayISO(),
      payment_method: exp.payment_method || 'cash',
      receipt_url: exp.receipt_url || null
    })
    setEditReceiptFile(null)
    setEditReceiptPreview(exp.receipt_url || '')
  }

  const handleEditReceiptSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Please select a PNG, JPG, or WebP image.')
      return
    }
    setEditReceiptFile(file)
    setEditReceiptPreview(URL.createObjectURL(file))
  }

  const handleSaveEdit = async () => {
    if (!editExpense) return
    if (!editExpense.amount || Number(editExpense.amount) <= 0) {
      setError('Valid expense amount is required')
      return
    }
    setEditSaving(true)
    setError('')
    try {
      let receiptUrl = editExpense.receipt_url

      if (editReceiptFile) {
        const tenantSchema = localStorage.getItem('nexus_tenant_schema') || 'org'
        const res = await api.uploadBlob(editReceiptFile, tenantSchema, 'receipts')
        receiptUrl = res.url
      }

      await api.patch(`/expenses/${editExpense.id}`, {
        category: editExpense.category,
        amount: Number(editExpense.amount),
        vendor_name: editExpense.vendor_name?.trim() || null,
        vendor_address: editExpense.vendor_address?.trim() || null,
        note: editExpense.note?.trim() || null,
        date: editExpense.date,
        payment_method: editExpense.payment_method,
        receipt_url: receiptUrl
      })
      toast.success('Expense record updated')
      setEditExpense(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = (id, cat, amount) => {
    const itemToDelete = items.find(i => i.id === id)
    setItems(prev => prev.filter(i => i.id !== id))

    showUndoToast({
      message: `Deleted expense "${cat} - ${formatRupees(amount)}"`,
      onUndo: () => {
        if (itemToDelete) {
          setItems(prev => [itemToDelete, ...prev])
        }
      },
      onCommit: async () => {
        try {
          await api.delete(`/expenses/${id}`)
        } catch (err) {
          setError(err.message)
          load()
        }
      }
    })
  }
  
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0)

  return (
    <div>
      {/* High-Resolution Receipt Viewer Modal */}
      {viewingReceipt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem', background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            position: 'relative', width: '100%', maxWidth: '640px',
            background: 'var(--bg-card)', border: '1.5px solid var(--border)',
            borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6), var(--shadow-outset)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
              background: 'var(--bg-elevated)'
            }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                  {viewingReceipt.title || 'Expense Receipt / Bill Proof'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {viewingReceipt.vendor ? `Vendor: ${viewingReceipt.vendor} • ` : ''} Amount: {formatRupees(viewingReceipt.amount)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <a
                  href={viewingReceipt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary btn-icon"
                  style={{ width: '2rem', height: '2rem', borderRadius: '8px' }}
                  title="Open Original"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => setViewingReceipt(null)}
                  className="btn-secondary btn-icon"
                  style={{ width: '2rem', height: '2rem', borderRadius: '50%' }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Image Body */}
            <div style={{
              padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              maxHeight: '70vh', overflowY: 'auto', background: '#020617'
            }}>
              <img
                src={viewingReceipt.url}
                alt="Expense Receipt"
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      <Modal open={!!editExpense} onClose={() => setEditExpense(null)} title="Edit Expense Record">
        {editExpense && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <Field label="Operating Category" required>
              <select
                className="input"
                value={editExpense.category}
                onChange={e => setEditExpense(x => ({ ...x, category: e.target.value }))}
              >
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Bill Amount (₹)" required>
                <input
                  type="number"
                  className="input"
                  value={editExpense.amount}
                  onChange={e => setEditExpense(x => ({ ...x, amount: e.target.value }))}
                />
              </Field>
              <Field label="Operational Date">
                <DateInput
                  value={editExpense.date}
                  onChange={e => setEditExpense(x => ({ ...x, date: e.target.value }))}
                  showTodayButton={true}
                />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Payment Method">
                <select
                  className="input"
                  value={editExpense.payment_method}
                  onChange={e => setEditExpense(x => ({ ...x, payment_method: e.target.value }))}
                >
                  <option value="cash">Cash</option>
                  <option value="online">Online / UPI</option>
                </select>
              </Field>
              <Field label="Vendor / Payee">
                <input
                  className="input"
                  placeholder="e.g. Reliance Fresh"
                  value={editExpense.vendor_name}
                  onChange={e => setEditExpense(x => ({ ...x, vendor_name: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Vendor Address / Location">
              <input
                className="input"
                placeholder="e.g. Shop #4, Market Gate"
                value={editExpense.vendor_address || ''}
                onChange={e => setEditExpense(x => ({ ...x, vendor_address: e.target.value }))}
              />
            </Field>

            <Field label="Reference Note / Description">
              <input
                className="input"
                placeholder="Details, bill number, description..."
                value={editExpense.note}
                onChange={e => setEditExpense(x => ({ ...x, note: e.target.value }))}
              />
            </Field>

            {/* Receipt Upload / Replace in Edit Modal */}
            <div>
              <label className="label" style={{ marginBottom: '0.4rem' }}>Receipt / Bill Proof</label>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleEditReceiptSelect}
                style={{ display: 'none' }}
              />
              {editReceiptPreview ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem', background: 'var(--bg-elevated)',
                  border: '1.5px solid var(--border)', borderRadius: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <img
                      src={editReceiptPreview}
                      alt="Receipt"
                      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                    <div>
                      <p style={{ fontSize: '0.775rem', fontWeight: 750, color: 'var(--text)' }}>
                        {editReceiptFile?.name || 'Attached Receipt'}
                      </p>
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-text)', fontSize: '0.7rem', fontWeight: 700, padding: 0, cursor: 'pointer' }}
                      >
                        Replace Image
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditReceiptFile(null)
                      setEditReceiptPreview('')
                      setEditExpense(x => ({ ...x, receipt_url: null }))
                    }}
                    className="btn-secondary btn-icon"
                    style={{ borderRadius: '50%', width: '1.6rem', height: '1.6rem' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="btn-secondary"
                  style={{ width: '100%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                >
                  <UploadCloud size={14} /> Attach Receipt Image (PNG / JPG)
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
              <button onClick={handleSaveEdit} disabled={editSaving} className="btn-primary" style={{ flex: 1 }}>
                {editSaving ? <><Spinner size="sm" /> Saving...</> : 'Save Changes'}
              </button>
              <button onClick={() => setEditExpense(null)} className="btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Header Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Expenses Ledger</h1>
          <p className="page-sub">Operating expenditures, vendor procurement, and verified receipt records</p>
        </div>
        <Link to="/expenses/new" className="btn-primary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={14} strokeWidth={2.5} /> Add Expense
        </Link>
      </div>

      <ErrorMsg error={error} />
      
      <FilterBar style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
          <DateInput
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            showSteppers={true}
            showTodayButton={true}
          />
        </div>
        
        {!loading && items.length > 0 && (
          <div className="lcd-screen danger" style={{ padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em' }}>TOTAL COST:</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupees(total)}</span>
          </div>
        )}
      </FilterBar>

      {loading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="No Expenses Logged"
          description={`No operating costs logged for date: ${formatDate(dateFilter)}`}
          action={<Link to="/expenses/new" className="btn-primary">Log System Expense</Link>}
        />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Expense Category', 'Bill Amount', 'Payment Method', 'Vendor & Location', 'Reference Details', 'Receipt Proof', 'Operational Date', 'Operator', ...(isAdmin ? ['Actions'] : [])].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((e, idx) => (
                <tr key={e.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                  {/* Category */}
                  <td className="table-cell">
                    <span className={`badge ${e.category === 'Cafeteria' ? 'badge-accent' : e.category === 'Marketing' ? 'badge-info' : 'badge-warning'}`}>
                      {e.category}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--danger)' }}>
                    {formatRupees(e.amount)}
                  </td>

                  {/* Payment Method */}
                  <td className="table-cell">
                    <span className={`badge ${e.payment_method === 'online' ? 'badge-warning' : 'badge-accent'}`} style={{ fontSize: '0.65rem' }}>
                      {e.payment_method || 'cash'}
                    </span>
                  </td>

                  {/* Vendor & Address */}
                  <td className="table-cell">
                    {e.vendor_name ? (
                      <div>
                        <div style={{ fontWeight: 750, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Building size={12} style={{ color: 'var(--accent)' }} />
                          <span>{e.vendor_name}</span>
                        </div>
                        {e.vendor_address && (
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}>
                            <MapPin size={11} /> {e.vendor_address}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-faint)' }}>—</span>
                    )}
                  </td>

                  {/* Reference Note / Cafeteria Details */}
                  <td className="table-cell" style={{ maxWidth: '240px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {e.category === 'Cafeteria' && e.item_name && e.units && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          background: 'var(--accent-dim)', color: 'var(--accent-text)',
                          border: '1px solid var(--accent-border)',
                          borderRadius: '6px', padding: '0.15rem 0.45rem', fontSize: '0.7rem', fontWeight: 750, width: 'fit-content'
                        }}>
                          <Package size={11} />
                          <span>Restocked {e.units}× {e.item_name}</span>
                        </div>
                      )}
                      {e.note && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.4 }}>
                          {e.note}
                        </span>
                      )}
                      {!e.note && !e.item_name && (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </div>
                  </td>

                  {/* Receipt Proof Attachment */}
                  <td className="table-cell">
                    {e.receipt_url ? (
                      <button
                        type="button"
                        onClick={() => setViewingReceipt({
                          url: e.receipt_url,
                          title: `${e.category} Expense Receipt`,
                          amount: e.amount,
                          vendor: e.vendor_name
                        })}
                        className="badge badge-accent"
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.3rem 0.55rem',
                          fontSize: '0.7rem',
                          border: '1px solid var(--accent-border)'
                        }}
                        title="Click to view full receipt proof"
                      >
                        <ImageIcon size={12} />
                        <span>View Proof</span>
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>

                  {/* Operational Date */}
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
                    {formatDate(e.date)}
                  </td>

                  {/* Operator */}
                  <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.725rem', fontWeight: 600 }}>
                    @{e.created_by_username || 'system'}
                  </td>

                  {/* Actions */}
                  {isAdmin && (
                    <td className="table-cell">
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          onClick={() => handleEdit(e)}
                          className="btn-secondary btn-icon"
                          style={{ width: '1.75rem', height: '1.75rem', borderRadius: '4px', padding: 0 }}
                          title="Edit Expense"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id, e.category, e.amount)}
                          className="btn-secondary btn-icon"
                          style={{ width: '1.75rem', height: '1.75rem', borderRadius: '4px', padding: 0, color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                          title="Delete Expense (with Undo)"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

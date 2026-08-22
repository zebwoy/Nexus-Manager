import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, formatDate, todayISO, showUndoToast } from '../../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, FilterBar, DateInput, Modal, Field, Spinner } from '../../components/UI'
import { TrendingDown, Plus, Edit3, Trash2 } from 'lucide-react'
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
      note: exp.note || '',
      date: exp.date || todayISO(),
      payment_method: exp.payment_method || 'cash'
    })
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
      await api.patch(`/expenses/${editExpense.id}`, {
        category: editExpense.category,
        amount: Number(editExpense.amount),
        vendor_name: editExpense.vendor_name || null,
        note: editExpense.note || null,
        date: editExpense.date,
        payment_method: editExpense.payment_method
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

            <Field label="Reference Note">
              <input
                className="input"
                placeholder="Details, bill number, description..."
                value={editExpense.note}
                onChange={e => setEditExpense(x => ({ ...x, note: e.target.value }))}
              />
            </Field>

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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Expenses Ledger</h1>
          <p className="page-sub">Operating expenditures logs and payment audit trails</p>
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
        <EmptyState icon={TrendingDown} title="No Expenses Logged" description={`No operating costs logged for date: ${formatDate(dateFilter)}`}
          action={<Link to="/expenses/new" className="btn-primary">Log System Expense</Link>} />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Expense Category', 'Bill Amount', 'Payment Method', 'Reference note', 'Operational Date', 'Operator Logged', ...(isAdmin ? ['Actions'] : [])].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((e, idx) => (
                <tr key={e.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                  <td className="table-cell"><span className="badge badge-warning">{e.category}</span></td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--danger)' }}>{formatRupees(e.amount)}</td>
                  <td className="table-cell">
                    <span className={`badge ${e.payment_method === 'online' ? 'badge-warning' : 'badge-accent'}`} style={{ fontSize: '0.65rem' }}>
                      {e.payment_method || 'cash'}
                    </span>
                  </td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{e.note || '—'}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>{formatDate(e.date)}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.725rem', fontWeight: 600 }}>@{e.created_by_username || 'system'}</td>
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

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, formatDate, todayISO } from '../../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, Field, Modal, ConfirmModal, Spinner, FilterBar } from '../../components/UI'
import { Edit3, Trash2, Zap } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'

export default function Recharges() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())

  // Edit state
  const [editItem, setEditItem] = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  // Delete state
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [dateFilter])
  
  const load = async () => {
    try {
      setLoading(true)
      const d = await api.get(`/recharges?date=${dateFilter}`)
      setItems(d.recharges || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!editItem) return
    setEditSaving(true)
    try {
      await api.patch(`/recharges/${editItem.id}`, {
        game_platform: editItem.game_platform,
        cost_price: Number(editItem.cost_price),
        charge_price: Number(editItem.charge_price),
        payment_received: editItem.payment_received ? Number(editItem.payment_received) : null,
        note: editItem.note,
        date: editItem.date,
      })
      toast.success('Recharge updated')
      setEditItem(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/recharges/${deleteId}`)
      toast.success('Recharge deleted and audit recorded')
      setDeleteId(null)
      load()
    } catch (e) {
      setError(e.message)
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const totalRevenue = items.reduce((s, r) => s + (Number(r.charge_price) || 0), 0)
  const totalProfit  = items.reduce((s, r) => s + (Number(r.margin) || 0), 0)

  return (
    <div>
      {/* Edit Modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Recharge">
        {editItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <Field label="Platform">
              <input className="input" value={editItem.game_platform || ''}
                onChange={e => setEditItem(p => ({ ...p, game_platform: e.target.value }))} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Cost Price (₹)">
                <input type="number" className="input" value={editItem.cost_price || ''}
                  onChange={e => setEditItem(p => ({ ...p, cost_price: e.target.value }))} />
              </Field>
              <Field label="Charge Price (₹)">
                <input type="number" className="input" value={editItem.charge_price || ''}
                  onChange={e => setEditItem(p => ({ ...p, charge_price: e.target.value }))} />
              </Field>
            </div>
            {/* Smart margin preview */}
            {editItem.cost_price && editItem.charge_price && (() => {
              const m = Number(editItem.charge_price) - Number(editItem.cost_price)
              const pct = (m / Number(editItem.cost_price) * 100).toFixed(1)
              return (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className={`badge ${m >= 0 ? 'badge-success' : 'badge-danger'}`}>
                    {m >= 0 ? '+' : ''}{formatRupees(m)}
                  </span>
                  <span className="badge badge-accent">{pct}% margin</span>
                </div>
              )
            })()}
            <Field label="Payment Received (₹)">
              <input type="number" className="input" value={editItem.payment_received || ''}
                onChange={e => setEditItem(p => ({ ...p, payment_received: e.target.value }))} />
            </Field>
            <Field label="Note">
              <input className="input" value={editItem.note || ''}
                onChange={e => setEditItem(p => ({ ...p, note: e.target.value }))} />
            </Field>
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
              <button onClick={handleEdit} disabled={editSaving} className="btn-primary" style={{ flex: 1 }}>
                {editSaving ? <><Spinner size="sm" /> Saving...</> : 'Save Changes'}
              </button>
              <button onClick={() => setEditItem(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Recharge"
        message="Permanently delete this recharge entry? This action is audited."
        danger
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Platform Recharges</h1>
          <p className="page-sub">Mobile and in-game RC transaction logs</p>
        </div>
        <Link to="/recharges/new" className="btn-primary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={14} strokeWidth={2.5} /> New Recharge
        </Link>
      </div>

      <ErrorMsg error={error} />
      
      <FilterBar style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input" style={{ width: 'auto', padding: '0.45rem 0.75rem' }} />
        </div>
        {!loading && items.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="lcd-screen" style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>REVENUE:</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>{formatRupees(totalRevenue)}</span>
            </div>
            <div className="lcd-screen success" style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>PROFIT:</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>{formatRupees(totalProfit)}</span>
            </div>
          </div>
        )}
      </FilterBar>

      {loading ? <PageLoader /> : items.length === 0 ? (
        <EmptyState icon={Zap} title="No Recharges Logged" description={`No platform recharge operations recorded for date: ${formatDate(dateFilter)}`}
          action={<Link to="/recharges/new" className="btn-primary">Add Recharge Log</Link>} />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Client Profile', 'Game Platform', 'System Cost', 'Amount Charged', 'Net Profit', 'Cash Received', 'System Note', 'Operator', ...(isAdmin ? ['Actions'] : [])].map(h => (
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
                  {isAdmin && (
                    <td className="table-cell">
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button onClick={() => setEditItem({ ...r })} className="btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
                          <Edit3 size={11} /> Edit
                        </button>
                        <button onClick={() => setDeleteId(r.id)} className="btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
                          <Trash2 size={11} />
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

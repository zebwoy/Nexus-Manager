import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, formatDate, todayISO } from '../../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, FilterBar } from '../../components/UI'
import { TrendingDown, Plus } from 'lucide-react'

export default function Expenses() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState(todayISO())

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
  
  const total = items.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Expenses Ledger</h1>
          <p className="page-sub">Operating expenditures logs</p>
        </div>
        <Link to="/expenses/new" className="btn-primary" style={{ padding: '0.6rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={14} strokeWidth={2.5} /> Add Expense
        </Link>
      </div>

      <ErrorMsg error={error} />
      
      <FilterBar style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label className="label" style={{ marginBottom: 0 }}>Filter Date</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input" style={{ width: 'auto', padding: '0.45rem 0.75rem' }} />
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
                {['Expense Category', 'Bill Amount', 'Payment Method', 'Reference note', 'Operational Date', 'Operator Logged'].map(h => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

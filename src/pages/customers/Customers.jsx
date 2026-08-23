import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { formatDate, formatRupees } from '../../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, FilterBar } from '../../components/UI'
import { Users, Search, Gamepad2, Coffee, Building, Layers, MapPin, Phone } from 'lucide-react'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all') // 'all' | 'session' | 'cafeteria' | 'vendor'

  useEffect(() => {
    load()
  }, [view])

  const load = async () => {
    try {
      setLoading(true)
      const d = await api.get(`/customers?view=${view}`)
      setCustomers(d.customers || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return !q ||
      c.name?.toLowerCase().includes(q) ||
      c.mobile?.includes(q) ||
      c.shop_name?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q)
  })

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Client & Vendor Registry</h1>
        <p className="page-sub">Unified directory of gaming players, walk-in customers, and procurement vendors</p>
      </div>

      <ErrorMsg error={error} />

      {/* View Toggle + Search */}
      <FilterBar style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '10px', padding: '3px', border: '1.5px solid var(--border)', gap: '2px', flexWrap: 'wrap' }}>
          {[
            { key: 'all',       label: 'All Entities', icon: <Layers size={13} /> },
            { key: 'session',   label: 'Gaming Clients', icon: <Gamepad2 size={13} /> },
            { key: 'cafeteria', label: 'Walk-in Clients', icon: <Coffee size={13} /> },
            { key: 'vendor',    label: 'Vendors & Suppliers', icon: <Building size={13} /> },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => { setView(opt.key); setSearch('') }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.85rem', borderRadius: '8px', cursor: 'pointer', border: 'none',
                fontSize: '0.8rem', fontWeight: 650,
                background: view === opt.key ? 'var(--accent)' : 'transparent',
                color: view === opt.key ? 'var(--btn-primary-text, #fff)' : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.1rem', padding: '0.45rem 0.75rem 0.45rem 2.1rem' }}
            placeholder="Search by name, mobile, address, or shop…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      {loading ? <PageLoader /> : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            view === 'session' ? 'No Gaming Clients Registered' :
            view === 'cafeteria' ? 'No Walk-in Clients Registered' :
            view === 'vendor' ? 'No Vendors Registered' : 'No Entries in Registry'
          }
          description={
            view === 'vendor'
              ? 'Vendors register automatically when adding expense logs with vendor names and locations.'
              : 'Clients register automatically when creating gaming station sessions or cafeteria walk-in sales.'
          }
        />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Profile Name</th>
                <th>Entity Type</th>
                <th>Contact Mobile</th>
                <th>Business & Location</th>
                <th>First Registered</th>
                <th>Activity Ledger</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const isVendor = c.client_type === 'vendor' || Number(c.expense_count) > 0
                const isCafeteria = Number(c.session_count) > 0 && !c.pancafe_username
                const isGaming = c.pancafe_username || Number(c.session_count) > 0

                return (
                  <tr key={c.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                    {/* Name */}
                    <td className="table-cell" style={{ fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '1.85rem', height: '1.85rem', borderRadius: '50%',
                          background: isVendor ? 'var(--warning-dim, rgba(245,158,11,0.15))' : 'var(--accent-dim)',
                          color: isVendor ? 'var(--warning, #f59e0b)' : 'var(--accent-text)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 750, flexShrink: 0
                        }}>
                          {isVendor ? <Building size={12} /> : (c.name?.[0]?.toUpperCase() || '?')}
                        </div>
                        <div>
                          <span style={{ color: 'var(--text)' }}>{c.name}</span>
                          {c.pancafe_username && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              PanCafe: @{c.pancafe_username}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Entity Tag */}
                    <td className="table-cell">
                      <span className={`badge ${isVendor ? 'badge-warning' : 'badge-accent'}`} style={{ fontSize: '0.65rem' }}>
                        {isVendor ? 'Vendor / Payee' : isCafeteria && !isGaming ? 'Walk-in Client' : 'Gaming Member'}
                      </span>
                    </td>

                    {/* Mobile */}
                    <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                      {c.mobile ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Phone size={11} style={{ opacity: 0.6 }} /> {c.mobile}
                        </span>
                      ) : '—'}
                    </td>

                    {/* Business & Address */}
                    <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      <div>
                        {c.shop_name && (
                          <div style={{ fontWeight: 650, color: 'var(--text)' }}>
                            {c.shop_name}
                          </div>
                        )}
                        {c.address ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.725rem', marginTop: '2px' }}>
                            <MapPin size={11} style={{ color: 'var(--accent)' }} /> {c.address}
                          </div>
                        ) : !c.shop_name ? (
                          <span style={{ color: 'var(--text-faint)' }}>—</span>
                        ) : null}
                      </div>
                    </td>

                    {/* First Registered */}
                    <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {formatDate(c.created_at)}
                    </td>

                    {/* Activity Ledger */}
                    <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                      {isVendor ? (
                        <div>
                          <span className="badge badge-warning">
                            {c.expense_count || 0} Bills
                          </span>
                          {Number(c.total_expense_amount) > 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginLeft: '0.4rem' }}>
                              {formatRupees(c.total_expense_amount)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="badge badge-accent">
                          {c.session_count || 0} {view === 'cafeteria' ? 'purchases' : 'sessions'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

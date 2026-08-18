import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, FilterBar } from '../../components/UI'
import { useAuth } from '../../context/AuthContext'
import { Users, Search, UserCheck } from 'lucide-react'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('session') // 'session' | 'cafeteria'

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

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile?.includes(search) ||
    c.shop_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Client Registry</h1>
        <p className="page-sub">Auto-accumulated from logged session and cafeteria entries</p>
      </div>

      <ErrorMsg error={error} />

      {/* View Toggle + Search */}
      <FilterBar style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '10px', padding: '3px', border: '1.5px solid var(--border)', gap: '2px' }}>
          {[
            { key: 'session',   label: '🎮 Gaming Sessions' },
            { key: 'cafeteria', label: '☕ Cafeteria Sales'  },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => { setView(opt.key); setSearch('') }}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: '8px', cursor: 'pointer', border: 'none',
                fontSize: '0.8rem', fontWeight: 650,
                background: view === opt.key ? 'var(--accent)' : 'transparent',
                color: view === opt.key ? 'var(--btn-primary-text, #fff)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >{opt.label}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.1rem', padding: '0.45rem 0.75rem 0.45rem 2.1rem' }}
            placeholder="Search by name, mobile, or shop…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      {loading ? <PageLoader /> : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={view === 'session' ? 'No Session Clients' : 'No Cafeteria Clients'}
          description={view === 'session'
            ? 'Clients register automatically when creating gaming station sessions with names.'
            : 'Cafeteria clients register when a walk-in sale is logged with a customer name.'}
        />
      ) : (
        <div className="card-flush" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {view === 'session'
                  ? ['Client Profile Name', 'Mobile Number', 'First Registered', 'Total Sessions'].map(h => <th key={h}>{h}</th>)
                  : ['Client Profile Name', 'Mobile Number', 'Shop / Business', 'First Registered', 'Total Purchases'].map(h => <th key={h}>{h}</th>)
                }
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c.id} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                  <td className="table-cell" style={{ fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '1.75rem', height: '1.75rem', borderRadius: '50%',
                        background: 'var(--accent-dim)', color: 'var(--accent-text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 750
                      }}>
                        {c.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span>{c.name}</span>
                    </div>
                  </td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{c.mobile || '—'}</td>
                  {view === 'cafeteria' && (
                    <td className="table-cell" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.shop_name || '—'}</td>
                  )}
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatDate(c.created_at)}</td>
                  <td className="table-cell" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    <span className="badge badge-accent">
                      {c.session_count || 0} {view === 'session' ? 'sessions' : 'purchases'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

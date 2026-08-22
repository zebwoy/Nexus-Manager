import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { formatRupees } from '../../lib/helpers'
import { PageLoader, ErrorMsg, FilterBar } from '../../components/UI'
import { BarChart2, TrendingUp, TrendingDown, DollarSign, Monitor } from 'lucide-react'

export default function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  useEffect(() => { load() }, [month])
  const load = async () => {
    try {
      setLoading(true)
      const d = await api.get(`/reports?month=${month}`)
      setData(d)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">P&amp;L Reports</h1>
          <p className="page-sub">Monthly profit-and-loss and device utilization analysis</p>
        </div>
        <FilterBar style={{ marginBottom: 0, padding: '0.45rem 0.85rem' }}>
          <label className="label" style={{ marginBottom: 0 }}>Report Period</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input" style={{ width: 'auto', padding: '0.35rem 0.65rem' }} />
        </FilterBar>
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
              <div key={s.label} className={`lcd-screen ${s.state}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '110px' }}>
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
              <p className="label" style={{ borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingUp size={14} style={{ color: 'var(--success)' }} /> Revenue Streams
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {[
                  { label: 'Gaming Station Sessions', value: data.gaming_revenue },
                  { label: 'Shop Retail Sales (Walk-in)', value: data.walkin_revenue },
                  { label: 'Shop Retail Sales (Seat Tables)', value: data.session_sales_revenue },
                  { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><img src="/assets/favicon_PanCafe.ico" alt="PanCafe" style={{ width: '15px', height: '15px', objectFit: 'contain' }} />PanCafe Sub-sessions</span>, value: data.pancafe_revenue },
                  { label: 'Console Platform Recharges', value: data.rc_revenue },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.45rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 650 }}>{r.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)' }}>{formatRupees(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Expenses breakdown */}
            <div className="card">
              <p className="label" style={{ borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingDown size={14} style={{ color: 'var(--danger)' }} /> Expenditures &amp; COGS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {[
                  { label: 'Operating Expenses (Ledger)', value: data.operating_expenses, badge: 'badge-warning' },
                  { label: 'Inventory Cost of Sales (COGS)', value: data.inventory_cogs, badge: 'badge-neutral' },
                  { label: 'Recharge Purchase Costs (COGS)', value: data.recharges_cogs, badge: 'badge-accent' },
                  { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><img src="/assets/favicon_PanCafe.ico" alt="PanCafe" style={{ width: '15px', height: '15px', objectFit: 'contain' }} />PanCafe System Top-up Costs (COGS)</span>, value: data.pancafe_cogs, badge: 'badge-accent' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.45rem' }}>
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
              <p className="label" style={{ borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Monitor size={14} style={{ color: 'var(--accent)' }} /> Device Terminal Utilization
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
                {data.device_stats.map(d => {
                  const percent = Math.min(100, (d.session_count / (data.max_sessions || 1)) * 100)
                  return (
                    <div key={d.device_label} style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.65rem' }}>
                      <span className="badge badge-accent" style={{ width: '5.5rem', justifyContent: 'center' }}>{d.device_label}</span>
                      
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
                      
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: '6.5rem', textAlign: 'right' }}>
                        {d.session_count} sessions
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem', color: 'var(--accent-text)', fontWeight: 700, minWidth: '6.5rem', textAlign: 'right' }}>
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

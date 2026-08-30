import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { formatDate, formatRupees } from '../../lib/helpers'
import { PageLoader, EmptyState, ErrorMsg, FilterBar } from '../../components/UI'
import { Users, Search, Gamepad2, Coffee, Building, Layers, MapPin, Phone, ReceiptText, ArrowUpRight, ArrowDownLeft, X, CheckCircle } from 'lucide-react'
import { toast } from 'react-toastify'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all') // 'all' | 'session' | 'cafeteria' | 'vendor'

  // Ledger Statement Drawer & Settlement state
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [ledgerData, setLedgerData] = useState(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [settleAmount, setSettleAmount] = useState('')
  const [settleMethod, setSettleMethod] = useState('cash')
  const [settleNote, setSettleNote] = useState('')
  const [settleSaving, setSettleSaving] = useState(false)

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

  const openLedger = async (c) => {
    setSelectedCustomer(c)
    setLedgerLoading(true)
    setLedgerData(null)
    setShowSettleModal(false)
    try {
      const d = await api.get(`/customers/${c.id}/ledger`)
      setLedgerData(d)
      if (d.summary?.balance > 0) {
        setSettleAmount(String(d.summary.balance))
      } else {
        setSettleAmount('')
      }
    } catch (err) {
      toast.error('Failed to load ledger: ' + err.message)
    } finally {
      setLedgerLoading(false)
    }
  }

  const handleSettle = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    const amt = Number(settleAmount)
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid positive amount')
      return
    }
    setSettleSaving(true)
    try {
      await api.post(`/customers/${selectedCustomer.id}/settle`, {
        amount: amt,
        payment_method: settleMethod,
        note: settleNote || null
      })
      toast.success(`Settled ₹${amt.toLocaleString('en-IN')} for ${selectedCustomer.name}`)
      setShowSettleModal(false)
      setSettleNote('')
      // Refresh current ledger
      const d = await api.get(`/customers/${selectedCustomer.id}/ledger`)
      setLedgerData(d)
      load()
    } catch (err) {
      toast.error('Settlement failed: ' + err.message)
    } finally {
      setSettleSaving(false)
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
        <p className="page-sub">Unified directory of gaming players, walk-in customers, and procurement vendors with live ledger balance</p>
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
                <th>Account Balance</th>
                <th>Activity Ledger</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const isVendor = c.client_type === 'vendor' || Number(c.expense_count) > 0
                const isCafeteria = Number(c.session_count) > 0 && !c.pancafe_username
                const isGaming = c.pancafe_username || Number(c.session_count) > 0
                const bal = Number(c.balance || 0)

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

                    {/* Account Balance */}
                    <td className="table-cell">
                      {bal > 0 ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 750,
                          background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)'
                        }}>
                          ₹{bal.toLocaleString('en-IN')} Due
                        </span>
                      ) : bal < 0 ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 750,
                          background: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.3)'
                        }}>
                          ₹{Math.abs(bal).toLocaleString('en-IN')} Credit
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                          background: 'var(--bg-input)', color: 'var(--text-faint)', border: '1px solid var(--border)'
                        }}>
                          Clear (₹0)
                        </span>
                      )}
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

                    {/* Actions */}
                    <td className="table-cell" style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openLedger(c)}
                        className="btn-ghost"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                          color: 'var(--accent-text)', border: '1px solid var(--border)'
                        }}
                      >
                        <ReceiptText size={13} />
                        <span>Statement</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Ledger Statement Drawer / Modal */}
      {selectedCustomer && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '100%', maxWidth: '680px', height: '100%',
            background: 'var(--bg-elevated, #18181b)', borderLeft: '1.5px solid var(--border)',
            display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.75rem', gap: '1.25rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 750, color: 'var(--text)' }}>
                  {selectedCustomer.name}
                </h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {selectedCustomer.mobile ? `Phone: ${selectedCustomer.mobile}` : 'No phone linked'} • ID #{selectedCustomer.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="btn-ghost"
                style={{ padding: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {ledgerLoading ? (
              <PageLoader />
            ) : ledgerData ? (
              <>
                {/* Balance & Summary KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 650 }}>TOTAL CHARGES</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.25rem' }}>
                      ₹{ledgerData.summary.total_charged.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 650 }}>TOTAL PAYMENTS</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d', marginTop: '0.25rem' }}>
                      ₹{ledgerData.summary.total_paid.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{
                    padding: '0.85rem', borderRadius: '10px',
                    background: ledgerData.summary.balance > 0 ? 'rgba(239,68,68,0.1)' : ledgerData.summary.balance < 0 ? 'rgba(34,197,94,0.1)' : 'var(--bg-input)',
                    border: `1.5px solid ${ledgerData.summary.balance > 0 ? 'rgba(239,68,68,0.3)' : ledgerData.summary.balance < 0 ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 650, color: ledgerData.summary.balance > 0 ? 'var(--danger)' : ledgerData.summary.balance < 0 ? '#15803d' : 'var(--text-muted)' }}>
                      NET BALANCE
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: ledgerData.summary.balance > 0 ? 'var(--danger)' : ledgerData.summary.balance < 0 ? '#15803d' : 'var(--text)', marginTop: '0.25rem' }}>
                      {ledgerData.summary.balance > 0 ? `₹${ledgerData.summary.balance.toLocaleString('en-IN')} Due` : ledgerData.summary.balance < 0 ? `₹${Math.abs(ledgerData.summary.balance).toLocaleString('en-IN')} Credit` : '₹0.00 (Clear)'}
                    </div>
                  </div>
                </div>

                {/* Settle / Collect Button & Inline Form */}
                <div style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                      Collect Payment / Settle Balance
                    </div>
                    <button
                      onClick={() => setShowSettleModal(!showSettleModal)}
                      className="btn-primary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {showSettleModal ? 'Hide Form' : 'Add Payment / Settle'}
                    </button>
                  </div>

                  {showSettleModal && (
                    <form onSubmit={handleSettle} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'block' }}>
                            Amount to Settle (₹)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="1"
                            required
                            className="input"
                            value={settleAmount}
                            onChange={e => setSettleAmount(e.target.value)}
                            placeholder="e.g. 100"
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'block' }}>
                            Payment Method
                          </label>
                          <select
                            className="input"
                            value={settleMethod}
                            onChange={e => setSettleMethod(e.target.value)}
                          >
                            <option value="cash">Cash</option>
                            <option value="online">Online / UPI</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'block' }}>
                          Settlement Note (optional)
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={settleNote}
                          onChange={e => setSettleNote(e.target.value)}
                          placeholder="e.g. Cleared pending dues via UPI"
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setShowSettleModal(false)}
                          className="btn-ghost"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={settleSaving}
                          className="btn-primary"
                          style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700 }}
                        >
                          {settleSaving ? 'Saving…' : `Record ₹${Number(settleAmount || 0).toLocaleString('en-IN')} Payment`}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Ledger Entries Table */}
                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text)', marginBottom: '0.65rem' }}>
                    Itemized Statement History ({ledgerData.ledger.length} entries)
                  </h3>
                  {ledgerData.ledger.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No ledger transactions recorded yet.
                    </div>
                  ) : (
                    <div className="card-flush" style={{ overflowX: 'auto', maxHeight: '380px', overflowY: 'auto' }}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Date & Time</th>
                            <th>Activity</th>
                            <th>Description</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                            <th style={{ textAlign: 'right' }}>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerData.ledger.map((e) => {
                            const isCharge = Number(e.amount) > 0
                            return (
                              <tr key={e.id}>
                                <td className="table-cell" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                                  {formatDate(e.created_at)}
                                </td>
                                <td className="table-cell">
                                  <span className={`badge ${isCharge ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                                    {e.module}
                                  </span>
                                </td>
                                <td className="table-cell" style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                                  {e.description}
                                </td>
                                <td className="table-cell" style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 750, color: isCharge ? 'var(--danger)' : '#15803d' }}>
                                  {isCharge ? `+₹${Number(e.amount).toLocaleString('en-IN')}` : `-₹${Math.abs(Number(e.amount)).toLocaleString('en-IN')}`}
                                </td>
                                <td className="table-cell" style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 750, color: Number(e.running_balance) > 0 ? 'var(--danger)' : Number(e.running_balance) < 0 ? '#15803d' : 'var(--text-muted)' }}>
                                  ₹{Number(e.running_balance).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}


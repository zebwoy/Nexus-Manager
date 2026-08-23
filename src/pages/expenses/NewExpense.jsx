import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, todayISO } from '../../lib/helpers'
import { Field, ErrorMsg, TrialWarningModal, Spinner, DateInput } from '../../components/UI'
import { useAuth } from '../../context/AuthContext'
import { Package, Banknote, CreditCard, UploadCloud, X, MapPin, Building, Calculator, Tag } from 'lucide-react'

const CATS = ['Marketing', 'Employee', 'Inventory', 'Cafeteria', 'Other']

export default function NewExpense() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState({
    category: 'Marketing',
    amount: '',
    vendor_name: '',
    vendor_address: '',
    note: '',
    date: todayISO()
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })
  const [payMethod, setPayMethod] = useState('cash')

  // Vendor Autocomplete state
  const [vendorSuggestions, setVendorSuggestions] = useState([])
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false)
  const vendorBoxRef = useRef(null)

  // Receipt image attachment state
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const fileInputRef = useRef(null)

  // Cafeteria expense specific state
  const [inventory, setInventory] = useState([])
  const [cafeMode, setCafeMode] = useState('existing') // 'existing' | 'new'
  const [itemId, setItemId] = useState('')
  const [packsCount, setPacksCount] = useState('1')
  const [packSize, setPackSize] = useState('24')
  const [unitSellPrice, setUnitSellPrice] = useState('')

  // New cafeteria item details
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Drinks')

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Close vendor suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (vendorBoxRef.current && !vendorBoxRef.current.contains(e.target)) {
        setShowVendorSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (form.category === 'Cafeteria') {
      api.get('/inventory')
        .then(res => {
          const inv = res.items || []
          setInventory(inv)
          if (inv.length === 0) setCafeMode('new')
          else setCafeMode('existing')
        })
        .catch(err => setError('Failed to load inventory: ' + err.message))
    }
  }, [form.category])

  // When selecting an existing item, pre-fill sell price
  const handleItemSelect = (id) => {
    setItemId(id)
    const selected = inventory.find(i => String(i.id) === String(id))
    if (selected && selected.sell_price) {
      setUnitSellPrice(String(selected.sell_price))
    }
  }

  // Vendor Autocomplete handler
  const handleVendorNameChange = async (val) => {
    f('vendor_name', val)
    if (val.trim().length >= 1) {
      try {
        const d = await api.get(`/customers?search=${encodeURIComponent(val.trim())}`)
        setVendorSuggestions(d.customers || [])
        setShowVendorSuggestions(true)
      } catch {
        setVendorSuggestions([])
      }
    } else {
      setVendorSuggestions([])
      setShowVendorSuggestions(false)
    }
  }

  const selectVendor = (v) => {
    f('vendor_name', v.name)
    if (v.address) f('vendor_address', v.address)
    setShowVendorSuggestions(false)
  }

  // Receipt File handlers
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type)) {
      setError('Please select a PNG, JPG, or WebP image file.')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Receipt image must be under 8MB.')
      return
    }

    setError('')
    setReceiptFile(file)
    const previewUrl = URL.createObjectURL(file)
    setReceiptPreview(previewUrl)
  }

  const removeReceipt = () => {
    setReceiptFile(null)
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview)
      setReceiptPreview('')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Calculated quantities & financial breakdown
  const numPacks = Math.max(1, Number(packsCount) || 1)
  const sizePerPack = Math.max(1, Number(packSize) || 1)
  const totalSellableUnits = numPacks * sizePerPack
  const costAmountNum = Number(form.amount) || 0
  const calculatedUnitBuyPrice = (costAmountNum > 0 && totalSellableUnits > 0) ? (costAmountNum / totalSellableUnits) : 0
  const sellPriceNum = Number(unitSellPrice) || 0
  const marginPerUnit = sellPriceNum > 0 ? (sellPriceNum - calculatedUnitBuyPrice) : 0
  const marginPercent = calculatedUnitBuyPrice > 0 && sellPriceNum > 0 ? ((marginPerUnit / calculatedUnitBuyPrice) * 100).toFixed(1) : 0

  const handleSubmit = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Valid cost amount is required')
      return
    }

    if (form.category === 'Cafeteria') {
      if (numPacks <= 0 || sizePerPack <= 0) {
        setError('Packs count and units per pack must be positive numbers')
        return
      }
      if (cafeMode === 'existing' && !itemId) {
        setError('Please select an existing cafeteria item to restock')
        return
      }
      if (cafeMode === 'new') {
        if (!newItemName.trim()) { setError('New item name is required'); return }
        if (!unitSellPrice || Number(unitSellPrice) <= 0) {
          setError('Selling price per unit must be positive')
          return
        }
      }
    }

    setLoading(true)
    setError('')
    try {
      let receiptUrl = null

      // If user selected a receipt image, upload it to Vercel Blob
      if (receiptFile) {
        setUploadingReceipt(true)
        try {
          const tenantSchema = localStorage.getItem('nexus_tenant_schema') || 'org'
          const res = await api.uploadBlob(receiptFile, tenantSchema, 'receipts')
          receiptUrl = res.url
        } catch (uploadErr) {
          console.warn('Receipt upload failed, continuing with expense record:', uploadErr)
        } finally {
          setUploadingReceipt(false)
        }
      }

      const payload = {
        category: form.category,
        amount: Number(form.amount),
        vendor_name: form.vendor_name?.trim() || null,
        vendor_address: form.vendor_address?.trim() || null,
        note: form.note?.trim() || null,
        date: form.date,
        payment_method: payMethod,
        receipt_url: receiptUrl,
        packs_count: form.category === 'Cafeteria' ? numPacks : null,
        pack_size: form.category === 'Cafeteria' ? sizePerPack : null,
        units: form.category === 'Cafeteria' ? totalSellableUnits : null,
        unit_sell_price: (form.category === 'Cafeteria' && unitSellPrice) ? Number(unitSellPrice) : null,
        item_id: (form.category === 'Cafeteria' && cafeMode === 'existing') ? Number(itemId) : null,
        new_item: (form.category === 'Cafeteria' && cafeMode === 'new') ? {
          name: newItemName.trim(),
          category: newItemCategory,
          sell_price: Number(unitSellPrice)
        } : null
      }

      await api.post('/expenses', payload)
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Expense Entry' })
      } else {
        navigate('/expenses')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto' }}>
      <TrialWarningModal
        open={trialModal.isOpen}
        actionName={trialModal.action}
        onClose={() => { setTrialModal({ isOpen: false, action: '' }); navigate('/expenses') }}
      />
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">New Expense Entry</h1>
        <p className="page-sub">Record operating expenditures, inventory purchases, and digital bills</p>
      </div>

      <ErrorMsg error={error} />

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Field label="Operating Category" required>
          <select className="input" value={form.category} onChange={e => f('category', e.target.value)}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Total Bill / Cost Amount (₹)" required>
            <input
              type="number"
              className="input"
              placeholder="e.g. 380"
              value={form.amount}
              onChange={e => f('amount', e.target.value)}
            />
          </Field>
          <Field label="Operational Date">
            <DateInput value={form.date} onChange={e => f('date', e.target.value)} showTodayButton={true} />
          </Field>
        </div>

        {/* Cafeteria Restock Section */}
        {form.category === 'Cafeteria' && (
          <div style={{
            background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
            padding: '1.15rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            <p style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Package size={14} /> Cafeteria Inventory Linkage
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {inventory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCafeMode('existing')}
                  className={cafeMode === 'existing' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                  style={{ flex: 1, padding: '0.45rem' }}
                >
                  Restock Existing Item
                </button>
              )}
              <button
                type="button"
                onClick={() => setCafeMode('new')}
                className={cafeMode === 'new' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                style={{ flex: 1, padding: '0.45rem' }}
              >
                Add New Item
              </button>
            </div>

            {cafeMode === 'existing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Field label="Select Cafeteria Item to Restock" required>
                  <select className="input" value={itemId} onChange={e => handleItemSelect(e.target.value)}>
                    <option value="">-- Choose Item --</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (Stock: {item.stock_qty} | Sell: {formatRupees(item.sell_price)})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Selling Price per Unit (₹)">
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 10"
                    value={unitSellPrice}
                    onChange={e => setUnitSellPrice(e.target.value)}
                  />
                </Field>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Field label="New Item Name" required>
                  <input className="input" placeholder="e.g. Red Bull Energy" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field label="Category" required>
                    <select className="input" value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)}>
                      <option value="Drinks">Drinks</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                  <Field label="Selling Price per Unit (₹)" required>
                    <input type="number" className="input" placeholder="e.g. 125" value={unitSellPrice} onChange={e => setUnitSellPrice(e.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            {/* Pack and Unit Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Packs / Crates Purchased" required>
                <input
                  type="number"
                  min="1"
                  className="input"
                  placeholder="e.g. 2"
                  value={packsCount}
                  onChange={e => setPacksCount(e.target.value)}
                />
              </Field>
              <Field label="Units per Pack (Pack Size)" required>
                <input
                  type="number"
                  min="1"
                  className="input"
                  placeholder="e.g. 24"
                  value={packSize}
                  onChange={e => setPackSize(e.target.value)}
                />
              </Field>
            </div>

            {/* Live Financial Breakdown Card */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '0.75rem 0.95rem',
              display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Sellable Units:</span>
                <span style={{ fontWeight: 800, color: 'var(--text)' }}>
                  {numPacks} pack{numPacks > 1 ? 's' : ''} × {sizePerPack} units = <span style={{ color: 'var(--accent-text)' }}>{totalSellableUnits} units</span>
                </span>
              </div>

              {costAmountNum > 0 && totalSellableUnits > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cost Price (Buy Price):</span>
                  <span style={{ fontWeight: 800, color: 'var(--danger)' }}>
                    {formatRupees(calculatedUnitBuyPrice.toFixed(2))} / unit
                  </span>
                </div>
              )}

              {sellPriceNum > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Retail Selling Price:</span>
                  <span style={{ fontWeight: 800, color: 'var(--success)' }}>
                    {formatRupees(sellPriceNum.toFixed(2))} / unit
                  </span>
                </div>
              )}

              {costAmountNum > 0 && sellPriceNum > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Expected Profit Margin:</span>
                  <span style={{ fontWeight: 800, color: marginPerUnit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatRupees(marginPerUnit.toFixed(2))} ({marginPercent}%) / unit
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vendor & Location with Autocomplete */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div ref={vendorBoxRef} style={{ position: 'relative' }}>
            <Field label="Vendor / Payee Name">
              <input
                className="input"
                placeholder="e.g. Reliance Fresh / VP Naka"
                value={form.vendor_name}
                onChange={e => handleVendorNameChange(e.target.value)}
                onFocus={() => { if (vendorSuggestions.length > 0) setShowVendorSuggestions(true) }}
                autoComplete="off"
              />
            </Field>

            {showVendorSuggestions && vendorSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                zIndex: 50, maxHeight: '200px', overflowY: 'auto'
              }}>
                {vendorSuggestions.map(v => (
                  <div
                    key={v.id}
                    onClick={() => selectVendor(v)}
                    style={{
                      padding: '0.55rem 0.85rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.8125rem'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontWeight: 750, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Building size={13} style={{ color: 'var(--accent)' }} />
                      <span>{v.name}</span>
                      {v.shop_name && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({v.shop_name})</span>}
                    </div>
                    {v.address && (
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}>
                        <MapPin size={11} /> {v.address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Vendor Address / Location">
            <input
              className="input"
              placeholder="e.g. Main Market, Gate #2"
              value={form.vendor_address}
              onChange={e => f('vendor_address', e.target.value)}
            />
          </Field>
        </div>

        {/* Structured Remarks */}
        <Field label="Reference Note / Bill Description">
          <input
            className="input"
            placeholder="e.g. Weekly refreshment stock procurement / Invoice #1024"
            value={form.note}
            onChange={e => f('note', e.target.value)}
          />
        </Field>

        {/* Payment Method Selector */}
        <div>
          <label className="label" style={{ marginBottom: '0.5rem' }}>Payment Method</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { id: 'cash', label: 'Cash', icon: <Banknote size={14} /> },
              { id: 'online', label: 'Online / UPI', icon: <CreditCard size={14} /> }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPayMethod(m.id)}
                style={{
                  flex: 1, padding: '0.55rem 0.85rem', borderRadius: '10px', cursor: 'pointer',
                  border: `1.5px solid ${payMethod === m.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: payMethod === m.id ? 'var(--accent-dim)' : 'var(--bg-input)',
                  color: payMethod === m.id ? 'var(--accent-text)' : 'var(--text-muted)',
                  fontWeight: 650, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Receipt / Invoice Attachment Area (Vercel Blob) */}
        <div>
          <label className="label" style={{ marginBottom: '0.5rem' }}>
            Receipt / Bill Attachment {payMethod === 'online' ? '(Recommended for UPI)' : '(Optional)'}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {!receiptPreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '1.5px dashed var(--border)',
                borderRadius: '12px',
                padding: '1.25rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg-input)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <UploadCloud size={24} style={{ color: 'var(--accent)', margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text)' }}>
                Click to attach PNG or JPG receipt / screenshot
              </p>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Stored securely in Vercel Storage Blob (Max 8MB)
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'var(--bg-elevated)',
              border: '1.5px solid var(--border)',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                  src={receiptPreview}
                  alt="Receipt Preview"
                  style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 750, color: 'var(--text)' }}>{receiptFile?.name || 'Receipt Image'}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {receiptFile ? `${(receiptFile.size / 1024).toFixed(1)} KB` : 'Ready to upload'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={removeReceipt}
                className="btn-secondary btn-icon"
                style={{ borderRadius: '50%', width: '1.75rem', height: '1.75rem' }}
                title="Remove attachment"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ padding: '0.65rem 1.35rem', flex: 1 }}>
            {loading ? <><Spinner size="sm" /> Storing Expense...</> : 'Save Expense Log'}
          </button>
          <button onClick={() => navigate('/expenses')} className="btn-secondary" style={{ padding: '0.65rem 1.35rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

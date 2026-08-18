import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRupees, todayISO } from '../../lib/helpers'
import { Field, ErrorMsg, TrialWarningModal, Spinner } from '../../components/UI'
import { useAuth } from '../../context/AuthContext'

const CATS = ['Marketing', 'Employee', 'Inventory', 'Cafeteria', 'Other']

export default function NewExpense() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState({ category: 'Marketing', amount: '', note: '', date: todayISO(), vendor_name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  // Cafeteria expense specific state (restock or add new)
  const [inventory, setInventory] = useState([])
  const [cafeMode, setCafeMode] = useState('existing') // 'existing' | 'new'
  const [itemId, setItemId] = useState('')
  const [units, setUnits] = useState('1')

  // New cafeteria item details (for instant catalog entry)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Drinks')
  const [newItemSellPrice, setNewItemSellPrice] = useState('')

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const [payMethod, setPayMethod] = useState('cash')

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

  const handleSubmit = async () => {
    if (!form.amount) { setError('Amount is required'); return }
    if (form.category === 'Cafeteria') {
      if (!units || Number(units) <= 0) { setError('Quantity (Units) must be a positive number'); return }
      if (cafeMode === 'existing' && !itemId) { setError('Please select an existing cafeteria item to restock'); return }
      if (cafeMode === 'new') {
        if (!newItemName.trim()) { setError('New item name is required'); return }
        if (!newItemSellPrice || Number(newItemSellPrice) <= 0) { setError('New item selling price must be positive'); return }
      }
    }

    setLoading(true)
    setError('')
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        payment_method: payMethod,
        units: form.category === 'Cafeteria' ? Number(units) : null,
        item_id: (form.category === 'Cafeteria' && cafeMode === 'existing') ? Number(itemId) : null,
        new_item: (form.category === 'Cafeteria' && cafeMode === 'new') ? {
          name: newItemName.trim(),
          category: newItemCategory,
          sell_price: Number(newItemSellPrice)
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
    <div style={{ maxWidth: '520px', margin: '0 auto' }}>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => { setTrialModal({ isOpen: false, action: '' }); navigate('/expenses') }} />
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">New Expense Entry</h1>
        <p className="page-sub">Add administrative or inventory purchasing costs</p>
      </div>

      <ErrorMsg error={error} />
      
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Field label="Operating Category" required>
          <select className="input" value={form.category} onChange={e => f('category', e.target.value)}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Cost Amount (₹)" required>
            <input type="number" className="input" placeholder="Amount" value={form.amount} onChange={e => f('amount', e.target.value)} />
          </Field>
          <Field label="Operational Date">
            <input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} />
          </Field>
        </div>

        {form.category === 'Cafeteria' && (
          <div style={{
            background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
            padding: '1.15rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            <p style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
              📦 Cafeteria Inventory Linkage
            </p>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {inventory.length > 0 && (
                <button type="button" onClick={() => setCafeMode('existing')}
                  className={cafeMode === 'existing' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} style={{ flex: 1, padding: '0.35rem' }}>
                  Restock Existing Item
                </button>
              )}
              <button type="button" onClick={() => setCafeMode('new')}
                className={cafeMode === 'new' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} style={{ flex: 1, padding: '0.35rem' }}>
                Add New Item
              </button>
            </div>

            {cafeMode === 'existing' ? (
              <Field label="Select Cafeteria Item to Restock" required>
                <select className="input" value={itemId} onChange={e => setItemId(e.target.value)}>
                  <option value="">-- Choose Item --</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Current Stock: {item.stock_qty})
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Field label="New Item Name" required>
                  <input className="input" placeholder="e.g. Monster Energy" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field label="Category" required>
                    <select className="input" value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)}>
                      <option value="Drinks">Drinks</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                  <Field label="Selling Price (₹)" required>
                    <input type="number" className="input" placeholder="Price" value={newItemSellPrice} onChange={e => setNewItemSellPrice(e.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            <Field label="Total Quantity Received (Units / Pack Size)" required>
              <input type="number" className="input" placeholder="e.g. 24 or 30" value={units} onChange={e => setUnits(e.target.value)} />
            </Field>

            {form.amount && units && Number(units) > 0 && (
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 650 }}>
                Calculated Buy Price: <span style={{ color: 'var(--success)', fontWeight: 800 }}>{formatRupees((Number(form.amount) / Number(units)).toFixed(2))}</span> per unit.
              </p>
            )}
          </div>
        )}
        
        <Field label="Vendor Name">
          <input className="input" placeholder="e.g. Raj Traders" value={form.vendor_name || ''} onChange={e => f('vendor_name', e.target.value)} />
        </Field>

        <Field label="Vendor Address / Reference Note">
          <input className="input" placeholder="Shop address or bill reference" value={form.note} onChange={e => f('note', e.target.value)} />
        </Field>

        <div>
          <label className="label" style={{ marginBottom: '0.5rem' }}>Payment Method</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['cash', 'online'].map(m => (
              <button key={m} type="button" onClick={() => setPayMethod(m)}
                style={{
                  flex: 1, padding: '0.45rem 0.85rem', borderRadius: '10px', cursor: 'pointer',
                  border: `1.5px solid ${payMethod === m ? 'var(--accent)' : 'var(--border)'}`,
                  background: payMethod === m ? 'var(--accent-dim)' : 'var(--bg-input)',
                  color: payMethod === m ? 'var(--accent-text)' : 'var(--text-muted)',
                  fontWeight: 650, fontSize: '0.85rem'
                }}>
                {m === 'cash' ? '💵 Cash' : '📲 Online / UPI'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ padding: '0.65rem 1.35rem' }}>
            {loading ? <><Spinner size="sm" /> Storing...</> : 'Save Expense Log'}
          </button>
          <button onClick={() => navigate('/expenses')} className="btn-secondary" style={{ padding: '0.65rem 1.35rem' }}>Abort Command</button>
        </div>
      </div>
    </div>
  )
}

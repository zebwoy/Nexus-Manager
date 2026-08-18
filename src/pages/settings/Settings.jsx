import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { PageLoader, ErrorMsg, Field, Modal, TrialWarningModal, Spinner } from '../../components/UI'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import { Trash2, Shield, Settings as SettingsIcon, Users } from 'lucide-react'

const EDITABLE_SETTINGS = ['controller_fee', 'extra_person_fee', 'extra_person_from']

export default function Settings() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.username === 'trial'
  const isRealAdmin = user?.role === 'admin' && user?.username !== 'trial'
  const isTrial = user?.username === 'trial'

  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', username: '', pin: '', role: 'operator' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [resettingUser, setResettingUser] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  // Platform management state
  const [showAddPlatform, setShowAddPlatform] = useState(false)
  const [newPlatform, setNewPlatform] = useState({ name: '', description: '' })
  const [platformSaving, setPlatformSaving] = useState(false)

  // Purge modal
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [purging, setPurging] = useState(false)

  useEffect(() => { load() }, [])
  const load = async () => {
    try {
      setLoading(true)
      const [u, s, p] = await Promise.all([
        api.get('/users'),
        api.get('/settings'),
        api.get('/platforms'),
      ])
      setUsers(u.users || [])
      setSettings(s.settings || [])
      setPlatforms(p.platforms || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    if (!newUser.full_name || !newUser.username || newUser.pin.length !== 4) {
      setError('All fields required. PIN must be exactly 4 digits.')
      return
    }
    setSaving(true)
    try {
      await api.post('/users', newUser)
      setShowAddUser(false)
      setNewUser({ full_name: '', username: '', pin: '', role: 'operator' })
      load()
      toast.success(`Staff account created for @${newUser.username}`)
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Add Staff Member' })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResetPin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    setResetSaving(true)
    setError('')
    try {
      await api.put(`/users?id=${resettingUser.id}`, { pin: newPin })
      setResettingUser(null)
      setNewPin('')
      toast.success('Security PIN reset successfully!')
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Reset Security PIN' })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setResetSaving(false)
    }
  }

  const handleAddPlatform = async () => {
    if (!newPlatform.name?.trim()) {
      setError('Platform name is required')
      return
    }
    setPlatformSaving(true)
    try {
      await api.post('/platforms', newPlatform)
      setShowAddPlatform(false)
      setNewPlatform({ name: '', description: '' })
      toast.success('Recharge platform added')
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setPlatformSaving(false)
    }
  }

  const handleDeletePlatform = async (pId) => {
    try {
      await api.delete(`/platforms?id=${pId}`)
      toast.success('Platform removed')
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSettingChange = (key, value) => {
    setSettings(s => s.map(r => r.key === key ? { ...r, value } : r))
  }

  const saveSettings = async () => {
    if (isTrial) {
      setTrialModal({ isOpen: true, action: 'Modify System Settings' })
      return
    }
    setSaving(true)
    try {
      await api.post('/settings', { settings })
      setSaveMsg('Configuration updated!')
      toast.success('System variables updated!')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePurgeData = async () => {
    setPurging(true)
    setError('')
    try {
      await api.post('/purge')
      setShowPurgeModal(false)
      toast.success('Production reset complete! Test data purged.')
      if (user?.username === 'trial') {
        setTrialModal({ isOpen: true, action: 'Purge Transactional Logs' })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setPurging(false)
    }
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <TrialWarningModal open={trialModal.isOpen} actionName={trialModal.action} onClose={() => setTrialModal({ isOpen: false, action: '' })} />
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Settings Console</h1>
        <p className="page-sub">Manage system variables, platforms, and staff directory</p>
      </div>
      
      <ErrorMsg error={error} />

      {/* Staff management panel */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Staff Registry</p>
          <button onClick={() => setShowAddUser(true)} className="btn-primary btn-sm">+ Add Staff</button>
        </div>
        
        {loading ? <PageLoader /> : users.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Empty user records</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.map((u, idx) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem', padding: '0.65rem 0.75rem',
                background: idx % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent',
                borderBottom: idx < users.length - 1 ? '1px solid var(--border)' : 'none',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--accent-dim)',
                    border: '1.5px solid var(--accent-border)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.85rem', fontWeight: 750, color: 'var(--accent-text)'
                  }}>
                    {u.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>{u.full_name}</p>
                    <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 550, fontFamily: "'JetBrains Mono', monospace" }}>
                      @{u.username}
                      <span style={{ textTransform: 'capitalize', fontSize: '0.65rem', background: 'var(--accent-dim)', padding: '0.1rem 0.35rem', borderRadius: '4px', color: 'var(--accent-text)', marginLeft: '0.35rem' }}>
                        {u.role || 'operator'}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (isTrial) { setTrialModal({ isOpen: true, action: 'Reset Security PIN' }); return }
                    setResettingUser(u)
                  }}
                  className="btn-secondary btn-sm"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Reset PIN
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System variables configurations panel */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>System Variables</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {settings.filter(s => EDITABLE_SETTINGS.includes(s.key)).map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <label className="label" style={{ marginBottom: 0, textTransform: 'capitalize', fontSize: '0.85rem' }}>
                {s.key.replace(/_/g, ' ')}
              </label>
              <input type="number" className="input" style={{ width: '8.5rem', textAlign: 'right' }} value={s.value}
                onChange={e => handleSettingChange(s.key, e.target.value)} />
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
          <button onClick={saveSettings} disabled={saving} className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
            {saving ? 'Updating...' : 'Save Settings'}
          </button>
          {saveMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="led-indicator led-green" style={{ width: '6px', height: '6px' }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 650 }}>{saveMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Recharge Platforms Master Panel */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🎮 Recharge Platforms Master</p>
          <button onClick={() => setShowAddPlatform(true)} className="btn-primary btn-sm">+ Add Platform</button>
        </div>

        {platforms.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No platforms registered</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {platforms.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 0.75rem', borderRadius: '8px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                fontSize: '0.8125rem', fontWeight: 650
              }}>
                <span style={{ color: 'var(--text)' }}>{p.name}</span>
                {p.description && <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>({p.description})</span>}
                {isRealAdmin && (
                  <button onClick={() => handleDeletePlatform(p.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 0, marginLeft: '0.25rem' }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Production Cleanup / Purge Section */}
      <div className="card" style={{ border: '1.5px solid var(--danger-border)', background: 'var(--danger-dim)' }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.45rem' }}>
          Production Data Purge &amp; System Reset
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '1.25rem' }}>
          Purge test sessions, sales, expenses, recharges, and daily opening records to prepare your console for production. Pricing rules, devices, and user accounts will remain intact.
        </p>
        <button onClick={() => setShowPurgeModal(true)} className="btn-danger" style={{ padding: '0.6rem 1.25rem' }}>
          Purge Test Data
        </button>
      </div>

      {/* Add Platform Modal */}
      <Modal open={showAddPlatform} onClose={() => setShowAddPlatform(false)} title="Add Recharge Platform">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Platform Name" required>
            <input className="input" placeholder="e.g. Nintendo eShop, Riot Points..."
              value={newPlatform.name} onChange={e => setNewPlatform(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Description (optional)">
            <input className="input" placeholder="e.g. Nintendo Switch games"
              value={newPlatform.description} onChange={e => setNewPlatform(p => ({ ...p, description: e.target.value }))} />
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handleAddPlatform} disabled={platformSaving} className="btn-primary" style={{ flex: 1 }}>
              {platformSaving ? <><Spinner size="sm" /> Adding...</> : 'Add Platform'}
            </button>
            <button onClick={() => setShowAddPlatform(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Add Staff Modal */}
      <Modal open={showAddUser} onClose={() => setShowAddUser(false)} title="Add Console Staff Account">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Full Name" required>
            <input className="input" placeholder="e.g. Rahul Sharma" value={newUser.full_name} onChange={e => setNewUser(u => ({...u, full_name: e.target.value}))} />
          </Field>
          <Field label="Console Username" required>
            <input className="input" placeholder="e.g. rahul88" value={newUser.username} onChange={e => setNewUser(u => ({...u, username: e.target.value}))} />
          </Field>
          <Field label="4-digit Security PIN" required>
            <input type="password" inputMode="numeric" maxLength={4} className="input" placeholder="Numeric pin code" value={newUser.pin} onChange={e => setNewUser(u => ({...u, pin: e.target.value}))} />
          </Field>
          <Field label="Staff Role">
            <select className="input" value={newUser.role} onChange={e => setNewUser(u => ({...u, role: e.target.value}))}>
              <option value="operator">Operator (Staff)</option>
              <option value="admin">Administrator</option>
            </select>
          </Field>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handleAddUser} disabled={saving} className="btn-primary" style={{ flex: 1 }}>{saving ? 'Creating...' : 'Create Account'}</button>
            <button onClick={() => setShowAddUser(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Purge Confirmation Modal */}
      <Modal open={showPurgeModal} onClose={() => setShowPurgeModal(false)} title="Purge Test Data for Production">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Are you sure you want to <strong>purge all transactional test data</strong>? This will clear all logged sessions, sales, expenses, and opening balances to leave your database clean for live production use.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handlePurgeData} disabled={purging} className="btn-danger" style={{ flex: 1 }}>
              {purging ? 'Purging Data...' : 'Confirm Reset &amp; Purge'}
            </button>
            <button onClick={() => setShowPurgeModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Reset PIN Modal */}
      <Modal open={!!resettingUser} onClose={() => setResettingUser(null)} title={`Reset PIN for ${resettingUser?.full_name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="New 4-digit Security PIN" required>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="input"
              placeholder="Enter new 4-digit PIN"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={handleResetPin} disabled={resetSaving} className="btn-primary" style={{ flex: 1 }}>
              {resetSaving ? 'Saving...' : 'Update PIN'}
            </button>
            <button onClick={() => setResettingUser(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatDate, formatTime, formatRupees } from '../../lib/helpers'
import { PageLoader, ErrorMsg, Field, Modal, TrialWarningModal, Spinner } from '../../components/UI'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import {
  Trash2, Shield, Settings as SettingsIcon, Users, PlusCircle,
  KeyRound, UserPlus, UserCheck, UserX, Clock, Database,
  Activity, CheckCircle2, AlertCircle, RefreshCw, X, Eye, EyeOff,
  Gamepad2, Coffee, Zap, TrendingDown, DollarSign, FileCheck, Layers,
  AlertTriangle, Building2, Phone, Sparkles, Monitor, ChevronRight,
  Upload, ImageIcon, Lock, Info, ClockIcon, CheckCheck, XCircle
} from 'lucide-react'

const TABS = [
  { key: 'staff',   label: 'Staff Authorizations & PINs',     icon: Users },
  { key: 'tariffs', label: 'Tariff & Configurations',          icon: Gamepad2 },
  { key: 'system',  label: 'Organization Profile & Identity',  icon: Building2 },
]

function PendingBadge({ count }) {
  if (!count) return null
  return (
    <span style={{
      background: 'var(--warning, #f59e0b)', color: '#fff',
      fontSize: '0.6rem', fontWeight: 900, borderRadius: '99px',
      padding: '0.1rem 0.45rem', marginLeft: '0.4rem', lineHeight: 1
    }}>{count}</span>
  )
}

export default function Settings() {
  const { user, isAdmin, isTrial } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('staff')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Staff Management State
  const [staffUsers, setStaffUsers] = useState([])
  const [staffInvites, setStaffInvites] = useState([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteData, setInviteData] = useState({ full_name: '', email: '', pin: '1234', role: 'operator' })
  const [inviteSaving, setInviteSaving] = useState(false)

  // Reset PIN State
  const [resettingUser, setResettingUser] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [showNewPin, setShowNewPin] = useState(false)
  const [resetSaving, setResetSaving] = useState(false)

  // Per-row PIN reveal
  const [revealedPins, setRevealedPins] = useState({})

  // Tariffs & Settings State
  const [settings, setSettings] = useState([])
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Device management
  const [devices, setDevices] = useState([])
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [newDevice, setNewDevice] = useState({ label: '', type: 'PC' })
  const [deviceSaving, setDeviceSaving] = useState(false)

  // Pricing
  const [pricing, setPricing] = useState([])
  const [pricingEdits, setPricingEdits] = useState({})
  const [pricingSaving, setPricingSaving] = useState(false)

  // Platform management state
  const [platforms, setPlatforms] = useState([])
  const [showAddPlatform, setShowAddPlatform] = useState(false)
  const [newPlatform, setNewPlatform] = useState({ name: '', description: '' })
  const [platformSaving, setPlatformSaving] = useState(false)

  // Org Profile Change Requests
  const [profileChanges, setProfileChanges] = useState([])
  const [pendingFields, setPendingFields] = useState({}) // { cafe_name: true, etc }
  const [orgEditMode, setOrgEditMode] = useState(null) // which field is being edited
  const [orgEditValue, setOrgEditValue] = useState('')
  const [orgSubmitting, setOrgSubmitting] = useState(false)

  // Logo upload
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef(null)

  // Purge Modal
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [staffRes, settRes, platRes, devRes, pricRes] = await Promise.all([
        api.get('/staff'),
        api.get('/settings'),
        api.get('/platforms'),
        api.get('/devices'),
        api.get('/pricing'),
      ])
      setStaffUsers(staffRes.users || [])
      setStaffInvites(staffRes.invites || [])
      setSettings(settRes.settings || [])
      const cafeNameSetting = settRes.settings?.find(s => s.key === 'cafe_name')?.value
      if (cafeNameSetting) {
        localStorage.setItem('nexus_tenant_name', cafeNameSetting)
      }
      setPlatforms(platRes.platforms || [])
      setDevices(devRes.devices || [])
      setPricing(pricRes.pricing || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProfileChanges = useCallback(async () => {
    if (isTrial) return
    try {
      const res = await api.get('/profile-changes')
      const changes = res.changes || []
      setProfileChanges(changes)
      // Build a set of fields that have pending requests
      const pending = {}
      changes.filter(c => c.status === 'pending').forEach(c => { pending[c.field] = true })
      setPendingFields(pending)
    } catch {}
  }, [isTrial])

  useEffect(() => {
    loadData()
    loadProfileChanges()
  }, [loadData, loadProfileChanges])

  // ─── Staff Handlers ───
  const handleInviteStaff = async () => {
    if (!inviteData.full_name?.trim() || !inviteData.email?.trim()) {
      setError('Staff full name and email address are required.')
      return
    }
    if (inviteData.pin && !/^\d{4}$/.test(inviteData.pin)) {
      setError('Counter PIN must be exactly 4 digits.')
      return
    }

    setInviteSaving(true)
    setError('')
    try {
      await api.post('/staff', inviteData)
      setShowInviteModal(false)
      setInviteData({ full_name: '', email: '', pin: '1234', role: 'operator' })
      toast.success(`Staff authorization sent to ${inviteData.email}`)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setInviteSaving(false)
    }
  }

  const handleResetPin = async () => {
    if (!newPin || !/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    setResetSaving(true)
    setError('')
    try {
      await api.patch(`/staff?id=${resettingUser.id}`, { pin: newPin })
      setResettingUser(null)
      setNewPin('')
      setShowNewPin(false)
      toast.success(`PIN updated for @${resettingUser.username}`)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setResetSaving(false)
    }
  }

  const handleToggleStaffStatus = async (userObj) => {
    const nextStatus = userObj.status === 'suspended' ? 'active' : 'suspended'
    try {
      await api.patch(`/staff?id=${userObj.id}`, { status: nextStatus })
      toast.success(`Staff account marked ${nextStatus}`)
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRevokeStaff = async (id, name) => {
    if (!window.confirm(`Revoke all console access for "${name}"?`)) return
    try {
      await api.delete(`/staff?id=${id}`)
      toast.success(`Revoked staff access for ${name}`)
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  // ─── Platform Handlers ───
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
      loadData()
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
      loadData()
    } catch (e) {
      setError(e.message)
    }
  }

  // ─── Device Handlers ───
  const handleAddDevice = async () => {
    if (!newDevice.label?.trim()) { setError('Device label is required'); return }
    setDeviceSaving(true)
    try {
      await api.post('/devices', newDevice)
      setShowAddDevice(false)
      setNewDevice({ label: '', type: 'PC' })
      toast.success('Device added')
      loadData()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeviceSaving(false)
    }
  }

  const handleRemoveDevice = async (dId) => {
    if (!window.confirm('Deactivate this device? Sessions on it will still be retained.')) return
    try {
      await api.delete(`/devices?id=${dId}`)
      toast.success('Device deactivated')
      loadData()
    } catch (e) {
      setError(e.message)
    }
  }

  // ─── Pricing Handler ───
  const savePricing = async () => {
    if (Object.keys(pricingEdits).length === 0) return
    setPricingSaving(true)
    try {
      const updates = Object.entries(pricingEdits).map(([key, price]) => {
        const [device_type, duration_mins] = key.split('_')
        return { device_type, duration_mins: Number(duration_mins), price: Number(price) }
      })
      await api.post('/pricing', { pricing: updates })
      setPricingEdits({})
      toast.success('Pricing updated')
      loadData()
    } catch (e) {
      setError(e.message)
    } finally {
      setPricingSaving(false)
    }
  }

  // ─── Tariff Settings Handlers ───
  const handleSettingChange = (key, value) => {
    setSettings(s => s.map(r => r.key === key ? { ...r, value } : r))
  }

  const saveSurcharges = async () => {
    if (isTrial) {
      setTrialModal({ isOpen: true, action: 'Modify Surcharge Settings' })
      return
    }
    setSettingsSaving(true)
    try {
      const surchargeKeys = ['controller_fee', 'extra_person_fee', 'extra_person_from']
      const surcharges = settings.filter(s => surchargeKeys.includes(s.key))
      await api.post('/settings', { settings: surcharges })
      setSaveMsg('Surcharges updated!')
      toast.success('Surcharge settings saved')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSettingsSaving(false)
    }
  }

  // ─── Org Profile Change Request ───
  const submitProfileChange = async (field, value) => {
    if (isTrial) {
      setTrialModal({ isOpen: true, action: 'Request Profile Change' })
      return
    }
    setOrgSubmitting(true)
    setError('')
    try {
      await api.post('/profile-changes', { field, new_value: value })
      toast.success('Change request submitted! Awaiting Super Admin approval.')
      setOrgEditMode(null)
      setOrgEditValue('')
      loadProfileChanges()
    } catch (e) {
      setError(e.message)
    } finally {
      setOrgSubmitting(false)
    }
  }

  const cancelProfileChange = async (id) => {
    try {
      await api.delete(`/profile-changes?id=${id}`)
      toast.success('Change request cancelled')
      loadProfileChanges()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // ─── Logo Upload ───
  const handleLogoFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      setError('Only PNG, JPEG, WebP, and SVG files are allowed for logos.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo file must be under 2MB.')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setError('')
  }

  const handleLogoUpload = async () => {
    if (!logoFile) return
    const schemaName = localStorage.getItem('nexus_tenant_schema') || 'org'
    setLogoUploading(true)
    setError('')
    try {
      const result = await api.uploadBlob(logoFile, schemaName)
      if (!result.url) throw new Error('Upload succeeded but no URL returned')
      // Now submit as a profile change request
      await submitProfileChange('cafe_logo', result.url)
      setLogoFile(null)
      setLogoPreview('')
    } catch (e) {
      setError('Logo upload failed: ' + e.message)
    } finally {
      setLogoUploading(false)
    }
  }

  const getSetting = (key, fallback = '') => settings.find(s => s.key === key)?.value || fallback

  if (loading) return <PageLoader />

  // Which staff can the current user manage?
  const canChangePinFor = (st) => isAdmin || st.username === user?.username
  const canSuspend = (st) => isAdmin && st.username !== user?.username
  const canRevoke = (st) => isAdmin && st.username !== user?.username && !(st.role === 'admin')

  const pricingByType = (type) => pricing.filter(p => p.device_type === type).sort((a, b) => a.duration_mins - b.duration_mins)
  const DURATIONS = [30, 60, 90, 120, 150, 180, 240, 300]
  const DEVICE_TYPES = [
    { type: 'PC', label: 'PC Stations', icon: Monitor },
    { type: 'XBOX', label: 'Xbox Consoles', icon: Gamepad2 },
    { type: 'PS', label: 'PlayStation', icon: Gamepad2 },
  ]

  const pendingCount = profileChanges.filter(c => c.status === 'pending').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1280px', margin: '0 auto' }}>

      {/* ─── PAGE HEADER ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
            padding: '0.25rem 0.75rem', borderRadius: '100px',
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            marginBottom: '0.65rem'
          }}>
            <span className="led-indicator led-green" style={{ width: '6px', height: '6px' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Cafe Administrator Portal
            </span>
          </div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
            Admin Command &amp; Settings Hub
          </h1>
          <p className="page-sub" style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Authorized control panel for staff access, game pricing, device fleet, and organization identity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/audit')}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Shield size={13} /> Audit Trail
          </button>
          <button onClick={() => { loadData(); loadProfileChanges() }} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <ErrorMsg error={error} />

      {/* ─── TAB NAVIGATION BAR ─── */}
      <div style={{
        display: 'flex', gap: '0.5rem', borderBottom: '1.5px solid var(--border)',
        padding: '0.35rem 0.15rem', margin: 0, overflowX: 'auto'
      }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setError('') }}
            style={{
              padding: '0.55rem 1rem', borderRadius: '10px', fontSize: '0.825rem', fontWeight: 750,
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: activeTab === key ? 'var(--accent)' : 'transparent',
              color: activeTab === key ? 'var(--btn-primary-text, #fff)' : 'var(--text-muted)',
              transition: 'all 0.15s ease', whiteSpace: 'nowrap'
            }}
          >
            <Icon size={16} />
            {label}
            {key === 'system' && pendingCount > 0 && <PendingBadge count={pendingCount} />}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 1: STAFF AUTHORIZATIONS & PINS ────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
                Staff Team &amp; Counter Operators
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Authorize staff members by email and configure their 4-digit desk PINs.
              </p>
            </div>

            {isAdmin && (
              <button onClick={() => setShowInviteModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1rem' }}>
                <UserPlus size={15} /> Authorize New Staff Member
              </button>
            )}
          </div>

          {/* Staff Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {staffUsers.map(st => {
              const isCurrentUser = st.username === user?.username
              const isPinRevealed = revealedPins[st.id]
              const isAdminUser = st.role === 'admin'
              const roleLabel = st.role === 'admin' ? 'Cafe Admin' : 'Counter Operator'
              const avatarColor = isAdminUser ? 'linear-gradient(135deg, var(--accent) 0%, rgba(59,130,246,0.6) 100%)' : 'var(--bg-input)'
              const avatarTextColor = isAdminUser ? '#fff' : 'var(--text)'

              return (
                <div key={st.id} className="card" style={{
                  padding: '1.15rem 1.25rem',
                  display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                  border: isCurrentUser ? '1.5px solid var(--accent-border)' : '1.5px solid var(--border)',
                  background: isCurrentUser ? 'var(--accent-dim)' : 'var(--bg-card)',
                  position: 'relative'
                }}>
                  {isCurrentUser && (
                    <span style={{
                      position: 'absolute', top: '0.65rem', right: '0.85rem',
                      fontSize: '0.6rem', fontWeight: 800, color: 'var(--accent-text)',
                      background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                      padding: '0.15rem 0.5rem', borderRadius: '99px', textTransform: 'uppercase'
                    }}>You</span>
                  )}

                  {/* Avatar */}
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: avatarColor,
                    border: '1.5px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', fontWeight: 900, color: avatarTextColor,
                    flexShrink: 0, boxShadow: 'var(--shadow)'
                  }}>
                    {st.full_name?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Identity */}
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.925rem', color: 'var(--text)' }}>
                      {st.full_name}
                    </p>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>@{st.username}</span>
                      {st.email && <span>• {st.email}</span>}
                    </p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--text-faint)' }}>
                      Joined {formatDate(st.created_at)}
                    </p>
                  </div>

                  {/* PIN */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: '110px' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                      padding: '0.3rem 0.65rem', borderRadius: '8px',
                      background: 'var(--bg-input)', border: '1px solid var(--border)'
                    }}>
                      <KeyRound size={12} style={{ color: 'var(--accent)' }} />
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.2em',
                        color: 'var(--text)'
                      }}>
                        {(isAdmin && isPinRevealed) ? (st.pin || '••••') : '••••'}
                      </span>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setRevealedPins(p => ({ ...p, [st.id]: !p[st.id] }))}
                        className="btn-secondary btn-sm"
                        style={{ padding: '0.3rem', borderRadius: '7px', color: 'var(--text-muted)' }}
                        title={isPinRevealed ? 'Hide PIN' : 'Reveal PIN'}
                      >
                        {isPinRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>

                  {/* Role + Status */}
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', minWidth: '140px', flexWrap: 'wrap' }}>
                    <span className={`badge ${isAdminUser ? 'badge-accent' : 'badge-neutral'}`} style={{ fontSize: '0.68rem', fontWeight: 800 }}>
                      {roleLabel}
                    </span>
                    <span className={`badge ${st.status === 'suspended' ? 'badge-danger' : st.status === 'invited' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.68rem', fontWeight: 800 }}>
                      {st.status === 'suspended' ? 'Suspended' : st.status === 'invited' ? 'Pending Invite' : 'Active'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'inline-flex', gap: '0.45rem', marginLeft: 'auto' }}>
                    {canChangePinFor(st) && (
                      <button
                        onClick={() => { setResettingUser(st); setNewPin(''); setShowNewPin(false); setError('') }}
                        className="btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <KeyRound size={12} /> Change PIN
                      </button>
                    )}

                    {canSuspend(st) && (
                      <button
                        onClick={() => handleToggleStaffStatus(st)}
                        className="btn-secondary btn-sm"
                        style={{
                          fontSize: '0.75rem', padding: '0.35rem 0.65rem',
                          color: st.status === 'suspended' ? 'var(--success)' : 'var(--text-muted)'
                        }}
                      >
                        {st.status === 'suspended' ? <><UserCheck size={12} /> Activate</> : <><UserX size={12} /> Suspend</>}
                      </button>
                    )}

                    {canRevoke(st) && (
                      <button
                        onClick={() => handleRevokeStaff(st.id, st.full_name)}
                        className="btn-secondary btn-sm"
                        style={{ color: 'var(--danger)', padding: '0.35rem 0.5rem' }}
                        title="Revoke Access"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Audit Trail link */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.65rem', justifyContent: 'space-between',
            padding: '0.85rem 1.15rem', borderRadius: '10px',
            background: 'var(--bg-input)', border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                View full staff operations ledger and session history
              </span>
            </div>
            <button onClick={() => navigate('/audit')} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              Audit Trail <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 2: TARIFF & CONFIGURATIONS ────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tariffs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Device Fleet */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>Device Fleet</h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Manage PC stations, consoles, and all playable devices</p>
              </div>
              {isAdmin && (
                <button onClick={() => setShowAddDevice(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}>
                  <PlusCircle size={14} /> Add Device
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {DEVICE_TYPES.map(({ type, label, icon: DIcon }) => {
                const typeDevices = devices.filter(d => d.type === type)
                return typeDevices.length > 0 ? typeDevices.map(d => (
                  <div key={d.id} className="card" style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DIcon size={14} style={{ color: 'var(--accent-text)' }} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.825rem', fontWeight: 800, color: 'var(--text)' }}>{d.label}</p>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>{type}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleRemoveDevice(d.id)} className="btn-secondary btn-sm" style={{ color: 'var(--danger)', padding: '0.3rem' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )) : null
              })}
              {devices.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem 0' }}>No devices configured yet.</p>
              )}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1.5px solid var(--border)' }} />

          {/* Pricing Matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>Pricing Matrix</h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Per device-type pricing per session duration</p>
              </div>
              {isAdmin && Object.keys(pricingEdits).length > 0 && (
                <button onClick={savePricing} disabled={pricingSaving} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {pricingSaving ? <><Spinner size="sm" /> Saving...</> : <><CheckCircle2 size={14} /> Save Pricing</>}
                </button>
              )}
            </div>

            {DEVICE_TYPES.map(({ type, label }) => (
              <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="tbl" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        {DURATIONS.map(d => <th key={d} style={{ textAlign: 'center', fontSize: '0.7rem' }}>{d}m</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {DURATIONS.map(d => {
                          const key = `${type}_${d}`
                          const existing = pricing.find(p => p.device_type === type && p.duration_mins === d)
                          const val = pricingEdits[key] !== undefined ? pricingEdits[key] : (existing?.price || '')
                          return (
                            <td key={d} style={{ textAlign: 'center', padding: '0.4rem' }}>
                              {isAdmin ? (
                                <input
                                  type="number"
                                  className="input"
                                  value={val}
                                  onChange={e => setPricingEdits(prev => ({ ...prev, [key]: e.target.value }))}
                                  style={{ width: '64px', textAlign: 'center', fontSize: '0.8rem', padding: '0.3rem 0.4rem' }}
                                  placeholder="—"
                                />
                              ) : (
                                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>₹{val || '—'}</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <hr style={{ border: 'none', borderTop: '1.5px solid var(--border)' }} />

          {/* Surcharges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>Session Surcharges</h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Add-on fees for controllers and extra players</p>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '560px' }}>
              <Field label="Additional Controller Surcharge (₹)">
                <input type="number" className="input" value={getSetting('controller_fee', '25')} onChange={e => handleSettingChange('controller_fee', e.target.value)} disabled={!isAdmin} />
              </Field>
              <Field label="Extra Person Surcharge (₹)">
                <input type="number" className="input" value={getSetting('extra_person_fee', '15')} onChange={e => handleSettingChange('extra_person_fee', e.target.value)} disabled={!isAdmin} />
              </Field>
              <Field label="Extra Person Starts From Player #">
                <input type="number" className="input" value={getSetting('extra_person_from', '3')} onChange={e => handleSettingChange('extra_person_from', e.target.value)} disabled={!isAdmin} />
              </Field>
              {isAdmin && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button onClick={saveSurcharges} disabled={settingsSaving} className="btn-primary" style={{ padding: '0.6rem 1.15rem' }}>
                    {settingsSaving ? <><Spinner size="sm" /> Saving...</> : 'Save Surcharges'}
                  </button>
                  {saveMsg && <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={13} /> {saveMsg}</span>}
                </div>
              )}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1.5px solid var(--border)' }} />

          {/* Recharge Platforms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>Recharge Platforms</h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Manage supported gaming wallet and recharge platforms</p>
              </div>
              {isAdmin && (
                <button onClick={() => setShowAddPlatform(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}>
                  <PlusCircle size={14} /> Add Platform
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {platforms.map(p => (
                <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)' }}>{p.name}</h4>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.description || 'Gaming wallet'}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDeletePlatform(p.id)} className="btn-secondary btn-sm" style={{ color: 'var(--danger)', padding: '0.4rem' }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 3: ORGANIZATION PROFILE ────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '720px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
              Organization Profile &amp; Identity
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Changes to your cafe identity require Super Admin approval before taking effect.
            </p>
          </div>

          {/* Info banner about approval workflow */}
          <div style={{
            padding: '0.85rem 1.1rem', borderRadius: '10px',
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
            display: 'flex', gap: '0.65rem', alignItems: 'flex-start'
          }}>
            <Info size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '0.1rem' }} />
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Organization identity fields are governed by your platform Super Admin to protect brand consistency. Submit a change request below — your Super Admin will review and apply it.
            </p>
          </div>

          {/* Pending requests summary */}
          {profileChanges.filter(c => c.status === 'pending').length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Pending Change Requests
              </p>
              {profileChanges.filter(c => c.status === 'pending').map(change => (
                <div key={change.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                  padding: '0.75rem 1rem', borderRadius: '10px',
                  background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ClockIcon size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
                        {change.field === 'cafe_name' ? 'Cafe Name' : change.field === 'counter_phone' ? 'Counter Phone' : 'Brand Logo'}
                        {' '}&rarr; <span style={{ color: 'var(--accent-text)' }}>{change.field === 'cafe_logo' ? '(New logo file)' : change.new_value}</span>
                      </p>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Submitted {formatDate(change.requested_at)} · Awaiting Super Admin review
                      </p>
                    </div>
                  </div>
                  <button onClick={() => cancelProfileChange(change.id)} className="btn-secondary btn-sm" style={{ color: 'var(--danger)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <X size={12} /> Cancel
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recent approved/rejected */}
          {profileChanges.filter(c => c.status !== 'pending').length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Recent Decisions
              </p>
              {profileChanges.filter(c => c.status !== 'pending').slice(0, 3).map(change => (
                <div key={change.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.65rem 0.9rem', borderRadius: '10px',
                  background: change.status === 'approved' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${change.status === 'approved' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                }}>
                  {change.status === 'approved'
                    ? <CheckCheck size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    : <XCircle size={13} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>
                      {change.field} change {change.status}
                      {change.reject_reason && <span style={{ color: 'var(--danger)' }}> — {change.reject_reason}</span>}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      Reviewed {formatDate(change.reviewed_at)} by {change.reviewed_by}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Editable fields */}
          {isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { field: 'cafe_name', label: 'Organization / Cafe Name', icon: Building2, settingKey: 'cafe_name', placeholder: 'e.g. Nexus Gaming Lounge' },
                { field: 'counter_phone', label: 'Counter / Support Phone', icon: Phone, settingKey: 'counter_phone', placeholder: 'e.g. +91 98765 43210' },
              ].map(({ field, label, icon: FIcon, settingKey, placeholder }) => {
                const currentVal = getSetting(settingKey)
                const isPending = pendingFields[field]

                return (
                  <div key={field} className="card" style={{ padding: '1.15rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.75rem' }}>
                      <FIcon size={15} style={{ color: 'var(--accent)' }} />
                      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                      {isPending && (
                        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '0.1rem 0.45rem', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <ClockIcon size={9} /> Pending
                        </span>
                      )}
                    </div>

                    <p style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>
                      {currentVal || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}
                    </p>

                    {orgEditMode === field ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                        <input
                          className="input"
                          placeholder={placeholder}
                          value={orgEditValue}
                          onChange={e => setOrgEditValue(e.target.value)}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => submitProfileChange(field, orgEditValue)}
                            disabled={orgSubmitting || !orgEditValue.trim() || orgEditValue.trim() === currentVal}
                            className="btn-primary"
                            style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            {orgSubmitting ? <><Spinner size="sm" /> Submitting...</> : 'Submit for Approval'}
                          </button>
                          <button onClick={() => { setOrgEditMode(null); setOrgEditValue('') }} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setOrgEditMode(field); setOrgEditValue(currentVal) }}
                        disabled={isPending}
                        className="btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', opacity: isPending ? 0.55 : 1 }}
                      >
                        {isPending ? <><Lock size={12} /> Change Pending</> : 'Request Change'}
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Logo upload card */}
              <div className="card" style={{ padding: '1.15rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.75rem' }}>
                  <ImageIcon size={15} style={{ color: 'var(--accent)' }} />
                  <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brand Logo Image</p>
                  {pendingFields['cafe_logo'] && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '0.1rem 0.45rem', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ClockIcon size={9} /> Pending
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
                  {(logoPreview || getSetting('cafe_logo')) ? (
                    <img
                      src={logoPreview || getSetting('cafe_logo')}
                      alt="Logo"
                      style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '1.5px solid var(--border)', background: 'var(--bg-input)' }}
                    />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent) 0%, rgba(59,130,246,0.4) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.1rem', border: '1.5px solid var(--border)' }}>
                      {(getSetting('cafe_name') || 'NL').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{logoFile ? logoFile.name : 'No file selected'}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>PNG, JPEG, WebP or SVG — max 2MB</p>
                  </div>
                </div>

                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={handleLogoFileSelect} />

                {!pendingFields['cafe_logo'] && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => logoInputRef.current?.click()} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                      <Upload size={13} /> {logoFile ? 'Change File' : 'Select Logo File'}
                    </button>
                    {logoFile && (
                      <button
                        onClick={handleLogoUpload}
                        disabled={logoUploading}
                        className="btn-primary"
                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        {logoUploading ? <><Spinner size="sm" /> Uploading...</> : 'Upload & Submit for Approval'}
                      </button>
                    )}
                    {logoFile && (
                      <button onClick={() => { setLogoFile(null); setLogoPreview('') }} className="btn-secondary btn-sm" style={{ fontSize: '0.78rem' }}>
                        Cancel
                      </button>
                    )}
                  </div>
                )}
                {pendingFields['cafe_logo'] && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Lock size={12} /> A logo change is pending Super Admin approval
                  </span>
                )}
              </div>

              {/* System operator handles */}
              <div className="card" style={{ padding: '1.15rem 1.25rem' }}>
                <p style={{ margin: '0 0 0.65rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Operator Handles</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    @{getSetting('org_slug', 'org')}_admin
                  </span>
                  <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    @{getSetting('org_slug', 'org')}_operator
                  </span>
                </div>
                <p style={{ margin: '0.55rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  These username handles are immutable and assigned by the platform. They cannot be changed.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL 1: AUTHORIZE STAFF MEMBER ─── */}
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Authorize New Staff Member">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
            Enter the staff member's Google or Clerk email address. When they log in via Clerk, they will be granted access to this cafe console.
          </p>

          <Field label="Staff Full Name *">
            <input
              className="input"
              placeholder="e.g. John Doe"
              value={inviteData.full_name}
              onChange={e => setInviteData(d => ({ ...d, full_name: e.target.value }))}
            />
          </Field>

          <Field label="Staff Google / Clerk Email *">
            <input
              type="email"
              className="input"
              placeholder="e.g. john.staff@gmail.com"
              value={inviteData.email}
              onChange={e => setInviteData(d => ({ ...d, email: e.target.value }))}
            />
          </Field>

          <Field label="Initial 4-Digit Counter PIN (for fast desk login)">
            <input
              type="text"
              maxLength={4}
              className="input"
              placeholder="1234"
              value={inviteData.pin}
              onChange={e => setInviteData(d => ({ ...d, pin: e.target.value }))}
              style={{ letterSpacing: '0.15em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
            />
          </Field>

          <Field label="Assign Role">
            <select
              className="input"
              value={inviteData.role}
              onChange={e => setInviteData(d => ({ ...d, role: e.target.value }))}
            >
              <option value="operator">Counter Operator</option>
              <option value="admin">Cafe Administrator</option>
            </select>
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleInviteStaff} disabled={inviteSaving} className="btn-primary" style={{ flex: 1 }}>
              {inviteSaving ? <><Spinner size="sm" /> Authorizing...</> : 'Authorize & Invite Staff'}
            </button>
            <button onClick={() => setShowInviteModal(false)} className="btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 2: RESET PIN ─── */}
      <Modal open={!!resettingUser} onClose={() => { setResettingUser(null); setShowNewPin(false) }} title={`Change PIN for @${resettingUser?.username}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
            Set a new 4-digit security PIN for <strong>{resettingUser?.full_name}</strong>.
          </p>

          <Field label="New 4-Digit PIN">
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPin ? 'text' : 'password'}
                maxLength={4}
                className="input"
                placeholder="e.g. 5566"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                style={{ letterSpacing: '0.25em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '1.1rem', textAlign: 'center', paddingRight: '2.5rem' }}
              />
              <button
                onClick={() => setShowNewPin(p => !p)}
                style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                type="button"
              >
                {showNewPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleResetPin} disabled={resetSaving} className="btn-primary" style={{ flex: 1 }}>
              {resetSaving ? <><Spinner size="sm" /> Updating...</> : 'Save New PIN'}
            </button>
            <button onClick={() => { setResettingUser(null); setShowNewPin(false) }} className="btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 3: ADD PLATFORM ─── */}
      <Modal open={showAddPlatform} onClose={() => setShowAddPlatform(false)} title="Add Recharge Platform">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Platform Name *">
            <input
              className="input"
              placeholder="e.g. Riot Games, Battle.net"
              value={newPlatform.name}
              onChange={e => setNewPlatform(p => ({ ...p, name: e.target.value }))}
            />
          </Field>

          <Field label="Description">
            <input
              className="input"
              placeholder="e.g. Valorant Points & Game Passes"
              value={newPlatform.description}
              onChange={e => setNewPlatform(p => ({ ...p, description: e.target.value }))}
            />
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleAddPlatform} disabled={platformSaving} className="btn-primary" style={{ flex: 1 }}>
              {platformSaving ? 'Adding...' : 'Add Platform'}
            </button>
            <button onClick={() => setShowAddPlatform(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 4: ADD DEVICE ─── */}
      <Modal open={showAddDevice} onClose={() => setShowAddDevice(false)} title="Add New Device">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Device Label *">
            <input className="input" placeholder="e.g. PC Station 6" value={newDevice.label} onChange={e => setNewDevice(d => ({ ...d, label: e.target.value }))} />
          </Field>
          <Field label="Device Type">
            <select className="input" value={newDevice.type} onChange={e => setNewDevice(d => ({ ...d, type: e.target.value }))}>
              <option value="PC">PC Station</option>
              <option value="XBOX">Xbox Console</option>
              <option value="PS">PlayStation Console</option>
            </select>
          </Field>
          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleAddDevice} disabled={deviceSaving} className="btn-primary" style={{ flex: 1 }}>
              {deviceSaving ? <><Spinner size="sm" /> Adding...</> : 'Add Device'}
            </button>
            <button onClick={() => setShowAddDevice(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      <TrialWarningModal
        open={trialModal.isOpen}
        onClose={() => setTrialModal({ isOpen: false, action: '' })}
        action={trialModal.action}
      />

    </div>
  )
}

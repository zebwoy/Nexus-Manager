import { useState, useEffect, useCallback } from 'react'
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
  AlertTriangle
} from 'lucide-react'

const TABS = [
  { key: 'staff',     label: 'Staff Authorizations & PINs', icon: Users },
  { key: 'audit',     label: 'Staff Operations Audit',      icon: Shield },
  { key: 'tariffs',   label: 'Lounges & Tariffs',           icon: Gamepad2 },
  { key: 'platforms', label: 'Recharge Platforms',          icon: Zap },
  { key: 'system',    label: 'System & Danger Zone',        icon: SettingsIcon },
]

export default function Settings() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.username === 'trial'
  const isTrial = user?.username === 'trial'

  const [activeTab, setActiveTab] = useState('staff')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Staff Management State
  const [staffUsers, setStaffUsers] = useState([])
  const [staffInvites, setStaffInvites] = useState([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteData, setInviteData] = useState({ full_name: '', email: '', pin: '1234', role: 'staff' })
  const [inviteSaving, setInviteSaving] = useState(false)

  // Reset PIN State
  const [resettingUser, setResettingUser] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [resetSaving, setResetSaving] = useState(false)

  // Audit Trail State
  const [auditLogs, setAuditLogs] = useState([])
  const [auditModuleFilter, setAuditModuleFilter] = useState('ALL')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)

  // Tariffs & Settings State
  const [settings, setSettings] = useState([])
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Platform management state
  const [platforms, setPlatforms] = useState([])
  const [showAddPlatform, setShowAddPlatform] = useState(false)
  const [newPlatform, setNewPlatform] = useState({ name: '', description: '' })
  const [platformSaving, setPlatformSaving] = useState(false)

  // Purge Modal
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [purging, setPurging] = useState(false)
  const [trialModal, setTrialModal] = useState({ isOpen: false, action: '' })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [staffRes, settRes, platRes] = await Promise.all([
        api.get('/staff'),
        api.get('/settings'),
        api.get('/platforms'),
      ])
      setStaffUsers(staffRes.users || [])
      setStaffInvites(staffRes.invites || [])
      setSettings(settRes.settings || [])
      const cafeNameSetting = settRes.settings?.find(s => s.key === 'cafe_name')?.value
      if (cafeNameSetting) {
        localStorage.setItem('nexus_tenant_name', cafeNameSetting)
      }
      setPlatforms(platRes.platforms || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true)
      const res = await api.get('/auth-audit')
      setAuditLogs(res.logs || [])
    } catch (e) {
      console.error('Audit load error:', e)
    } finally {
      setAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    loadAuditLogs()
  }, [loadData, loadAuditLogs])

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
      setInviteData({ full_name: '', email: '', pin: '1234', role: 'staff' })
      toast.success(`Staff authorization sent to ${inviteData.email}`)
      loadData()
      loadAuditLogs()
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
      toast.success(`PIN updated for @${resettingUser.username}`)
      loadData()
      loadAuditLogs()
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
      loadAuditLogs()
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
      loadAuditLogs()
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

  // ─── Settings Handlers ───
  const handleSettingChange = (key, value) => {
    setSettings(s => s.map(r => r.key === key ? { ...r, value } : r))
  }

  const saveSettings = async () => {
    if (isTrial) {
      setTrialModal({ isOpen: true, action: 'Modify System Settings' })
      return
    }
    setSettingsSaving(true)
    try {
      await api.post('/settings', { settings })
      const cafeNameSetting = settings.find(s => s.key === 'cafe_name')?.value
      if (cafeNameSetting) {
        localStorage.setItem('nexus_tenant_name', cafeNameSetting)
      }
      setSaveMsg('Configuration updated!')
      toast.success('System variables updated!')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSettingsSaving(false)
    }
  }

  // ─── Audit Filter Logic ───
  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesModule = auditModuleFilter === 'ALL' || (log.module || '').toLowerCase() === auditModuleFilter.toLowerCase()
    const matchesSearch = !auditSearch ||
      (log.username || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(auditSearch.toLowerCase())
    return matchesModule && matchesSearch
  })

  if (loading) return <PageLoader />

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
            Authorized control panel for staff access, security audits, game pricing, and system variables.
          </p>
        </div>

        <button onClick={() => { loadData(); loadAuditLogs() }} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={13} /> Refresh Data
        </button>
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
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 1: STAFF AUTHORIZATIONS & PINS ───────────────────────── */}
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

            <button onClick={() => setShowInviteModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1rem' }}>
              <UserPlus size={15} /> Authorize New Staff Member
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Staff Member</th>
                  <th style={{ width: '18%' }}>Counter PIN</th>
                  <th style={{ width: '14%' }}>Role</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ width: '25%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffUsers.map(st => (
                  <tr key={st.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: st.role === 'admin' ? 'var(--accent-dim)' : 'var(--bg-input)',
                          border: '1.5px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.85rem', fontWeight: 800, color: st.role === 'admin' ? 'var(--accent-text)' : 'var(--text)'
                        }}>
                          {st.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 800, fontSize: '0.875rem', color: 'var(--text)' }}>
                            {st.full_name}
                          </p>
                          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            @{st.username} {st.email ? `• ${st.email}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.25rem 0.55rem', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                        <KeyRound size={12} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.825rem', fontWeight: 800, letterSpacing: '0.15em' }}>
                          ••••
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${st.role === 'admin' ? 'badge-accent' : 'badge-neutral'}`} style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                        {st.role === 'admin' ? 'Cafe Admin' : 'Counter Staff'}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${st.status === 'suspended' ? 'badge-danger' : st.status === 'invited' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                        {st.status === 'suspended' ? 'Suspended' : st.status === 'invited' ? 'Pending Invite' : 'Active'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.45rem' }}>
                        <button
                          onClick={() => { setResettingUser(st); setNewPin(''); setError('') }}
                          className="btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        >
                          Change PIN
                        </button>

                        {st.username !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleToggleStaffStatus(st)}
                              className="btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: st.status === 'suspended' ? 'var(--success)' : 'var(--text-muted)' }}
                            >
                              {st.status === 'suspended' ? 'Activate' : 'Suspend'}
                            </button>

                            <button
                              onClick={() => handleRevokeStaff(st.id, st.full_name)}
                              className="btn-secondary btn-sm"
                              style={{ color: 'var(--danger)', padding: '0.35rem 0.5rem' }}
                              title="Revoke Access"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 2: GRANULAR STAFF AUDIT TRAIL ────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
              Granular Staff Operations Ledger
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Comprehensive real-time forensic trail tracking all edits, deletions, price overrides, and cash reconciliations.
            </p>
          </div>

          {/* Module Filter Pills & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
            <div style={{
              display: 'flex', gap: '0.35rem', flexWrap: 'wrap', padding: '0.25rem',
              borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)'
            }}>
              {[
                { id: 'ALL',       label: 'All Modules', icon: Layers },
                { id: 'sessions',  label: 'Sessions', icon: Gamepad2 },
                { id: 'recharges', label: 'Recharges', icon: Zap },
                { id: 'cafeteria', label: 'Cafeteria', icon: Coffee },
                { id: 'expenses',  label: 'Expenses', icon: TrendingDown },
                { id: 'bod',       label: 'BOD Opening Cash', icon: Clock },
                { id: 'eod',       label: 'EOD Shift Closing', icon: FileCheck },
                { id: 'staff',     label: 'Staff Security', icon: Users },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setAuditModuleFilter(m.id)}
                  style={{
                    padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 750,
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                    background: auditModuleFilter === m.id ? 'var(--bg-card)' : 'transparent',
                    color: auditModuleFilter === m.id ? 'var(--text)' : 'var(--text-muted)',
                    boxShadow: auditModuleFilter === m.id ? 'var(--shadow)' : 'none'
                  }}
                >
                  <m.icon size={13} />
                  {m.label}
                </button>
              ))}
            </div>

            <input
              className="input"
              style={{ width: '260px', height: '36px', fontSize: '0.8rem' }}
              placeholder="Search actions or staff..."
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
            />
          </div>

          {/* Data Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
            <table className="tbl" style={{ width: '100%', minWidth: '880px' }}>
              <thead>
                <tr>
                  <th style={{ width: '16%' }}>Timestamp</th>
                  <th style={{ width: '14%' }}>Staff Operator</th>
                  <th style={{ width: '14%' }}>Module</th>
                  <th style={{ width: '16%' }}>Action</th>
                  <th style={{ width: '40%' }}>Event Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                      No audit events found matching the selected module filter.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDate(log.created_at)} {formatTime(log.created_at)}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span className="led-indicator led-green" style={{ width: '5px', height: '5px' }} />
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                            @{log.username || 'staff'}
                          </strong>
                        </div>
                      </td>

                      <td>
                        <span className="badge" style={{ fontSize: '0.675rem', fontWeight: 800, textTransform: 'uppercase' }}>
                          {log.module || 'general'}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${log.action?.includes('DELETE') ? 'badge-danger' : log.action?.includes('CREATE') ? 'badge-success' : 'badge-accent'}`} style={{ fontSize: '0.675rem', fontWeight: 800 }}>
                          {log.action}
                        </span>
                      </td>

                      <td>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text)', fontWeight: 550, lineHeight: 1.45 }}>
                          {log.details}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 3: LOUNGES & TARIFFS ─────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tariffs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
              Pricing &amp; Tariff Configurations
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Control station add-on fees, additional controller rates, and extra player surcharges.
            </p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '640px' }}>
            <Field label="Additional Controller Surcharge (₹)">
              <input
                type="number"
                className="input"
                value={settings.find(s => s.key === 'controller_fee')?.value || '50'}
                onChange={e => handleSettingChange('controller_fee', e.target.value)}
              />
            </Field>

            <Field label="Extra Person Surcharge (₹)">
              <input
                type="number"
                className="input"
                value={settings.find(s => s.key === 'extra_person_fee')?.value || '30'}
                onChange={e => handleSettingChange('extra_person_fee', e.target.value)}
              />
            </Field>

            <Field label="Extra Person Starts From Player #">
              <input
                type="number"
                className="input"
                value={settings.find(s => s.key === 'extra_person_from')?.value || '3'}
                onChange={e => handleSettingChange('extra_person_from', e.target.value)}
              />
            </Field>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={saveSettings} disabled={settingsSaving} className="btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
                {settingsSaving ? <><Spinner size="sm" /> Saving...</> : 'Save Tariff Settings'}
              </button>
              {saveMsg && <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700 }}>✓ {saveMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 4: RECHARGE PLATFORMS ────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'platforms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
                Gaming &amp; Wallet Platforms
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Manage supported gaming platforms for balance recharges and game key top-ups.
              </p>
            </div>

            <button onClick={() => setShowAddPlatform(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1rem' }}>
              <PlusCircle size={15} /> Add Platform
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {platforms.map(p => (
              <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' }}>{p.name}</h4>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.description || 'Supported wallet'}</p>
                </div>

                <button onClick={() => handleDeletePlatform(p.id)} className="btn-secondary btn-sm" style={{ color: 'var(--danger)', padding: '0.4rem' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 5: SYSTEM & DANGER ZONE ──────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '680px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
              System Configuration &amp; Danger Zone
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Manage lounge branding and database reset utilities.
            </p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Field label="Cafe Organization Title">
              <input
                className="input"
                value={settings.find(s => s.key === 'cafe_name')?.value || ''}
                placeholder="e.g. Headshot Gaming Cafe"
                onChange={e => handleSettingChange('cafe_name', e.target.value)}
              />
            </Field>

            <Field label="Counter Help / Phone Number">
              <input
                className="input"
                value={settings.find(s => s.key === 'counter_phone')?.value || '+91 98765 43210'}
                onChange={e => handleSettingChange('counter_phone', e.target.value)}
              />
            </Field>

            <button onClick={saveSettings} disabled={settingsSaving} className="btn-primary" style={{ width: 'fit-content' }}>
              {settingsSaving ? 'Saving...' : 'Save Organization Variables'}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="card" style={{ border: '1.5px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--danger)', marginBottom: '0.35rem' }}>
              <AlertTriangle size={16} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Danger Zone</h4>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Purging data will permanently erase all shift sessions, transactions, and recharges in this schema. This cannot be undone.
            </p>
            <button
              onClick={() => {
                if (isTrial) {
                  setTrialModal({ isOpen: true, action: 'Purge Cafe Data' })
                  return
                }
                setShowPurgeModal(true)
              }}
              className="btn-danger"
              style={{ width: 'fit-content' }}
            >
              Reset / Purge Cafe Transaction Ledger
            </button>
          </div>
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
              <option value="staff">Counter Staff (Operator)</option>
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
      <Modal open={!!resettingUser} onClose={() => setResettingUser(null)} title={`Change PIN for @${resettingUser?.username}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
            Set a new 4-digit security PIN for <strong>{resettingUser?.full_name}</strong>.
          </p>

          <Field label="New 4-Digit PIN">
            <input
              type="text"
              maxLength={4}
              className="input"
              placeholder="e.g. 5566"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              style={{ letterSpacing: '0.2em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '1.1rem', textAlign: 'center' }}
            />
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleResetPin} disabled={resetSaving} className="btn-primary" style={{ flex: 1 }}>
              {resetSaving ? <><Spinner size="sm" /> Updating...</> : 'Save New PIN'}
            </button>
            <button onClick={() => setResettingUser(null)} className="btn-secondary" style={{ flex: 1 }}>
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
            <button onClick={() => setShowAddPlatform(false)} className="btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
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

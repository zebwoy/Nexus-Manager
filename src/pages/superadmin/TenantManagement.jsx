import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/helpers'
import { PageLoader, ErrorMsg, Modal, ConfirmModal, Field, Spinner } from '../../components/UI'
import {
  Building2, Plus, Search, Edit3, Trash2, Power, RotateCcw,
  ExternalLink, Shield, Monitor, Gamepad2, Database, Mail,
  CheckCircle2, AlertCircle, X, Sparkles, Filter, Users
} from 'lucide-react'
import { toast } from 'react-toastify'

export function generateInitialismSlug(name) {
  if (!name) return ''
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return words.map(w => w[0]).join('').toLowerCase().replace(/[^a-z0-9]/g, '')
  }
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
}

export default function TenantManagement() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'suspended'

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    admin_email: '',
    plan: 'pro'
  })
  const [creating, setCreating] = useState(false)

  // Edit modal
  const [editTenant, setEditTenant] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    admin_email: '',
    plan: 'pro',
    status: 'active'
  })
  const [editing, setEditing] = useState(false)

  // Delete modal
  const [deleteTenant, setDeleteTenant] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Reset modal
  const [resetTenant, setResetTenant] = useState(null)
  const [resetting, setResetting] = useState(false)

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/super-admin?action=tenants')
      setTenants(res.tenants || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTenants() }, [loadTenants])

  const handleCreateOrg = async () => {
    if (!createForm.name?.trim() || !createForm.admin_email?.trim()) {
      setError('Organization name and Admin email are required')
      return
    }
    setCreating(true)
    setError('')
    try {
      const res = await api.post('/super-admin?action=tenants', createForm)
      toast.success(`Organization "${res.tenant.name}" created and schema provisioned!`)
      setShowCreateModal(false)
      setCreateForm({ name: '', slug: '', admin_email: '', plan: 'pro' })
      loadTenants()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const openEditModal = (t) => {
    setEditTenant(t)
    setEditForm({
      name: t.name,
      admin_email: t.admin_email,
      plan: t.plan || 'pro',
      status: t.status || 'active'
    })
  }

  const handleSaveEdit = async () => {
    if (!editTenant) return
    setEditing(true)
    try {
      await api.patch(`/super-admin?action=tenants&id=${editTenant.id}`, editForm)
      toast.success(`Updated tenant ${editForm.name}`)
      setEditTenant(null)
      loadTenants()
    } catch (e) {
      toast.error('Failed to update tenant: ' + e.message)
    } finally {
      setEditing(false)
    }
  }

  const handleToggleStatus = async (t) => {
    const nextStatus = t.status === 'active' ? 'suspended' : 'active'
    try {
      await api.patch(`/super-admin?action=tenants&id=${t.id}`, { status: nextStatus })
      toast.info(`Organization ${t.name} is now ${nextStatus}`)
      loadTenants()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleDeleteTenant = async () => {
    if (!deleteTenant) return
    setDeleting(true)
    try {
      await api.delete(`/super-admin?action=tenants&id=${deleteTenant.id}`)
      toast.success(`Deleted ${deleteTenant.name} and dropped schema "${deleteTenant.schema_name}"`)
      setDeleteTenant(null)
      loadTenants()
    } catch (e) {
      toast.error('Delete failed: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleResetData = async () => {
    if (!resetTenant) return
    setResetting(true)
    try {
      await api.post(`/super-admin?action=reset-tenant&id=${resetTenant.id}`)
      toast.success(`Reset transactional data for ${resetTenant.name}`)
      setResetTenant(null)
      loadTenants()
    } catch (e) {
      toast.error('Reset failed: ' + e.message)
    } finally {
      setResetting(false)
    }
  }

  const handleImpersonate = (t) => {
    localStorage.setItem('nexus_tenant_schema', t.schema_name)
    localStorage.setItem('nexus_tenant_name', t.name)
    toast.success(`Switched context to "${t.name}" (${t.schema_name})`)
    navigate('/')
  }

  const activeCount = tenants.filter(t => t.status === 'active').length
  const suspendedCount = tenants.filter(t => t.status === 'suspended').length

  const filteredTenants = tenants.filter(t => {
    const matchesSearch =
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.admin_email?.toLowerCase().includes(search.toLowerCase()) ||
      t.schema_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.org_id?.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || t.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (loading) return <PageLoader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* ─── CREATE MODAL ─── */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Organization & Provision Schema">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Organization / Cafe Name" required>
            <input
              className="input"
              placeholder="e.g. Velocity Gaming Lounge"
              value={createForm.name}
              onChange={e => {
                const name = e.target.value
                const autoSlug = generateInitialismSlug(name)
                setCreateForm(f => ({ ...f, name, slug: autoSlug }))
              }}
              autoFocus
            />
          </Field>

          <Field label="Auto-Assigned Schema Slug (Read-Only)">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.85rem',
                color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                <Database size={15} style={{ color: 'var(--accent)' }} />
                <span>{createForm.slug ? `tenant_${createForm.slug}` : 'tenant_...'}</span>
              </div>
              <span className="badge badge-accent" style={{ flexShrink: 0, fontSize: '0.7rem' }}>
                Auto-Slug
              </span>
            </div>
            <p style={{ fontSize: '0.725rem', color: 'var(--text-faint)', marginTop: '0.35rem' }}>
              Automatically initialised from the first letter of each word in the cafe name.
            </p>
          </Field>

          <Field label="Assign Admin Email (Clerk / Google Account)" required>
            <input
              type="email"
              className="input"
              placeholder="e.g. owner@velocitygaming.com"
              value={createForm.admin_email}
              onChange={e => setCreateForm(f => ({ ...f, admin_email: e.target.value }))}
            />
            <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              The admin will sign in with this exact email to manage this gaming lounge.
            </p>
          </Field>

          <Field label="Subscription Plan">
            <select className="input" value={createForm.plan} onChange={e => setCreateForm(f => ({ ...f, plan: e.target.value }))}>
              <option value="starter">Starter Plan (Up to 10 Stations)</option>
              <option value="pro">Pro Lounge Plan (Up to 25 Stations)</option>
              <option value="enterprise">Enterprise Franchise Plan (Unlimited)</option>
            </select>
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleCreateOrg} disabled={creating} className="btn-primary" style={{ flex: 1 }}>
              {creating ? <><Spinner size="sm" /> Provisioning Schema...</> : 'Provision Organization'}
            </button>
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ─── EDIT MODAL ─── */}
      <Modal open={!!editTenant} onClose={() => setEditTenant(null)} title={`Edit ${editTenant?.name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Organization Name">
            <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Assigned Admin Email" required>
            <input type="email" className="input" value={editForm.admin_email} onChange={e => setEditForm(f => ({ ...f, admin_email: e.target.value }))} />
          </Field>
          <Field label="Plan">
            <select className="input" value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}>
              <option value="starter">Starter Plan</option>
              <option value="pro">Pro Lounge Plan</option>
              <option value="enterprise">Enterprise Franchise Plan</option>
            </select>
          </Field>
          <Field label="Organization Status">
            <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active (Operational)</option>
              <option value="suspended">Suspended (Access Disabled)</option>
            </select>
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleSaveEdit} disabled={editing} className="btn-primary" style={{ flex: 1 }}>
              {editing ? <><Spinner size="sm" /> Saving...</> : 'Save Changes'}
            </button>
            <button onClick={() => setEditTenant(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ─── CONFIRMATION MODALS ─── */}
      <ConfirmModal
        open={!!deleteTenant}
        onClose={() => setDeleteTenant(null)}
        onConfirm={handleDeleteTenant}
        loading={deleting}
        title="Delete Organization & Drop Schema"
        message={`Are you sure you want to permanently delete "${deleteTenant?.name}"? This will DROP the PostgreSQL schema "${deleteTenant?.schema_name}" with CASCADE and erase all associated sessions, inventory, and ledger history.`}
        danger
      />

      <ConfirmModal
        open={!!resetTenant}
        onClose={() => setResetTenant(null)}
        onConfirm={handleResetData}
        loading={resetting}
        title="Reset Transactional Data"
        message={`Are you sure you want to purge all transactional session, sales, and expense logs for "${resetTenant?.name}"? System configurations, devices, and inventory catalog items will be preserved.`}
      />

      {/* ─── TOP HEADER BAR ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: '1.25rem'
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.25rem 0.75rem', borderRadius: '100px',
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            marginBottom: '0.65rem'
          }}>
            <span className="led-indicator led-green" style={{ width: '6px', height: '6px' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Multi-Tenant Schema Architecture
            </span>
          </div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
            Organizations &amp; Schemas
          </h1>
          <p className="page-sub" style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Provision isolated PostgreSQL schemas, assign lounge owner emails, and oversee fleet infrastructure.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem', fontSize: '0.875rem', fontWeight: 800,
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Create Organization
        </button>
      </div>

      <ErrorMsg error={error} />

      {/* ─── KPI SUMMARY TILES ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <Building2 size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Lounges</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{tenants.length}</p>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active &amp; Operational</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>{activeCount}</p>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
            <Database size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Isolated Schemas</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{tenants.length}</p>
          </div>
        </div>
      </div>

      {/* ─── SEARCH & FILTER CONTROLS ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.85rem'
      }}>
        {/* Status Pill Switcher */}
        <div style={{
          display: 'inline-flex', padding: '0.25rem', borderRadius: '10px',
          background: 'var(--bg-input)', border: '1px solid var(--border)'
        }}>
          {[
            { id: 'all', label: `All (${tenants.length})` },
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'suspended', label: `Suspended (${suspendedCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 750,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                background: statusFilter === tab.id ? 'var(--bg-card)' : 'transparent',
                color: statusFilter === tab.id ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: statusFilter === tab.id ? 'var(--shadow)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Minimal Search Bar */}
        <div style={{ position: 'relative', minWidth: '280px', flex: '1', maxWidth: '420px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.4rem', paddingRight: search ? '2.4rem' : '0.85rem', height: '38px', borderRadius: '10px' }}
            placeholder="Search organizations, admins, schemas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ─── DATA GRID / TABLE CARD ─── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', minWidth: '940px' }}>
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Organization &amp; ID</th>
                <th style={{ width: '18%' }}>Schema Identifier</th>
                <th style={{ width: '22%' }}>Assigned Administrator</th>
                <th style={{ width: '12%' }}>Plan &amp; Fleet</th>
                <th style={{ width: '8%' }}>Status</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <Building2 size={24} />
                      </div>
                      <p style={{ margin: 0, fontWeight: 750, fontSize: '0.95rem', color: 'var(--text)' }}>
                        No organizations found
                      </p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '320px' }}>
                        {search ? `No results matching "${search}". Try searching with a different term.` : 'Click "Create Organization" above to provision your first gaming cafe schema.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const initialism = t.slug ? t.slug.toUpperCase() : (t.name || 'OG').slice(0, 3).toUpperCase()
                  
                  return (
                    <tr key={t.id} style={{ transition: 'background 0.15s ease' }}>
                      {/* Organization & ID */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, var(--accent-dim) 0%, var(--bg-card) 100%)',
                            border: '1px solid var(--accent-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-text)', flexShrink: 0,
                            letterSpacing: '0.04em'
                          }}>
                            {initialism}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <p style={{ margin: 0, fontWeight: 800, color: 'var(--text)', fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {t.name}
                            </p>
                            <span style={{ fontSize: '0.675rem', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {t.org_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Schema Identifier */}
                      <td>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.3rem 0.6rem', borderRadius: '8px',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--accent-text)', fontWeight: 700
                        }}>
                          <Database size={12} style={{ color: 'var(--accent)' }} />
                          {t.schema_name}
                        </div>
                      </td>

                      {/* Assigned Administrator */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '26px', height: '26px', borderRadius: '50%',
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-muted)', flexShrink: 0
                          }}>
                            <Mail size={12} />
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.825rem', color: 'var(--text)' }}>
                              {t.admin_email}
                            </p>
                            <span style={{ fontSize: '0.675rem', color: 'var(--text-faint)' }}>
                              Verified Admin
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Plan & Fleet */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className="badge badge-accent" style={{
                            textTransform: 'uppercase', fontSize: '0.625rem', fontWeight: 800, width: 'fit-content',
                            background: t.plan === 'enterprise' ? 'rgba(139, 92, 246, 0.15)' : 'var(--accent-dim)',
                            color: t.plan === 'enterprise' ? '#a78bfa' : 'var(--accent-text)',
                            borderColor: t.plan === 'enterprise' ? 'rgba(139, 92, 246, 0.3)' : 'var(--accent-border)'
                          }}>
                            {t.plan || 'Pro'}
                          </span>
                          <div style={{ display: 'flex', gap: '0.45rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>🖥️ {t.device_count || 0} dev</span>
                            <span>🎮 {t.session_count || 0} sess</span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge ${t.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem', fontWeight: 750 }}>
                          {t.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={() => handleImpersonate(t)}
                            className="btn-primary btn-sm"
                            style={{
                              padding: '0.35rem 0.7rem', fontSize: '0.725rem', fontWeight: 750,
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              borderRadius: '8px'
                            }}
                            title="Launch cafe console workspace"
                          >
                            <ExternalLink size={12} /> Launch
                          </button>

                          <button
                            onClick={() => openEditModal(t)}
                            className="btn-secondary btn-sm"
                            style={{ padding: '0.35rem 0.55rem', borderRadius: '8px' }}
                            title="Edit / Reassign Admin"
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(t)}
                            className="btn-secondary btn-sm"
                            style={{ padding: '0.35rem 0.55rem', borderRadius: '8px' }}
                            title={t.status === 'active' ? 'Suspend Access' : 'Activate Access'}
                          >
                            <Power size={13} style={{ color: t.status === 'active' ? 'var(--warning)' : 'var(--success)' }} />
                          </button>

                          <button
                            onClick={() => setResetTenant(t)}
                            className="btn-secondary btn-sm"
                            style={{ padding: '0.35rem 0.55rem', borderRadius: '8px' }}
                            title="Reset transactional data"
                          >
                            <RotateCcw size={13} />
                          </button>

                          <button
                            onClick={() => setDeleteTenant(t)}
                            className="btn-secondary btn-sm"
                            style={{ padding: '0.35rem 0.55rem', borderRadius: '8px', color: 'var(--danger)' }}
                            title="Delete Organization"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/helpers'
import { PageLoader, ErrorMsg, Modal, ConfirmModal, Field, Spinner, FilterBar } from '../../components/UI'
import { Building2, Plus, Search, Edit3, Trash2, Power, RotateCcw, ExternalLink, ShieldAlert, CheckCircle, Monitor, Gamepad2 } from 'lucide-react'
import { toast } from 'react-toastify'

export default function TenantManagement() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    admin_email: '',
    admin_name: '',
    plan: 'pro',
    max_devices: 20
  })
  const [creating, setCreating] = useState(false)

  // Edit modal
  const [editTenant, setEditTenant] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    admin_email: '',
    admin_name: '',
    plan: 'pro',
    max_devices: 20,
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
      setCreateForm({ name: '', slug: '', admin_email: '', admin_name: '', plan: 'pro', max_devices: 20 })
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
      admin_name: t.admin_name || '',
      plan: t.plan || 'pro',
      max_devices: t.max_devices || 20,
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
    // Store active tenant schema in localStorage for testing / session switching
    localStorage.setItem('nexus_tenant_schema', t.schema_name)
    localStorage.setItem('nexus_tenant_name', t.name)
    toast.success(`Switched context to "${t.name}" (${t.schema_name})`)
    navigate('/')
  }

  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.admin_email?.toLowerCase().includes(search.toLowerCase()) ||
    t.schema_name?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <PageLoader />

  return (
    <div>
      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Organization &amp; Schema">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Organization / Cafe Name" required>
            <input
              className="input"
              placeholder="e.g. Pixel Forge Cyber Cafe"
              value={createForm.name}
              onChange={e => {
                const name = e.target.value
                const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)
                setCreateForm(f => ({ ...f, name, slug: f.slug ? f.slug : autoSlug }))
              }}
            />
          </Field>

          <Field label="Unique Schema Slug" required>
            <input
              className="input"
              placeholder="e.g. pixel_forge"
              value={createForm.slug}
              onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Admin Email (Clerk Account)" required>
              <input
                type="email"
                className="input"
                placeholder="admin@pixelforge.com"
                value={createForm.admin_email}
                onChange={e => setCreateForm(f => ({ ...f, admin_email: e.target.value }))}
              />
            </Field>
            <Field label="Admin Full Name">
              <input
                className="input"
                placeholder="Chris Evans"
                value={createForm.admin_name}
                onChange={e => setCreateForm(f => ({ ...f, admin_name: e.target.value }))}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Subscription Plan">
              <select className="input" value={createForm.plan} onChange={e => setCreateForm(f => ({ ...f, plan: e.target.value }))}>
                <option value="starter">Starter (10 Stations)</option>
                <option value="pro">Pro (25 Stations)</option>
                <option value="enterprise">Enterprise (Unlimited)</option>
              </select>
            </Field>
            <Field label="Max Station Limit">
              <input
                type="number"
                className="input"
                value={createForm.max_devices}
                onChange={e => setCreateForm(f => ({ ...f, max_devices: e.target.value }))}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleCreateOrg} disabled={creating} className="btn-primary" style={{ flex: 1 }}>
              {creating ? <><Spinner size="sm" /> Provisioning...</> : 'Provision Organization'}
            </button>
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Edit / Assign Admin Modal */}
      <Modal open={!!editTenant} onClose={() => setEditTenant(null)} title={`Edit ${editTenant?.name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Organization Name">
            <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Assigned Admin Email" required>
              <input className="input" value={editForm.admin_email} onChange={e => setEditForm(f => ({ ...f, admin_email: e.target.value }))} />
            </Field>
            <Field label="Admin Full Name">
              <input className="input" value={editForm.admin_name} onChange={e => setEditForm(f => ({ ...f, admin_name: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Plan">
              <select className="input" value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </Field>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleSaveEdit} disabled={editing} className="btn-primary" style={{ flex: 1 }}>
              {editing ? <><Spinner size="sm" /> Saving...</> : 'Save Changes'}
            </button>
            <button onClick={() => setEditTenant(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTenant}
        onClose={() => setDeleteTenant(null)}
        onConfirm={handleDeleteTenant}
        loading={deleting}
        title="Delete Organization &amp; Drop Schema"
        message={`Are you sure you want to permanently delete "${deleteTenant?.name}"? This will DROP the PostgreSQL schema "${deleteTenant?.schema_name}" with CASCADE and erase all associated sessions, inventory, and ledger history.`}
        danger
      />

      {/* Reset Confirmation */}
      <ConfirmModal
        open={!!resetTenant}
        onClose={() => setResetTenant(null)}
        onConfirm={handleResetData}
        loading={resetting}
        title="Reset Transactional Data"
        message={`Are you sure you want to purge all transactional session, sales, and expense logs for "${resetTenant?.name}"? System configurations, devices, and inventory catalog items will be preserved.`}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Organizations &amp; Tenant Schemas
          </h1>
          <p className="page-sub" style={{ marginTop: '0.35rem' }}>
            {tenants.length} total organizations · PostgreSQL Schema-per-tenant isolation
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.15rem' }}
        >
          <Plus size={16} />
          Create Organization
        </button>
      </div>

      <ErrorMsg error={error} />

      {/* Filter Bar */}
      <FilterBar style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by name, admin email, or schema..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Schema Identifier</th>
              <th>Assigned Admin</th>
              <th>Plan</th>
              <th>Fleet Stats</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  No organizations found matching your search.
                </td>
              </tr>
            ) : (
              filteredTenants.map((t) => (
                <tr key={t.id}>
                  <td>
                    <p style={{ fontWeight: 750, color: 'var(--text)', margin: 0, fontSize: '0.875rem' }}>{t.name}</p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>{t.org_id}</span>
                  </td>
                  <td>
                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-text)', background: 'var(--bg-input)', padding: '0.2rem 0.45rem', borderRadius: '6px' }}>
                      {t.schema_name}
                    </code>
                  </td>
                  <td>
                    <p style={{ margin: 0, fontWeight: 650, fontSize: '0.8rem', color: 'var(--text)' }}>{t.admin_name || 'Admin'}</p>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{t.admin_email}</span>
                  </td>
                  <td>
                    <span className="badge badge-accent" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      {t.plan}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>🖥️ {t.device_count || 0} dev</span>
                      <span>🎮 {t.session_count || 0} sess</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${t.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                      <button
                        onClick={() => handleImpersonate(t)}
                        className="btn-primary btn-sm"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        title="Open cafe console in this schema"
                      >
                        <ExternalLink size={12} /> Launch
                      </button>
                      <button
                        onClick={() => openEditModal(t)}
                        className="btn-secondary btn-sm"
                        style={{ padding: '0.3rem 0.55rem' }}
                        title="Edit / Reassign Admin"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(t)}
                        className="btn-secondary btn-sm"
                        style={{ padding: '0.3rem 0.55rem', color: t.status === 'active' ? 'var(--warning)' : 'var(--success)' }}
                        title={t.status === 'active' ? 'Suspend Organization' : 'Activate Organization'}
                      >
                        <Power size={13} />
                      </button>
                      <button
                        onClick={() => setResetTenant(t)}
                        className="btn-secondary btn-sm"
                        style={{ padding: '0.3rem 0.55rem' }}
                        title="Reset Test Transactions"
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTenant(t)}
                        className="btn-secondary btn-sm"
                        style={{ padding: '0.3rem 0.55rem', color: 'var(--danger)' }}
                        title="Delete Organization & Drop Schema"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

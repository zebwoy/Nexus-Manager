import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatTime, formatDate } from '../../lib/helpers'
import { PageLoader, ErrorMsg, Modal, Field, Spinner } from '../../components/UI'
import { Shield, Building2, Monitor, Gamepad2, Plus, ArrowUpRight, History, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { toast } from 'react-toastify'

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create Org Modal
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

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/super-admin?action=overview')
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOverview() }, [loadOverview])

  const handleCreateOrg = async () => {
    if (!createForm.name?.trim() || !createForm.admin_email?.trim()) {
      setError('Please provide an organization name and admin email')
      return
    }
    setCreating(true)
    setError('')
    try {
      const res = await api.post('/super-admin?action=tenants', createForm)
      toast.success(`Organization "${res.tenant.name}" and schema provisioned!`)
      setShowCreateModal(false)
      setCreateForm({ name: '', slug: '', admin_email: '', admin_name: '', plan: 'pro', max_devices: 20 })
      loadOverview()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <PageLoader />

  const kpis = [
    { label: 'Total Organizations', value: data?.total_tenants || 0, sub: `${data?.active_tenants || 0} active`, icon: Building2, color: '#3b82f6' },
    { label: 'Active Gaming Stations', value: data?.total_stations || 0, sub: 'Across all cafes', icon: Monitor, color: '#10b981' },
    { label: 'Total Sessions Logged', value: data?.total_sessions || 0, sub: 'Platform-wide', icon: Gamepad2, color: '#8b5cf6' },
    { label: 'Platform Schemas', value: `${data?.active_tenants || 0} isolated`, sub: 'Zero data leakage', icon: Shield, color: '#f59e0b' },
  ]

  return (
    <div>
      {/* Create Org Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Organization & Provision Schema">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Organization / Cafe Name" required>
            <input
              className="input"
              placeholder="e.g. Velocity Gaming Lounge"
              value={createForm.name}
              onChange={e => {
                const name = e.target.value
                const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)
                setCreateForm(f => ({ ...f, name, slug: f.slug ? f.slug : autoSlug }))
              }}
            />
          </Field>

          <Field label="Schema Slug Identifier" required>
            <input
              className="input"
              placeholder="e.g. velocity_gaming"
              value={createForm.slug}
              onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Admin Email (Clerk Account)" required>
              <input
                type="email"
                className="input"
                placeholder="owner@cafe.com"
                value={createForm.admin_email}
                onChange={e => setCreateForm(f => ({ ...f, admin_email: e.target.value }))}
              />
            </Field>
            <Field label="Admin Full Name">
              <input
                className="input"
                placeholder="Alex Morgan"
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

          <div style={{
            background: 'var(--bg-input)', padding: '0.85rem', borderRadius: '10px',
            border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)'
          }}>
            ⚡ Automatic Provisioning: Creating this organization will automatically execute a dedicated PostgreSQL schema (<code>tenant_{createForm.slug || 'slug'}</code>) with isolated tables, default devices, and pricing rules.
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleCreateOrg} disabled={creating} className="btn-primary" style={{ flex: 1 }}>
              {creating ? <><Spinner size="sm" /> Provisioning Schema...</> : 'Provision Organization'}
            </button>
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            Fleet Command &amp; Multi-Tenancy
          </h1>
          <p className="page-sub" style={{ marginTop: '0.35rem' }}>
            Manage isolated cafe organizations, provision PostgreSQL schemas, and audit global platform activity.
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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {kpis.map((kpi, idx) => (
          <div key={idx} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '12px',
              background: `${kpi.color}15`, border: `1.5px solid ${kpi.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: kpi.color, flexShrink: 0
            }}>
              <kpi.icon size={22} />
            </div>
            <div>
              <p style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                {kpi.label}
              </p>
              <p style={{ fontSize: '1.4rem', fontWeight: 850, color: 'var(--text)', margin: '0.2rem 0 0', lineHeight: 1 }}>
                {kpi.value}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', margin: '0.25rem 0 0' }}>
                {kpi.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Section: Recent Organizations & Recent Audit Trail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Organizations Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={16} style={{ color: 'var(--accent-text)' }} />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Registered Organizations
              </h3>
            </div>
            <Link to="/super-admin/tenants" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-text)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              View All <ArrowUpRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(data?.tenants || []).map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.75rem 1rem', borderRadius: '10px',
                  background: 'var(--bg-input)', border: '1px solid var(--border)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 750, fontSize: '0.85rem', color: 'var(--text)' }}>{t.name}</span>
                    <span className={`badge ${t.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.625rem' }}>
                      {t.status}
                    </span>
                    <span className="badge badge-accent" style={{ fontSize: '0.625rem' }}>
                      {t.plan}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', margin: '0.25rem 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
                    Schema: <strong>{t.schema_name}</strong> · Admin: {t.admin_email}
                  </p>
                </div>

                <Link
                  to={`/super-admin/tenants`}
                  className="btn-secondary btn-sm"
                  style={{ fontSize: '0.725rem', padding: '0.35rem 0.65rem' }}
                >
                  Manage
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Global Audits Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={16} style={{ color: '#f59e0b' }} />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Platform Audit Trail
              </h3>
            </div>
            <Link to="/super-admin/audit" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-text)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Full Log <ArrowUpRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {(data?.recent_audits || []).slice(0, 5).map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '0.65rem 0.85rem', borderRadius: '8px',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.775rem'
                }}
              >
                <div>
                  <span className="badge badge-accent" style={{ fontSize: '0.6rem', marginRight: '0.5rem' }}>
                    {log.action}
                  </span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{log.details}</span>
                </div>
                <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, marginLeft: '0.5rem' }}>
                  {formatDate(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

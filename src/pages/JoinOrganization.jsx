import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { PageLoader, ErrorMsg, Spinner } from '../components/UI'
import {
  Shield, Building2, CheckCircle2, ArrowRight, LogOut,
  RefreshCw, Sparkles, UserCheck, Search, Clock, Send, Check
} from 'lucide-react'
import { useUser, useClerk } from '@clerk/clerk-react'
import { toast } from 'react-toastify'

export default function JoinOrganization() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const { login, logout } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invites, setInvites] = useState([])
  const [availableOrgs, setAvailableOrgs] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [search, setSearch] = useState('')
  const [requestingSchema, setRequestingSchema] = useState(null)
  const [acceptingSchema, setAcceptingSchema] = useState(null)

  const loadData = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !clerkUser) return
    const email = clerkUser.primaryEmailAddress?.emailAddress
    if (!email) return

    setLoading(true)
    setError('')
    try {
      localStorage.setItem('nexus_user_email', email)
      localStorage.setItem('nexus_user_name', clerkUser.fullName || email.split('@')[0])
      localStorage.setItem('nexus_user_avatar', clerkUser.imageUrl || '')

      const [invRes, orgRes] = await Promise.all([
        api.get('/staff?action=my-invites'),
        api.get('/staff?action=available-orgs')
      ])

      // If user is actually an active admin of an org, automatically navigate to console
      if (invRes.admin_organizations?.length > 0) {
        const adminOrg = invRes.admin_organizations[0]
        const userData = {
          id: 1,
          username: `${adminOrg.slug}_admin`,
          full_name: clerkUser.fullName || 'Cafe Admin',
          email: email,
          avatar_url: clerkUser.imageUrl || '',
          role: 'admin',
          org_slug: adminOrg.slug,
          org_name: adminOrg.name
        }
        login(userData)
        navigate('/')
        return
      }

      // Check if user is already an active staff member of an org
      const activeStaff = invRes.staff_invites?.find(s => s.membership_status === 'active')
      if (activeStaff) {
        const userData = {
          id: activeStaff.invite_id || 1,
          username: `${activeStaff.tenant_slug || 'org'}_operator`,
          full_name: clerkUser.fullName || activeStaff.staff_name || 'Counter Operator',
          email: email,
          avatar_url: clerkUser.imageUrl || '',
          role: 'operator',
          org_slug: activeStaff.tenant_slug,
          org_name: activeStaff.tenant_name
        }
        login(userData)
        navigate('/')
        return
      }

      setInvites((invRes.staff_invites || []).filter(i => i.membership_status === 'invited'))
      setAvailableOrgs(orgRes.organizations || [])
      setMyRequests(orgRes.my_requests || [])
    } catch (e) {
      setError(e.message || 'Failed to check invitations')
    } finally {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, clerkUser, login, navigate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAcceptInvite = async (schema_name, tenant_name, role = 'operator') => {
    setAcceptingSchema(schema_name)
    setError('')
    try {
      const email = clerkUser?.primaryEmailAddress?.emailAddress
      await api.post('/staff?action=accept-invite', { schema_name })

      const userData = {
        id: 1,
        username: `${schema_name.replace('tenant_', '')}_operator`,
        full_name: clerkUser?.fullName || 'Counter Operator',
        email: email,
        avatar_url: clerkUser?.imageUrl || '',
        role: role === 'admin' ? 'admin' : 'operator'
      }
      toast.success(`Joined ${tenant_name}!`)
      login(userData)
      navigate('/')
    } catch (e) {
      setError(e.message || 'Failed to accept invitation')
    } finally {
      setAcceptingSchema(null)
    }
  }

  const handleRequestJoin = async (schema_name, org_name) => {
    setRequestingSchema(schema_name)
    setError('')
    try {
      await api.post('/staff?action=request-join', { schema_name })
      toast.success(`Join request sent to ${org_name}! Awaiting admin approval.`)
      loadData()
    } catch (e) {
      toast.error(e.message || 'Failed to submit join request')
    } finally {
      setRequestingSchema(null)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch {}
    logout()
    navigate('/login')
  }

  if (loading || !isLoaded) return <PageLoader />

  const email = clerkUser?.primaryEmailAddress?.emailAddress
  const pendingRequestSchemas = new Set(myRequests.filter(r => r.status === 'pending_approval').map(r => r.schema_name))

  const filteredOrgs = availableOrgs.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.slug?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem'
    }}>
      <div style={{
        maxWidth: '620px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem'
      }}>

        {/* Top Header Card */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-text) 100%)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', marginBottom: '1rem'
          }}>
            <Building2 size={28} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.025em' }}>
            Staff Console Access
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Signed in as <strong style={{ color: 'var(--text)' }}>{email}</strong>
          </p>
        </div>

        <ErrorMsg error={error} />

        {/* ─── SECTION 1: DIRECT INVITATIONS ─── */}
        {invites.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Direct Invitations for You
            </p>
            {invites.map(inv => (
              <div key={inv.invite_id} className="card" style={{
                padding: '1.35rem',
                border: '1.5px solid var(--accent-border)',
                background: 'var(--accent-dim)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)'
                    }}>
                      {inv.tenant_name?.[0]?.toUpperCase() || 'C'}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>
                        {inv.tenant_name}
                      </h3>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Invited by <span style={{ color: 'var(--text)', fontWeight: 650 }}>{inv.invited_by || 'Cafe Admin'}</span>
                      </p>
                    </div>
                  </div>

                  <span className="badge badge-accent" style={{ fontSize: '0.675rem', fontWeight: 800 }}>
                    {inv.role === 'admin' ? 'Admin Access' : 'Operator Access'}
                  </span>
                </div>

                <button
                  onClick={() => handleAcceptInvite(inv.schema_name, inv.tenant_name, inv.role)}
                  disabled={acceptingSchema === inv.schema_name}
                  className="btn-primary"
                  style={{
                    padding: '0.75rem 1rem', width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    fontWeight: 800, fontSize: '0.9rem'
                  }}
                >
                  {acceptingSchema === inv.schema_name ? (
                    <><Spinner size="sm" /> Joining {inv.tenant_name}...</>
                  ) : (
                    <>Accept Invitation &amp; Enter Console <ArrowRight size={15} /></>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ─── SECTION 2: MY PENDING REQUESTS ─── */}
        {myRequests.filter(r => r.status === 'pending_approval').length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={13} /> Your Pending Join Requests
            </p>
            {myRequests.filter(r => r.status === 'pending_approval').map(req => (
              <div key={req.id} style={{
                padding: '0.85rem 1.15rem', borderRadius: '10px',
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: 'var(--text)' }}>
                    {req.tenant_name}
                  </p>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Request submitted · Awaiting cafe administrator approval
                  </p>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.68rem', fontWeight: 800 }}>
                  Pending
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ─── SECTION 3: BROWSE & REQUEST TO JOIN ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>
                Request to Join a Gaming Lounge
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Select your gaming cafe below to request operator console authorization.
              </p>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              placeholder="Search gaming cafes by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.4rem', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '340px', overflowY: 'auto' }}>
            {filteredOrgs.map(org => {
              const isPending = pendingRequestSchemas.has(org.schema_name)
              const isRequesting = requestingSchema === org.schema_name

              return (
                <div key={org.id} className="card" style={{
                  padding: '1rem 1.15rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover', border: '1.5px solid var(--border)' }} />
                    ) : (
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '10px',
                        background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 900, color: 'var(--accent-text)'
                      }}>
                        {org.name?.[0]?.toUpperCase() || 'C'}
                      </div>
                    )}
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' }}>
                        {org.name}
                      </h4>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        @{org.slug} {org.phone && <span>· {org.phone}</span>}
                      </p>
                    </div>
                  </div>

                  {isPending ? (
                    <span className="badge badge-warning" style={{ fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={11} /> Request Sent
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRequestJoin(org.schema_name, org.name)}
                      disabled={isRequesting}
                      className="btn-primary"
                      style={{ fontSize: '0.78rem', padding: '0.45rem 0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      {isRequesting ? <><Spinner size="sm" /> Sending...</> : <><Send size={12} /> Request to Join</>}
                    </button>
                  )}
                </div>
              )
            })}

            {filteredOrgs.length === 0 && (
              <p style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active gaming lounges found matching "{search}".
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={loadData}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>

          <button
            onClick={handleSignOut}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--danger)' }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>

      </div>
    </div>
  )
}

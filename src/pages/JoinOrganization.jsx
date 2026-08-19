import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { PageLoader, ErrorMsg, Spinner } from '../components/UI'
import { Shield, Building2, CheckCircle2, ArrowRight, LogOut, RefreshCw, Sparkles, UserCheck } from 'lucide-react'
import { useUser, useClerk } from '@clerk/clerk-react'

export default function JoinOrganization() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const { login, logout } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invites, setInvites] = useState([])
  const [acceptingSchema, setAcceptingSchema] = useState(null)

  const checkInvites = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !clerkUser) return
    const email = clerkUser.primaryEmailAddress?.emailAddress
    if (!email) return

    setLoading(true)
    setError('')
    try {
      localStorage.setItem('nexus_user_email', email)
      const res = await api.get('/staff?action=my-invites')
      
      // If user is actually an active admin of an org, automatically navigate to console
      if (res.admin_organizations?.length > 0) {
        const adminOrg = res.admin_organizations[0]
        const userData = {
          id: 1,
          username: clerkUser.username || email.split('@')[0] || 'admin',
          full_name: clerkUser.fullName || 'Cafe Admin',
          role: 'admin'
        }
        login(userData)
        navigate('/')
        return
      }

      // Check if user is already an active staff member of an org
      const activeStaff = res.staff_invites?.find(s => s.membership_status === 'active')
      if (activeStaff) {
        const userData = {
          id: activeStaff.invite_id || 1,
          username: clerkUser.username || email.split('@')[0] || 'staff',
          full_name: clerkUser.fullName || activeStaff.staff_name || 'Counter Staff',
          role: 'staff'
        }
        login(userData)
        navigate('/')
        return
      }

      setInvites(res.staff_invites || [])
    } catch (e) {
      setError(e.message || 'Failed to check invitations')
    } finally {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, clerkUser, login, navigate])

  useEffect(() => {
    checkInvites()
  }, [checkInvites])

  const handleAcceptInvite = async (schema_name, tenant_name) => {
    setAcceptingSchema(schema_name)
    setError('')
    try {
      const email = clerkUser?.primaryEmailAddress?.emailAddress
      await api.post('/staff?action=accept-invite', { schema_name })
      
      const userData = {
        id: 1,
        username: clerkUser?.username || email?.split('@')[0] || 'staff',
        full_name: clerkUser?.fullName || 'Counter Staff',
        role: 'staff'
      }
      login(userData)
      navigate('/')
    } catch (e) {
      setError(e.message || 'Failed to accept invitation')
    } finally {
      setAcceptingSchema(null)
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div style={{
        maxWidth: '540px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>

        {/* Top Header Card */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-text) 100%)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', marginBottom: '1rem'
          }}>
            <Building2 size={26} />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.025em' }}>
            Organization Invitations
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Signed in as <strong style={{ color: 'var(--text)' }}>{email}</strong>
          </p>
        </div>

        <ErrorMsg error={error} />

        {/* Invites List */}
        {invites.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {invites.map(inv => (
              <div key={inv.invite_id} className="card" style={{
                padding: '1.35rem',
                border: '1.5px solid var(--accent-border)',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '10px',
                      background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-text)'
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
                    Staff Invitation
                  </span>
                </div>

                <div style={{
                  padding: '0.75rem 0.95rem', borderRadius: '8px',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Assigned Role:</span>
                  <strong style={{ color: 'var(--text)' }}>Counter Staff</strong>
                </div>

                <button
                  onClick={() => handleAcceptInvite(inv.schema_name, inv.tenant_name)}
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
        ) : (
          <div className="card" style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            border: '1.5px dashed var(--border)'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)'
            }}>
              <Shield size={24} />
            </div>

            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
                No Active Invitation Found
              </p>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '360px' }}>
                Your Google email <strong style={{ color: 'var(--text)' }}>({email})</strong> has not been invited by any Cafe Admin yet.
              </p>
            </div>

            <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-faint)' }}>
              Ask your cafe administrator to add your email in their <strong>Admin Hub &rarr; Staff Authorizations</strong>.
            </p>

            <button
              onClick={checkInvites}
              className="btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}
            >
              <RefreshCw size={13} /> Check Again
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleSignOut}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)' }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>

      </div>
    </div>
  )
}

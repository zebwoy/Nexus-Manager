import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { api } from '../lib/api'
import { Sun, Moon, Keyboard, Eye, EyeOff, Shield } from 'lucide-react'
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const hiddenInputRef = useRef(null)
  const { login } = useAuth()
  const { isDark, toggleDark, accentId, setAccentId } = useTheme()
  const { user: clerkUser, isSignedIn } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (isSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress
      if (email) localStorage.setItem('nexus_user_email', email)
    }
  }, [isSignedIn, clerkUser])

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      const next = pin + String(num)
      setPin(next)
      hiddenInputRef.current?.focus()
      if (next.length === 4) {
        handleSubmit(next)
      }
    }
  }

  const handleClear = () => {
    setPin('')
    hiddenInputRef.current?.focus()
  }

  const handleSubmit = async (overridePin) => {
    const pinStr = typeof overridePin === 'string' ? overridePin : pin
    if (!username.trim() || pinStr.length < 4) {
      setError('Enter your username and 4-digit PIN')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await api.post('/auth-login', { username: username.trim(), pin: pinStr })
      login(data.user)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid username or PIN')
    } finally {
      setLoading(false)
    }
  }

  const handleClerkLaunch = () => {
    if (!clerkUser) return
    const isSA = clerkUser.publicMetadata?.role === 'super_admin' || clerkUser.primaryEmailAddress?.emailAddress === 'imanriyaj@gmail.com'
    const userData = {
      id: 1,
      username: clerkUser.username || clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'owner',
      full_name: clerkUser.fullName || 'Cloud Owner',
      role: isSA ? 'super_admin' : 'admin'
    }
    login(userData)
    navigate(isSA ? '/super-admin' : '/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>

      {/* Blinking cursor and key pop animations */}
      <style>{`
        .cursor-blink {
          animation: cursor-blink-ani 1.2s step-end infinite;
        }
        @keyframes cursor-blink-ani {
          from, to { background-color: transparent }
          50% { background-color: var(--accent) }
        }
        .digit-entered {
          display: inline-block;
          animation: digit-pop 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes digit-pop {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Dark mode toggle top-right */}
      <div style={{ position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 10 }}>
        <button onClick={toggleDark} className="btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* System branding */}
        <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
          <p style={{
            fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)',
            letterSpacing: '-0.03em', textShadow: '1px 1px 0 var(--bevel-top)', margin: 0
          }}>
            Nexus Manager
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Gaming Cafe Console
          </p>
        </div>

        {/* Clerk Signed In Quick Launch Card */}
        <SignedIn>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', border: '1.5px solid var(--accent-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                <UserButton afterSignOutUrl="/" />
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ margin: 0, fontWeight: 750, fontSize: '0.85rem', color: 'var(--text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-text)', fontWeight: 600 }}>
                    Connected via Clerk Cloud
                  </span>
                </div>
              </div>
              <button onClick={handleClerkLaunch} className="btn-primary btn-sm" style={{ flexShrink: 0, padding: '0.45rem 0.85rem' }}>
                Launch Console →
              </button>
            </div>
          </div>
        </SignedIn>

        {/* Login terminal card */}
        <div className="card" style={{ padding: '2rem', position: 'relative' }}>
          {/* Clerk Cloud Sign-In Header for Signed-Out Visitors */}
          <SignedOut>
            <div style={{ marginBottom: '1.25rem', borderBottom: '1.5px solid var(--border)', paddingBottom: '1rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem' }}>
                🌐 Cloud Owner &amp; Organization Login
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <SignInButton mode="modal">
                  <button type="button" className="btn-primary btn-sm" style={{ padding: '0.45rem', fontSize: '0.75rem', fontWeight: 700 }}>
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button type="button" className="btn-secondary btn-sm" style={{ padding: '0.45rem', fontSize: '0.75rem', fontWeight: 700 }}>
                    Create Account
                  </button>
                </SignUpButton>
              </div>
            </div>
          </SignedOut>

          {/* Operator PIN Pad Header */}
          <p style={{
            fontSize: '0.85rem', fontWeight: 750, color: 'var(--text-muted)',
            marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '1px dashed var(--border)', paddingBottom: '0.4rem'
          }}>
            🔐 Fast Desk Operator PIN Pad
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div>
              <label className="label">Operator Username</label>
              <input className="input" placeholder="e.g. admin or trial"
                value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && hiddenInputRef.current?.focus()}
                autoFocus />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="label" style={{ marginBottom: 0 }}>Access PIN</label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  onMouseDown={e => e.preventDefault()}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: '0.75rem', fontWeight: 650, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.25rem 0.5rem', borderRadius: '6px',
                    outline: 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showPin ? 'Hide' : 'Show'}
                </button>
              </div>

              {/* Hidden text input capturing real keyboard typing */}
              <input
                ref={hiddenInputRef}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setPin(cleaned)
                  if (cleaned.length === 4) handleSubmit(cleaned)
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }}
                aria-label="4-digit access PIN"
              />

              {/* Tactile 4-Digit Display Screen */}
              <div
                onClick={() => hiddenInputRef.current?.focus()}
                className="input-focus-glow"
                style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem',
                  padding: '0.75rem', borderRadius: '12px',
                  background: 'var(--bg-input)',
                  border: isFocused ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'text', transition: 'all 0.15s ease',
                  boxShadow: 'var(--shadow-inset)'
                }}>
                {[0, 1, 2, 3].map(index => {
                  const isFilled = index < pin.length
                  const isCurrent = index === pin.length && isFocused
                  return (
                    <div key={index} style={{
                      height: '2.75rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '8px',
                      background: isFilled ? 'var(--accent-dim)' : 'transparent',
                      border: isCurrent ? '1.5px solid var(--accent)' : '1px solid var(--bevel-bottom)',
                      boxShadow: isFilled ? 'inset 0 1px 2px rgba(0,0,0,0.2)' : 'none',
                      position: 'relative', transition: 'all 0.15s ease'
                    }}>
                      {isFilled ? (
                        showPin ? (
                          <span className="digit-entered" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-text)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {pin[index]}
                          </span>
                        ) : (
                          <span className="digit-entered" style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-text)' }} />
                        )
                      ) : isCurrent ? (
                        <div className="cursor-blink" style={{ width: '2px', height: '1.25rem' }} />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            {error && (
              <p style={{
                color: 'var(--danger)', fontSize: '0.8125rem', margin: 0,
                padding: '0.625rem 0.875rem', borderRadius: '8px',
                background: 'var(--danger-dim)', border: '1px solid var(--danger-border)',
                fontWeight: 600, animation: 'shake 0.3s ease-in-out'
              }}>
                {error}
              </p>
            )}

            {/* Virtual PIN Pad (0-9) */}
            <div style={{
              background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '14px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-inset)'
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem'
              }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button key={num} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleKeyPress(num)}
                    className="btn-secondary" style={{ padding: '0.6rem', fontSize: '1rem', borderRadius: '8px', fontWeight: 700 }}>
                    {num}
                  </button>
                ))}
                <button type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={handleClear}
                  className="btn-secondary" style={{ padding: '0.6rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700, color: 'var(--danger)' }}>
                  Clear
                </button>
                <button type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleKeyPress(0)}
                  className="btn-secondary" style={{ padding: '0.6rem', fontSize: '1rem', borderRadius: '8px', fontWeight: 700 }}>
                  0
                </button>
                <button type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSubmit()} disabled={loading}
                  className="btn-primary" style={{ padding: '0.6rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700 }}>
                  Enter
                </button>
              </div>
            </div>

            <button onClick={() => handleSubmit()} disabled={loading} className="btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.25rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              {loading ? 'Initializing Operator…' : 'Authenticate Operator'}
            </button>

            {/* Quick-Fill Role Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setUsername('superadmin')
                  setPin('9999')
                }}
                className="btn-secondary btn-sm"
                style={{ fontSize: '0.725rem', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#f59e0b' }}
              >
                👑 Super Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('admin')
                  setPin('1234')
                }}
                className="btn-secondary btn-sm"
                style={{ fontSize: '0.725rem', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                🏢 Store Admin
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setUsername('trial')
                setPin('0000')
                handleSubmit('0000')
              }}
              disabled={loading}
              className="btn-secondary"
              style={{ width: '100%', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.775rem', padding: '0.45rem' }}
            >
              🎮 Try Live Demo (Sandbox)
            </button>
          </div>
        </div>

        {/* Accent switcher box (Light mode only) */}
        {!isDark && (
          <div className="card" style={{ padding: '1rem 1.25rem', marginTop: '1rem' }}>
            <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Console Color</p>
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              {Object.entries(ACCENTS).map(([id, a]) => (
                <button key={id} onClick={() => setAccentId(id)} title={a.label}
                  className={`accent-swatch ${accentId === id ? 'selected' : ''}`}
                  style={{ background: a.value }} />
              ))}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 600, marginLeft: '0.25rem' }}>
                {ACCENTS[accentId]?.label}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

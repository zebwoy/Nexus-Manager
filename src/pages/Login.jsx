import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { api } from '../lib/api'
import {
  Sun, Moon, Eye, EyeOff, Shield, Zap,
  Monitor, Gamepad2, Sparkles, ArrowRight, Lock, CheckCircle2,
  FileText, Coffee, Laptop
} from 'lucide-react'
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react'

export default function Login() {
  const [activeTab, setActiveTab] = useState('pin') // 'pin' | 'cloud'
  const [showTintPopover, setShowTintPopover] = useState(false)
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

  const handleSubmit = async (overridePin, overrideUser) => {
    const targetUser = (typeof overrideUser === 'string' ? overrideUser : username).trim()
    const pinStr = typeof overridePin === 'string' ? overridePin : pin
    if (!targetUser || pinStr.length < 4) {
      setError('Enter your operator username and 4-digit PIN')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await api.post('/auth-login', { username: targetUser, pin: pinStr })
      login(data.user)
      if (data.user?.role === 'super_admin') {
        navigate('/super-admin')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'Invalid username or PIN')
    } finally {
      setLoading(false)
    }
  }

  const handleSandboxLaunch = () => {
    setUsername('trial')
    setPin('0000')
    handleSubmit('0000', 'trial')
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
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>

      {/* Ambient background glow effects */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)',
        opacity: 0.6, pointerEvents: 'none', filter: 'blur(60px)', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-5%', width: '600px', height: '600px',
        background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)',
        opacity: 0.5, pointerEvents: 'none', filter: 'blur(70px)', zIndex: 0
      }} />

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
        .auth-tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.65rem 1rem;
          font-size: 0.825rem;
          font-weight: 700;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .auth-tab-btn.active {
          background: var(--bg-card);
          color: var(--text);
          box-shadow: var(--shadow);
        }
        .auth-tab-btn.inactive {
          background: transparent;
          color: var(--text-muted);
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Top right theme actions with vertical color popover on hover */}
      <div
        onMouseEnter={() => setShowTintPopover(true)}
        onMouseLeave={() => setShowTintPopover(false)}
        style={{
          position: 'fixed',
          top: '1.25rem',
          right: '1.5rem',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.45rem'
        }}
      >
        <button
          onClick={toggleDark}
          className="btn-secondary btn-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            backdropFilter: 'blur(10px)',
            boxShadow: 'var(--shadow)',
            padding: '0.45rem 0.75rem',
            borderRadius: '10px'
          }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          {isDark ? 'Light' : 'Dark'}
        </button>

        {/* Minimalist vertical popover (color swatches only, no text) */}
        {!isDark && showTintPopover && (
          <div
            style={{
              background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '0.45rem 0.35rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: 'var(--shadow-md)',
              backdropFilter: 'blur(12px)',
              animation: 'fadeInDown 0.15s ease-out forwards'
            }}
          >
            {Object.entries(ACCENTS).map(([id, a]) => (
              <button
                key={id}
                onClick={() => setAccentId(id)}
                title={a.label}
                className={`accent-swatch ${accentId === id ? 'selected' : ''}`}
                style={{
                  background: a.value,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: accentId === id ? '2px solid var(--text)' : '1px solid rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  transform: accentId === id ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Split Grid Showcase Container */}
      <div style={{
        width: '100%',
        maxWidth: '1040px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '2rem',
        alignItems: 'center',
        zIndex: 10
      }}>

        {/* ─── LEFT PANEL: Hero & Gaming Platform Experience ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
          
          {/* Logo & Brand Header */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.85rem', borderRadius: '100px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', marginBottom: '1rem' }}>
              <span className="led-indicator led-green" style={{ width: '7px', height: '7px' }} />
              <span style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Next-Gen Cafe OS v2.0
              </span>
            </div>

            <h1 style={{
              fontSize: '2.5rem', fontWeight: 900, color: 'var(--text)',
              letterSpacing: '-0.035em', lineHeight: 1.15, textShadow: '1px 1px 0 var(--bevel-top)'
            }}>
              Nexus Manager
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.65rem', lineHeight: 1.55, maxWidth: '440px' }}>
              Tactical station management, live telemetry, isolated multi-tenancy, and seamless point-of-sale for modern gaming lounges.
            </p>
          </div>

          {/* Interactive Station Floor Mini-Teaser Card */}
          <div className="card" style={{ padding: '1.25rem', border: '1.5px solid var(--border)', background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-elevated) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ⚡ Live Station Telemetry
              </span>
              <span className="badge badge-accent" style={{ fontSize: '0.65rem', fontWeight: 800 }}>
                Real-Time
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {/* Station 1 */}
              <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Laptop size={16} style={{ color: 'var(--accent)' }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '0.825rem', fontWeight: 750, color: 'var(--text)' }}>PC Station #03</p>
                    <p style={{ margin: 0, fontSize: '0.675rem', color: 'var(--text-muted)' }}>RTX 4090 • Valorant</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--success)', fontFamily: "'JetBrains Mono', monospace" }}>01:14:20</span>
                  <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-faint)' }}>Prorated</p>
                </div>
              </div>

              {/* Station 2 */}
              <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Gamepad2 size={16} style={{ color: '#f59e0b' }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '0.825rem', fontWeight: 750, color: 'var(--text)' }}>PS5 Lounge #01</p>
                    <p style={{ margin: 0, fontSize: '0.675rem', color: 'var(--text-muted)' }}>FIFA 24 • 2 Controllers</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--success)', fontFamily: "'JetBrains Mono', monospace" }}>00:42:15</span>
                  <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-faint)' }}>Active</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Feature Pillars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Schema Data Isolation</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>WhatsApp Receipts</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Prorated End Early</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>EOD Cash Reconciliation</span>
            </div>
          </div>

          {/* Sandbox Direct Button CTA */}
          <div style={{
            padding: '1rem 1.25rem', borderRadius: '14px',
            background: 'var(--accent-dim)', border: '1.5px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: 'var(--text)' }}>
                🎮 Instant Demo Sandbox
              </p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                Test all POS, sessions &amp; inventory safely in isolated schema.
              </p>
            </div>
            <button
              onClick={handleSandboxLaunch}
              disabled={loading}
              className="btn-secondary btn-sm"
              style={{
                flexShrink: 0, padding: '0.55rem 0.95rem',
                fontSize: '0.775rem', fontWeight: 750,
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              Launch Demo <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Authentication Terminal Card ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="card" style={{ padding: '2rem', boxShadow: 'var(--shadow-md)', border: '1.5px solid var(--border)' }}>
            
            {/* Tab Navigation Switcher */}
            <div style={{
              display: 'flex', padding: '0.3rem', background: 'var(--bg-input)',
              borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border)'
            }}>
              <button
                type="button"
                onClick={() => setActiveTab('pin')}
                className={`auth-tab-btn ${activeTab === 'pin' ? 'active' : 'inactive'}`}
              >
                <Lock size={14} /> Desk Operator PIN
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cloud')}
                className={`auth-tab-btn ${activeTab === 'cloud' ? 'active' : 'inactive'}`}
              >
                <Sparkles size={14} /> Cloud Owner
              </button>
            </div>

            {/* TAB 1: DESK OPERATOR PIN PAD */}
            {activeTab === 'pin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                
                <div>
                  <label className="label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Operator Account
                  </label>
                  <input
                    className="input"
                    placeholder="Enter operator username (e.g. admin)"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && hiddenInputRef.current?.focus()}
                    autoFocus
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <label className="label" style={{ marginBottom: 0, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Security PIN
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      onMouseDown={e => e.preventDefault()}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        fontSize: '0.75rem', fontWeight: 650, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.2rem 0.4rem', borderRadius: '6px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                      {showPin ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {/* Hidden keyboard input */}
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

                  {/* 4-Digit Screen Display */}
                  <div
                    onClick={() => hiddenInputRef.current?.focus()}
                    className="input-focus-glow"
                    style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem',
                      padding: '0.65rem', borderRadius: '12px',
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
                          height: '2.65rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '8px',
                          background: isFilled ? 'var(--accent-dim)' : 'transparent',
                          border: isCurrent ? '1.5px solid var(--accent)' : '1px solid var(--bevel-bottom)',
                          boxShadow: isFilled ? 'inset 0 1px 2px rgba(0,0,0,0.2)' : 'none',
                          position: 'relative', transition: 'all 0.15s ease'
                        }}>
                          {isFilled ? (
                            showPin ? (
                              <span className="digit-entered" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-text)', fontFamily: "'JetBrains Mono', monospace" }}>
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

                {/* Tactile 3x4 Keypad */}
                <div style={{
                  background: 'var(--bg-input)', padding: '0.65rem', borderRadius: '12px',
                  border: '1px solid var(--border)', boxShadow: 'var(--shadow-inset)'
                }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem'
                  }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button key={num} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleKeyPress(num)}
                        className="btn-secondary" style={{ padding: '0.55rem', fontSize: '1rem', borderRadius: '8px', fontWeight: 700 }}>
                        {num}
                      </button>
                    ))}
                    <button type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleClear}
                      className="btn-secondary" style={{ padding: '0.55rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700, color: 'var(--danger)' }}>
                      Clear
                    </button>
                    <button type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleKeyPress(0)}
                      className="btn-secondary" style={{ padding: '0.55rem', fontSize: '1rem', borderRadius: '8px', fontWeight: 700 }}>
                      0
                    </button>
                    <button type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSubmit()} disabled={loading}
                      className="btn-primary" style={{ padding: '0.55rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700 }}>
                      Enter
                    </button>
                  </div>
                </div>

                <button onClick={() => handleSubmit()} disabled={loading} className="btn-primary btn-lg"
                  style={{ width: '100%', marginTop: '0.15rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', fontWeight: 750 }}>
                  {loading ? 'Authenticating…' : 'Authenticate Operator'}
                </button>

                <p style={{ textAlign: 'center', fontSize: '0.725rem', color: 'var(--text-faint)', margin: 0 }}>
                  For cafe shift staff &amp; administrators on desk terminal
                </p>
              </div>
            )}

            {/* TAB 2: CLOUD OWNER (CLERK) */}
            {activeTab === 'cloud' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                <SignedIn>
                  <div style={{
                    background: 'var(--bg-input)', border: '1.5px solid var(--accent-border)',
                    borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <UserButton afterSignOutUrl="/" />
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress}
                        </p>
                        <span style={{ fontSize: '0.725rem', color: 'var(--accent-text)', fontWeight: 650 }}>
                          ✓ Authenticated via Clerk Cloud
                        </span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '0.85rem' }}>
                        You are logged in with your Cloud Account. Click below to enter your workspace console.
                      </p>
                      <button
                        onClick={handleClerkLaunch}
                        className="btn-primary"
                        style={{ width: '100%', padding: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 750 }}
                      >
                        Launch Console Workspace <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </SignedIn>

                <SignedOut>
                  <div style={{ textAlign: 'center', padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '12px',
                      background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)'
                    }}>
                      <Shield size={24} />
                    </div>

                    <div>
                      <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                        Cloud Organization Access
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '0.35rem', maxWidth: '300px' }}>
                        Sign in with your Google or Email account to manage multi-tenant schemas, billing, and fleet telemetry.
                      </p>
                    </div>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <SignInButton mode="modal">
                        <button type="button" className="btn-primary" style={{ width: '100%', padding: '0.65rem', fontWeight: 750 }}>
                          Sign In with Clerk
                        </button>
                      </SignInButton>
                      <SignUpButton mode="modal">
                        <button type="button" className="btn-secondary" style={{ width: '100%', padding: '0.65rem', fontWeight: 650 }}>
                          Register New Organization
                        </button>
                      </SignUpButton>
                    </div>
                  </div>
                </SignedOut>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}

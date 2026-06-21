import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { api } from '../lib/api'
import { Sun, Moon, Keyboard, Eye, EyeOff } from 'lucide-react'

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
  const navigate = useNavigate()

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

      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* System branding */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <p style={{
            fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)',
            letterSpacing: '-0.03em', textShadow: '1px 1px 0 var(--bevel-top)'
          }}>
            Nexus Manager
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Gaming Cafe Console
          </p>
        </div>

        {/* Login terminal card */}
        <div className="card" style={{ padding: '2rem', position: 'relative' }}>
          {/* Engraved Header */}
          <p style={{
            fontSize: '0.9rem', fontWeight: 750, color: 'var(--text-muted)',
            marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '1.5px solid var(--border)', paddingBottom: '0.5rem'
          }}>
            🔐 Secure Operator Login
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label className="label">Operator Username</label>
              <input className="input" placeholder="e.g. trial"
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

              {/* Real hidden numeric input */}
              <input
                ref={hiddenInputRef}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                value={pin}
                onChange={e => {
                  const val = e.target.value
                  if (!/^\d*$/.test(val)) return
                  if (val.length <= 4) {
                    setPin(val)
                    if (val.length === 4) {
                      handleSubmit(val)
                    }
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '1px',
                  height: '1px',
                  zIndex: -1,
                  overflow: 'hidden',
                  border: 0,
                  padding: 0,
                  margin: 0,
                  fontSize: '16px'
                }}
              />

              {/* Styled Interactive Pin Boxes */}
              <div
                onClick={() => hiddenInputRef.current?.focus()}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  position: 'relative',
                  cursor: 'text'
                }}>
                {[0, 1, 2, 3].map(i => {
                  const digit = pin[i] || ''
                  const isActiveBox = pin.length === i || (pin.length === 4 && i === 3)
                  const displayChar = digit ? (showPin ? digit : '•') : ''

                  return (
                    <div
                      key={i}
                      style={{
                        width: '3.5rem',
                        height: '3.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.75rem',
                        fontWeight: 800,
                        background: 'var(--bg-input)',
                        border: isActiveBox && isFocused
                          ? '2px solid var(--accent)'
                          : '1.5px solid var(--border)',
                        borderRadius: '12px',
                        color: 'var(--text)',
                        boxShadow: isActiveBox && isFocused
                          ? 'var(--shadow-inset), 0 0 0 3px var(--accent-dim)'
                          : 'var(--shadow-inset)',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        boxSizing: 'border-box'
                      }}>
                      {displayChar && (
                        <span className="digit-entered">
                          {displayChar}
                        </span>
                      )}

                      {/* Blinking hardware cursor */}
                      {isActiveBox && isFocused && !digit && (
                        <div className="cursor-blink" style={{
                          width: '2px',
                          height: '1.25rem',
                          background: 'var(--accent)'
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {error && (
              <div style={{
                fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 650,
                background: 'var(--danger-dim)', border: '1px solid var(--danger-border)',
                borderRadius: '8px', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem'
              }}>
                <span className="led-indicator led-red" style={{ width: '6px', height: '6px' }} />
                {error}
              </div>
            )}

            {/* Clicky Hardware PIN Pad */}
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

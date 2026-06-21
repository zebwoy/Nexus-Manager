import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { api } from '../lib/api'
import { Sun, Moon, Keyboard } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pinRefs = [useRef(), useRef(), useRef(), useRef()]
  const { login } = useAuth()
  const { isDark, toggleDark, accentId, setAccentId } = useTheme()
  const navigate = useNavigate()

  const handlePinChange = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...pin]; next[i] = val; setPin(next)
    if (val && i < 3) pinRefs[i + 1].current?.focus()
  }

  const handlePinKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) pinRefs[i - 1].current?.focus()
    if (e.key === 'Enter' && i === 3) handleSubmit()
  }

  const handleKeyPress = (num) => {
    const emptyIndex = pin.findIndex(val => val === '')
    if (emptyIndex !== -1) {
      const next = [...pin]
      next[emptyIndex] = String(num)
      setPin(next)
      if (emptyIndex < 3) {
        pinRefs[emptyIndex + 1].current?.focus()
      }
    }
  }

  const handleClear = () => {
    setPin(['', '', '', ''])
    pinRefs[0].current?.focus()
  }

  const handleSubmit = async () => {
    const pinStr = pin.join('')
    if (!username.trim() || pinStr.length < 4) { setError('Enter your username and 4-digit PIN'); return }
    setLoading(true); setError('')
    try {
      const data = await api.post('/auth-login', { username: username.trim(), pin: pinStr })
      login(data.user); navigate('/')
    } catch (err) { setError(err.message || 'Invalid username or PIN') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>

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
                onKeyDown={e => e.key === 'Enter' && pinRefs[0].current?.focus()}
                autoFocus />
            </div>

            <div>
              <label className="label">Access PIN</label>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    placeholder="•"
                    className="pin-digit"
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(i, e)}
                  />
                ))}
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
                  <button key={num} type="button" onClick={() => handleKeyPress(num)}
                    className="btn-secondary" style={{ padding: '0.6rem', fontSize: '1rem', borderRadius: '8px', fontWeight: 700 }}>
                    {num}
                  </button>
                ))}
                <button type="button" onClick={handleClear}
                  className="btn-secondary" style={{ padding: '0.6rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700, color: 'var(--danger)' }}>
                  Clear
                </button>
                <button type="button" onClick={() => handleKeyPress(0)}
                  className="btn-secondary" style={{ padding: '0.6rem', fontSize: '1rem', borderRadius: '8px', fontWeight: 700 }}>
                  0
                </button>
                <button type="button" onClick={handleSubmit} disabled={loading}
                  className="btn-primary" style={{ padding: '0.6rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700 }}>
                  Enter
                </button>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading} className="btn-primary btn-lg"
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

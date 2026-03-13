import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { api } from '../lib/api'
import { Sun, Moon } from 'lucide-react'

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
      <div style={{ position: 'fixed', top: '1.25rem', right: '1.25rem' }}>
        <button onClick={toggleDark} className="btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          {isDark ? 'Light' : 'Dark'}
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Logo */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Nexus Manager
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Gaming Cafe Management System
          </p>
        </div>

        {/* Login card */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.5rem' }}>Sign in</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            <div>
              <label className="label">Username</label>
              <input className="input" placeholder="Enter username"
                value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && pinRefs[0].current?.focus()}
                autoFocus />
            </div>

            <div>
              <label className="label">PIN</label>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                {pin.map((digit, i) => (
                  <input key={i} ref={pinRefs[i]} type="password" inputMode="numeric"
                    maxLength={1} value={digit} className="pin-digit"
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(i, e)} />
                ))}
              </div>
            </div>

            {error && <p style={{ fontSize: '0.8125rem', color: 'var(--danger)' }}>{error}</p>}

            <button onClick={handleSubmit} disabled={loading} className="btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.25rem' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </div>

        {/* Accent picker — light only */}
        {!isDark && (
          <div className="card" style={{ padding: '1rem 1.25rem', marginTop: '0.875rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.625rem' }}>Accent colour</p>
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              {Object.entries(ACCENTS).map(([id, a]) => (
                <button key={id} onClick={() => setAccentId(id)} title={a.label}
                  className={`accent-swatch ${accentId === id ? 'selected' : ''}`}
                  style={{ background: a.value }} />
              ))}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginLeft: '0.25rem' }}>
                {ACCENTS[accentId]?.label}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

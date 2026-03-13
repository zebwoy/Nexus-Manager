import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pinRefs = [useRef(), useRef(), useRef(), useRef()]
  const { login } = useAuth()
  const navigate = useNavigate()

  const handlePinChange = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...pin]
    next[i] = val
    setPin(next)
    if (val && i < 3) pinRefs[i + 1].current?.focus()
  }

  const handlePinKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      pinRefs[i - 1].current?.focus()
    }
  }

  const handleSubmit = async () => {
    const pinStr = pin.join('')
    if (!username.trim() || pinStr.length < 4) {
      setError('Please enter your username and 4-digit PIN')
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
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-800/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600/20 border border-brand-600/30 rounded-2xl mb-4">
            <span className="text-3xl">🎮</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-white tracking-widest uppercase">
            <span className="text-brand-400">Nexus</span> Manager
          </h1>
          <p className="text-slate-500 text-sm font-body mt-1">Gaming Cafe Management System</p>
        </div>

        {/* Card */}
        <div className="card">
          <h2 className="font-display font-semibold text-lg text-white mb-5 tracking-wide">Sign In</h2>

          <div className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && pinRefs[0].current?.focus()}
                autoFocus
              />
            </div>

            <div>
              <label className="label">PIN</label>
              <div className="flex gap-3 justify-start">
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => {
                      handlePinKeyDown(i, e)
                      if (e.key === 'Enter' && i === 3) handleSubmit()
                    }}
                    className="pin-input"
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

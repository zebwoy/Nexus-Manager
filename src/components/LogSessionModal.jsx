import { useNavigate } from 'react-router-dom'
import { Monitor, Coffee, X } from 'lucide-react'

export default function LogSessionModal({ open, onClose }) {
  const navigate = useNavigate()

  if (!open) return null

  const handleSelect = (path) => {
    onClose()
    navigate(path)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease'
    }} onClick={onClose}>
      <div className="card" style={{
        maxWidth: '480px', width: '100%', padding: '1.75rem',
        background: 'var(--bg-elevated)',
        border: '1.5px solid var(--border)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        borderRadius: '20px',
        position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Close Button */}
        <button onClick={onClose} className="btn-secondary btn-icon" style={{
          position: 'absolute', top: '1.25rem', right: '1.25rem',
          borderRadius: '50%', width: '2rem', height: '2rem'
        }}>
          <X size={16} />
        </button>

        {/* Title */}
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.35rem' }}>
          Select Session Type
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Choose how you wish to log this gaming session for the customer.
        </p>

        {/* Options Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Option A: Regular Gaming Session */}
          <button onClick={() => handleSelect('/sessions/new')} className="card" style={{
            display: 'flex', alignItems: 'center', gap: '1.25rem',
            padding: '1.15rem 1.25rem', textAlign: 'left', cursor: 'pointer',
            border: '1.5px solid var(--accent-border)', background: 'var(--accent-dim)',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}>
            <div style={{
              width: '3rem', height: '3rem', borderRadius: '14px', flexShrink: 0,
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px var(--accent-dim)'
            }}>
              <Monitor size={22} strokeWidth={2.2} />
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                Regular Session
              </p>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                Standard hourly tariff for PC, PlayStation, or Xbox console walk-ins.
              </p>
            </div>
          </button>

          {/* Option B: PanCafe Member Session */}
          <button onClick={() => handleSelect('/pancafe/new')} className="card" style={{
            display: 'flex', alignItems: 'center', gap: '1.25rem',
            padding: '1.15rem 1.25rem', textAlign: 'left', cursor: 'pointer',
            border: '1.5px solid var(--border)', background: 'var(--bg-card)',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}>
            <div style={{
              width: '3rem', height: '3rem', borderRadius: '14px', flexShrink: 0,
              background: 'var(--bg-input)', color: 'var(--accent-text)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Coffee size={22} strokeWidth={2.2} />
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                PanCafe Member Session
              </p>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                Discounted membership package log for registered PanCafe PC members.
              </p>
            </div>
          </button>

        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

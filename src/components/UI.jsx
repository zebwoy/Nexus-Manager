import { AlertCircle, CheckCircle, Loader2, Inbox, X } from 'lucide-react'

export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 14 : size === 'lg' ? 28 : 20
  return <Loader2 size={s} className="spinner" style={{ color: 'var(--text-muted)' }} />
}

export function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '16rem' }}>
      <Spinner size="lg" />
    </div>
  )
}

export function EmptyState({ icon: IconComponent, title, description, action }) {
  return (
    <div className="card" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '4rem 1.5rem', textAlign: 'center', width: '100%'
    }}>
      <div style={{
        width: '4rem', height: '4rem', borderRadius: '50%',
        background: 'var(--bg-input)', border: '1.5px solid var(--border)',
        boxShadow: 'var(--shadow-inset)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '1.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem'
      }}>
        {IconComponent ? (typeof IconComponent === 'function' || typeof IconComponent === 'object' ? <IconComponent size={28} /> : IconComponent) : <Inbox size={28} />}
      </div>

      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.375rem' }}>{title}</p>
      {description && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '320px' }}>{description}</p>}
      {action}
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = '480px' }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      {/* Dimmed backdrop overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      
      {/* Modal chassis */}
      <div className="card" style={{
        position: 'relative', width: '100%', maxWidth: width, padding: 0,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4), var(--shadow-outset)',
        animation: 'modalOpen 0.2s cubic-bezier(0.16, 1, 0.3, 1)', zIndex: 10
      }}>
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.15rem 1.5rem',
          borderBottom: '1.5px solid var(--bevel-bottom)',
          background: 'rgba(0,0,0,0.05)',
          borderTopLeftRadius: '15px', borderTopRightRadius: '15px',
          boxShadow: 'inset 0 -1px 0 var(--bevel-top)'
        }}>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</p>
          <button onClick={onClose} className="btn-secondary btn-icon" style={{ borderRadius: '50%', width: '1.85rem', height: '1.85rem' }} aria-label="Close modal">
            <X size={14} />
          </button>
        </div>
        
        {/* Body content */}
        <div style={{ padding: '1.5rem' }}>{children}</div>
      </div>

      <style>{`
        @keyframes modalOpen {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

export function Field({ label, error, children, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
      {label && (
        <label className="label">
          {label}{required && <span style={{ color: 'var(--danger)', marginLeft: '0.25rem' }}>*</span>}
        </label>
      )}
      {children}
      {error && (
        <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 650 }}>
          <AlertCircle size={13} style={{ fill: 'var(--danger-dim)' }} /> {error}
        </p>
      )}
    </div>
  )
}

export function ErrorMsg({ error }) {
  if (!error) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      background: 'var(--danger-dim)', border: '1px solid var(--danger-border)',
      borderTop: '1.5px solid rgba(255,255,255,0.05)',
      borderRadius: '10px', padding: '0.85rem 1.15rem', color: 'var(--danger)',
      fontSize: '0.875rem', marginBottom: '1.5rem',
      boxShadow: 'var(--shadow-inset)'
    }}>
      <span className="led-indicator led-red spinner" style={{ animationDuration: '1.5s', flexShrink: 0 }} />
      <span style={{ fontWeight: 600 }}>{error}</span>
    </div>
  )
}

export function SuccessMsg({ message }) {
  if (!message) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      background: 'var(--success-dim)', border: '1px solid var(--success-border)',
      borderTop: '1.5px solid rgba(255,255,255,0.05)',
      borderRadius: '10px', padding: '0.85rem 1.15rem', color: 'var(--success)',
      fontSize: '0.875rem', marginBottom: '1.5rem',
      boxShadow: 'var(--shadow-inset)'
    }}>
      <span className="led-indicator led-green" style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 600 }}>{message}</span>
    </div>
  )
}

export function SectionHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem' }}>
      <p style={{ fontSize: '0.975rem', fontWeight: 750, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</p>
      {action}
    </div>
  )
}

export function TrialWarningModal({ open, onClose, actionName }) {
  if (!open) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.25s ease-out',
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1.5px solid var(--border)',
        borderRadius: '16px',
        padding: '2rem',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        textAlign: 'center',
        animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{
          width: '3.5rem', height: '3.5rem', borderRadius: '50%',
          background: 'var(--danger-dim)', border: '1.5px solid var(--danger-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.75rem', color: 'var(--danger)', marginBottom: '1.25rem',
          animation: 'pulseGlow 2s infinite'
        }}>
          💡
        </div>
        <h3 style={{
          fontSize: '1.15rem',
          fontWeight: 800,
          marginBottom: '0.65rem',
          color: 'var(--text)'
        }}>
          Trial Account Demo
        </h3>
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          lineHeight: '1.5',
          marginBottom: '1.5rem'
        }}>
          You clicked <strong>{actionName}</strong>. This is a trial account for demo and simulation purposes. Administrative updates (such as resetting PINs, adding/editing staff, or changing system settings) are simulated in memory and will not be written to the database.
        </p>
        <button 
          onClick={onClose}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.875rem'
          }}
        >
          Acknowledge & Continue
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 15px 5px rgba(239, 68, 68, 0.2); }
        }
      `}</style>
    </div>
  )
}

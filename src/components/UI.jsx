import { AlertCircle, CheckCircle, Loader2, Inbox } from 'lucide-react'

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

export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', textAlign: 'center' }}>
      <Inbox size={40} style={{ color: 'var(--text-faint)', marginBottom: '1rem' }} />
      <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.375rem' }}>{title}</p>
      {description && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{description}</p>}
      {action}
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = '480px' }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: width, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.125rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{title}</p>
          <button onClick={onClose} className="btn-ghost btn-icon" style={{ borderRadius: '6px' }}>✕</button>
        </div>
        <div style={{ padding: '1.5rem' }}>{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, error, children, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {label && (
        <label className="label">
          {label}{required && <span style={{ color: 'var(--danger)', marginLeft: '0.2rem' }}>*</span>}
        </label>
      )}
      {children}
      {error && (
        <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  )
}

export function ErrorMsg({ error }) {
  if (!error) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
      <AlertCircle size={16} style={{ flexShrink: 0 }} />
      {error}
    </div>
  )
}

export function SuccessMsg({ message }) {
  if (!message) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--success-dim)', border: '1px solid var(--success-border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--success)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
      <CheckCircle size={16} style={{ flexShrink: 0 }} />
      {message}
    </div>
  )
}

export function SectionHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
      <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>{title}</p>
      {action}
    </div>
  )
}

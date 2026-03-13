// Spinner
export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return (
    <div className={`${s} border-2 border-surface-700 border-t-brand-500 rounded-full animate-spin`} />
  )
}

// Full page loading
export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )
}

// Empty state
export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-display font-semibold text-lg text-slate-300 mb-1">{title}</h3>
      {description && <p className="text-slate-500 text-sm mb-4">{description}</p>}
      {action}
    </div>
  )
}

// Modal
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ${width} w-full bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
          <h2 className="font-display font-semibold text-lg text-white tracking-wide">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// Confirm dialog
export function ConfirmModal({ open, onClose, onConfirm, title, message, danger = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-slate-400 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>
          Confirm
        </button>
      </div>
    </Modal>
  )
}

// Form field wrapper
export function Field({ label, error, children, required }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

// Error message
export function ErrorMsg({ error }) {
  if (!error) return null
  return (
    <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
      {error}
    </div>
  )
}

// Success message
export function SuccessMsg({ message }) {
  if (!message) return null
  return (
    <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg px-4 py-3 text-emerald-400 text-sm">
      {message}
    </div>
  )
}

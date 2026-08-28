import { useState } from 'react'
import { Bell } from 'lucide-react'

/**
 * NotificationBell — Subtle, complimentary notification header button
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="top-header-btn bell-btn"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={16} strokeWidth={2} />
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div className="trp-popover" style={{ zIndex: 50, width: '280px', right: 0, top: 'calc(100% + 0.5rem)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <p style={{
                fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-faint)', margin: 0
              }}>
                Notifications
              </p>
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.4rem', padding: '1.25rem 0'
            }}>
              <Bell size={22} strokeWidth={1.4} style={{ color: 'var(--text-faint)', opacity: 0.5 }} />
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 600 }}>
                No new notifications
              </p>
              <p style={{ fontSize: '0.675rem', color: 'var(--text-faint)', textAlign: 'center', maxWidth: '180px', lineHeight: 1.5, margin: 0 }}>
                System alerts and shift updates will appear here
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

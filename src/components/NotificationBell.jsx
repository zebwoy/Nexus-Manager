import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'

/**
 * NotificationBell — Notification header button.
 *
 * Dropdown is rendered via React Portal at <body> level so it floats
 * above ALL stacking contexts, globally on every page.
 */

const CLOSE_DELAY = 180

export default function NotificationBell() {
  const [open, setOpen]           = useState(false)
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 })

  const btnRef        = useRef(null)
  const closeTimerRef = useRef(null)

  const updatePosition = useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPopoverPos({
        top:   r.bottom + 8,
        right: window.innerWidth - r.right,
      })
    }
  }, [])

  const handleToggle = useCallback(() => {
    if (!open) updatePosition()
    setOpen(o => !o)
  }, [open, updatePosition])

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimerRef.current)
  }, [])

  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY)
  }, [])

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return
    const sync = () => updatePosition()
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [open, updatePosition])

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(closeTimerRef.current), [])

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="top-header-btn bell-btn"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={16} strokeWidth={2} />
      </button>

      {/* Portal — mounted at <body>, above all stacking contexts */}
      {open && createPortal(
        <>
          {/* Click-away backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setOpen(false)}
          />
          {/* Notification panel */}
          <div
            className="trp-popover"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            style={{
              position: 'fixed',
              top:   popoverPos.top,
              right: popoverPos.right,
              zIndex: 9999,
              width: '280px',
            }}
          >
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
        </>,
        document.body
      )}
    </>
  )
}

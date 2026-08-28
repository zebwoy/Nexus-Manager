import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { Sun, Moon, Bell, ArrowUp } from 'lucide-react'

/**
 * TopRightPanel — Fixed top-right control cluster
 *
 * Buttons (left → right):
 *   1. Scroll-to-top — greyed/disabled until a <table> or <ul>/<ol> exists on
 *      the page; becomes active, scrolls main content area to top on click.
 *   2. Theme toggle — switches dark/light; in light mode hover reveals accent
 *      colour picker.
 *   3. Notification bell — translucent placeholder for future alerts.
 */

// ── Scroll-to-top button ──────────────────────────────────────────────────────
function ScrollTopButton() {
  const [hasContent, setHasContent] = useState(false)

  // Detect tables/lists on the page (via MutationObserver + scroll)
  useEffect(() => {
    const check = () => {
      const found = !!document.querySelector(
        'table, ul.has-scroll-target, ol.has-scroll-target, [data-scroll-target], .data-table, .session-table, .inventory-table, tbody tr'
      )
      setHasContent(found)
    }

    // Initial check
    check()

    // Re-check on DOM mutations (route changes update content)
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  const handleClick = useCallback(() => {
    // Scroll the <main> element (Layout content area) to top
    const main = document.querySelector('main')
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  return (
    <button
      onClick={handleClick}
      disabled={!hasContent}
      className={`trp-btn trp-scroll-btn ${hasContent ? 'active' : ''}`}
      aria-label="Scroll to top"
      title={hasContent ? 'Scroll to top' : 'No scrollable content'}
    >
      <ArrowUp size={14} strokeWidth={2.5} />
    </button>
  )
}

// ── Notification Bell ─────────────────────────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="trp-btn trp-bell-btn"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={14} strokeWidth={2} />
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div className="trp-popover" style={{ zIndex: 50, width: '260px', right: 0 }}>
            <p style={{
              fontSize: '0.675rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.09em', color: 'var(--text-faint)', marginBottom: '0.7rem'
            }}>
              Notifications
            </p>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.4rem', padding: '1rem 0'
            }}>
              <Bell size={20} strokeWidth={1.4} style={{ color: 'var(--text-faint)', opacity: 0.5 }} />
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                No new notifications
              </p>
              <p style={{ fontSize: '0.675rem', color: 'var(--text-faint)', textAlign: 'center', maxWidth: '170px', lineHeight: 1.5 }}>
                Alerts and activity updates will appear here
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Theme Toggle (no animation) ───────────────────────────────────────────────
export function ThemeToggleButton() {
  const { isDark, toggleDark, accentId, setAccentId } = useTheme()
  const [showAccents, setShowAccents] = useState(false)
  const hoverTimerRef = useRef(null)

  const handleMouseEnter = useCallback(() => {
    if (!isDark) {
      hoverTimerRef.current = setTimeout(() => setShowAccents(true), 120)
    }
  }, [isDark])

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current)
    setShowAccents(false)
  }, [])

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={toggleDark}
        className="trp-btn trp-theme-btn"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        <span className={`trp-icon-wrap ${isDark ? 'dark' : 'light'}`}>
          {isDark
            ? <Moon size={14} strokeWidth={2.2} />
            : <Sun size={14} strokeWidth={2.2} />
          }
        </span>
      </button>

      {/* Accent swatch popover — light mode hover only */}
      {showAccents && !isDark && (
        <div className="trp-popover trp-accent-popover">
          <p style={{
            fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: '0.55rem'
          }}>
            Console Tint
          </p>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {Object.entries(ACCENTS).map(([id, a]) => (
              <button
                key={id}
                onClick={(e) => { e.stopPropagation(); setAccentId(id) }}
                title={a.label}
                className={`accent-swatch trp-swatch ${accentId === id ? 'selected' : ''}`}
                style={{ background: a.value }}
              />
            ))}
          </div>
          {/* Duo strip */}
          <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.18rem', borderRadius: '4px', overflow: 'hidden' }}>
            {Object.entries(ACCENTS).map(([id, a]) => (
              <div
                key={id}
                title={a.label}
                onClick={() => setAccentId(id)}
                style={{
                  flex: 1, height: '4px', cursor: 'pointer',
                  background: `linear-gradient(90deg, ${a.value}, ${a.hover})`,
                  borderRadius: '2px',
                  opacity: accentId === id ? 1 : 0.38,
                  transition: 'opacity 0.15s ease, transform 0.15s ease',
                  transform: accentId === id ? 'scaleY(1.6)' : 'scaleY(1)',
                }}
              />
            ))}
          </div>
          <p style={{
            fontSize: '0.55rem', color: 'var(--text-faint)', marginTop: '0.45rem',
            textAlign: 'center', letterSpacing: '0.04em'
          }}>
            {ACCENTS[accentId]?.label}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Top-Right Panel (main export) ─────────────────────────────────────────────
export default function TopRightPanel() {
  return (
    <div className="top-right-panel" id="top-right-panel">
      <ScrollTopButton />
      <div className="trp-divider" />
      <ThemeToggleButton />
      <div className="trp-divider" />
      <NotificationBell />
    </div>
  )
}

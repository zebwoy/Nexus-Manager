import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

/**
 * ThemeToggle — Top header theme switch button.
 *
 * Popover is rendered via React Portal at <body> level so it floats
 * above ALL stacking contexts — KPI cards, session buttons, anything.
 *
 * Hover pattern: close-delay (180ms grace) cancellable on re-enter,
 * preventing the popover from snapping shut when the mouse crosses
 * the natural gap between button and popover.
 */

const OPEN_DELAY  = 100   // ms before popover appears
const CLOSE_DELAY = 180   // ms grace period when mouse leaves

export default function ThemeToggle() {
  const { isDark, toggleDark, accentId, setAccentId } = useTheme()
  const [showAccents, setShowAccents] = useState(false)
  const [popoverPos, setPopoverPos]   = useState({ top: 0, right: 0 })

  const btnRef       = useRef(null)
  const openTimerRef = useRef(null)
  const closeTimerRef = useRef(null)

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimerRef.current)
  }, [])

  const scheduleClose = useCallback(() => {
    clearTimeout(openTimerRef.current)
    closeTimerRef.current = setTimeout(() => setShowAccents(false), CLOSE_DELAY)
  }, [])

  const updatePosition = useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPopoverPos({
        top:   r.bottom + 8,                    // 8px gap below button
        right: window.innerWidth - r.right,     // aligned to button's right edge
      })
    }
  }, [])

  const handleWrapperEnter = useCallback(() => {
    cancelClose()
    if (!isDark) {
      updatePosition()
      clearTimeout(openTimerRef.current)
      openTimerRef.current = setTimeout(() => setShowAccents(true), OPEN_DELAY)
    }
  }, [isDark, cancelClose, updatePosition])

  const handleWrapperLeave = useCallback(() => {
    clearTimeout(openTimerRef.current)
    scheduleClose()
  }, [scheduleClose])

  // Auto-close when switching to dark mode
  useEffect(() => {
    if (isDark) {
      clearTimeout(openTimerRef.current)
      clearTimeout(closeTimerRef.current)
      setShowAccents(false)
    }
  }, [isDark])

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!showAccents) return
    const sync = () => updatePosition()
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [showAccents, updatePosition])

  // Cleanup timers on unmount
  useEffect(() => () => {
    clearTimeout(openTimerRef.current)
    clearTimeout(closeTimerRef.current)
  }, [])

  return (
    <>
      <div
        onMouseEnter={handleWrapperEnter}
        onMouseLeave={handleWrapperLeave}
      >
        <button
          ref={btnRef}
          onClick={toggleDark}
          className="top-header-btn theme-toggle-btn"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span className={`top-header-icon-wrap ${isDark ? 'dark' : 'light'}`}>
            {isDark
              ? <Moon size={15} strokeWidth={2.2} />
              : <Sun  size={15} strokeWidth={2.2} />
            }
          </span>
        </button>
      </div>

      {/* Portal — mounted at <body>, bypasses all stacking contexts */}
      {showAccents && !isDark && createPortal(
        <div
          className="trp-popover trp-accent-popover"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: 'fixed',
            top:   popoverPos.top,
            right: popoverPos.right,
            zIndex: 9999,
            minWidth: '148px',
          }}
        >
          <p style={{
            fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: '0.6rem',
            textAlign: 'center'
          }}>
            Console Tint
          </p>

          {/* Colour swatches */}
          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
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

          {/* Gradient duo strip */}
          <div style={{
            marginTop: '0.65rem', display: 'flex', gap: '0.15rem',
            borderRadius: '4px', overflow: 'hidden'
          }}>
            {Object.entries(ACCENTS).map(([id, a]) => (
              <div
                key={id}
                title={a.label}
                onClick={() => setAccentId(id)}
                style={{
                  flex: 1, height: '4px', cursor: 'pointer',
                  background: `linear-gradient(90deg, ${a.value}, ${a.hover})`,
                  borderRadius: '2px',
                  opacity: accentId === id ? 1 : 0.35,
                  transition: 'opacity 0.15s ease, transform 0.15s ease',
                  transform: accentId === id ? 'scaleY(1.8)' : 'scaleY(1)',
                }}
              />
            ))}
          </div>

          <p style={{
            fontSize: '0.575rem', color: 'var(--text-faint)', marginTop: '0.5rem',
            textAlign: 'center', letterSpacing: '0.04em'
          }}>
            {ACCENTS[accentId]?.label}
          </p>
        </div>,
        document.body
      )}
    </>
  )
}

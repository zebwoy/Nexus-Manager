import { useState, useRef, useCallback, useEffect } from 'react'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

/**
 * ThemeToggle — Top header theme switch button
 *
 * Toggles Dark/Light mode on click.
 * In Light mode, hovering reveals the console tint accent swatches.
 *
 * Hover pattern uses a close-delay approach:
 *   - mouseLeave schedules close after CLOSE_DELAY ms
 *   - mouseEnter on either the button wrapper OR the popover cancels the timer
 * This prevents the popover from dismissing when the mouse crosses the
 * natural gap between button and popover.
 */

const OPEN_DELAY  = 100   // ms before popover appears
const CLOSE_DELAY = 180   // ms grace period when mouse leaves

export default function ThemeToggle() {
  const { isDark, toggleDark, accentId, setAccentId } = useTheme()
  const [showAccents, setShowAccents] = useState(false)

  const openTimerRef  = useRef(null)
  const closeTimerRef = useRef(null)

  // Cancel any pending close
  const cancelClose = useCallback(() => {
    clearTimeout(closeTimerRef.current)
  }, [])

  // Schedule a close — can be cancelled by entering the popover
  const scheduleClose = useCallback(() => {
    clearTimeout(openTimerRef.current)
    closeTimerRef.current = setTimeout(() => setShowAccents(false), CLOSE_DELAY)
  }, [])

  // Wrapper mouseEnter — cancel any pending close, schedule open (light only)
  const handleWrapperEnter = useCallback(() => {
    cancelClose()
    if (!isDark) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = setTimeout(() => setShowAccents(true), OPEN_DELAY)
    }
  }, [isDark, cancelClose])

  // Wrapper mouseLeave — schedule close
  const handleWrapperLeave = useCallback(() => {
    clearTimeout(openTimerRef.current)
    scheduleClose()
  }, [scheduleClose])

  // Close popover immediately if theme switches to dark while open
  useEffect(() => {
    if (isDark) {
      clearTimeout(openTimerRef.current)
      clearTimeout(closeTimerRef.current)
      setShowAccents(false)
    }
  }, [isDark])

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimeout(openTimerRef.current)
    clearTimeout(closeTimerRef.current)
  }, [])

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={handleWrapperEnter}
      onMouseLeave={handleWrapperLeave}
    >
      <button
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

      {/* Accent swatch popover — light mode hover only */}
      {showAccents && !isDark && (
        <div
          className="trp-popover trp-accent-popover"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ top: 'calc(100% + 0.5rem)', minWidth: '148px' }}
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
        </div>
      )}
    </div>
  )
}

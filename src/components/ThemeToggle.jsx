import { useState, useRef, useCallback } from 'react'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

/**
 * ThemeToggle — Top header theme switch button
 *
 * Toggles Dark/Light mode on click.
 * In Light mode, hovering reveals the console tint accent swatches & preview.
 */
export default function ThemeToggle() {
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
        className="top-header-btn theme-toggle-btn"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        <span className={`top-header-icon-wrap ${isDark ? 'dark' : 'light'}`}>
          {isDark
            ? <Moon size={15} strokeWidth={2.2} />
            : <Sun size={15} strokeWidth={2.2} />
          }
        </span>
      </button>

      {/* Accent swatch popover — light mode hover only */}
      {showAccents && !isDark && (
        <div className="trp-popover trp-accent-popover" style={{ top: 'calc(100% + 0.5rem)' }}>
          <p style={{
            fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase',
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
          {/* Duo strip preview */}
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
            fontSize: '0.575rem', color: 'var(--text-faint)', marginTop: '0.45rem',
            textAlign: 'center', letterSpacing: '0.04em'
          }}>
            {ACCENTS[accentId]?.label}
          </p>
        </div>
      )}
    </div>
  )
}

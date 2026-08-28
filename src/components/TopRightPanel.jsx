import { useRef, useEffect, useState, useCallback } from 'react'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import { Sun, Moon, Bell } from 'lucide-react'
import gsap from 'gsap'

/**
 * TopRightPanel — Fixed top-right control cluster
 *
 * Contains:
 * - ThemeToggleButton: GSAP SVG curtain wipe for dark/light transition
 *   (uses gsap attr tween to morph SVG path coordinates — no Club plugin required)
 * - NotificationBell: placeholder for future notification system
 *
 * SVG curtain technique: a full-screen <svg> overlays the viewport.
 * A <path> is tweened through three d-attribute keyframes:
 *   1. Collapsed at bottom edge (invisible start)
 *   2. Wave sweeping up (power2.in — sinusoidal feel)
 *   3. Flat full coverage (power2.out)
 * toggleDark() fires at the midpoint (full coverage) so the swap is hidden.
 * Then the curtain recedes upward and fades out.
 */

// ── Path data (viewBox 0 0 100 100, bottom-to-top sweep) ─────────────────────
const PATH_COLLAPSED  = 'M 0 100 V 100 Q 50 100 100 100 V 100 z'
const PATH_WAVE       = 'M 0 100 V 60 Q 25 38 50 58 Q 75 78 100 60 V 100 z'
const PATH_FULL       = 'M 0 100 V 0 Q 50 0 100 0 V 100 z'
const PATH_RECEDE     = 'M 0 0 V -5 Q 50 12 100 -5 V 0 z'

// ── Curtain SVG overlay ───────────────────────────────────────────────────────
function ThemeCurtain({ curtainRef, pathRef }) {
  return (
    <svg
      ref={curtainRef}
      id="theme-curtain-svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: 0,
      }}
    >
      <path ref={pathRef} className="theme-curtain-path" d={PATH_COLLAPSED} />
    </svg>
  )
}

// ── Notification Bell ─────────────────────────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="trp-btn"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={16} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />
        {/* Uncomment and wire count when backend is ready:
        <span className="trp-badge">3</span> */}
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div className="trp-popover" style={{ zIndex: 50, width: '280px', right: 0 }}>
            <p style={{
              fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '0.75rem'
            }}>
              Notifications
            </p>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.5rem', padding: '1.25rem 0', color: 'var(--text-faint)'
            }}>
              <Bell size={24} strokeWidth={1.5} />
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No new notifications
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textAlign: 'center', maxWidth: '180px' }}>
                Alerts and activity updates will appear here
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Theme Toggle with GSAP SVG Curtain ────────────────────────────────────────
export function ThemeToggleButton() {
  const { isDark, toggleDark, accentId, setAccentId } = useTheme()
  const [showAccents, setShowAccents] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const curtainRef = useRef(null)
  const pathRef = useRef(null)
  const tlRef = useRef(null)
  const hoverTimerRef = useRef(null)
  // Keep latest toggleDark in a ref so timeline .call() always has current version
  const toggleDarkRef = useRef(toggleDark)
  useEffect(() => { toggleDarkRef.current = toggleDark }, [toggleDark])

  // Build the GSAP timeline once — uses attr tweens, no plugin required
  useEffect(() => {
    if (!curtainRef.current || !pathRef.current) return

    const curtain = curtainRef.current
    const path = pathRef.current

    gsap.set(curtain, { opacity: 0 })
    gsap.set(path, { attr: { d: PATH_COLLAPSED } })

    const tl = gsap.timeline({
      paused: true,
      onStart: () => setIsAnimating(true),
      onComplete: () => setIsAnimating(false),
    })

    tl
      // Fade curtain in
      .to(curtain, { opacity: 1, duration: 0.08, ease: 'none' })
      // Wave sweeps up from bottom
      .to(path, { attr: { d: PATH_WAVE }, duration: 0.3, ease: 'power2.in' })
      // Wave flattens — covers full screen
      .to(path, { attr: { d: PATH_FULL }, duration: 0.22, ease: 'power2.out' })
      // ↑ Theme toggle fires here — hidden under full coverage
      .call(() => toggleDarkRef.current())
      // Brief pause at full coverage
      .to({}, { duration: 0.07 })
      // Curtain recedes upward with slight wave
      .to(path, { attr: { d: PATH_RECEDE }, duration: 0.28, ease: 'power2.in' })
      // Fade out
      .to(curtain, { opacity: 0, duration: 0.1, ease: 'none' })
      .call(() => {
        // Reset path for next trigger
        gsap.set(path, { attr: { d: PATH_COLLAPSED } })
      })

    tlRef.current = tl

    return () => { tl.kill() }
  }, []) // Build once; uses toggleDarkRef for current value

  const handleToggle = useCallback(() => {
    if (isAnimating || !tlRef.current) return
    setShowAccents(false)
    tlRef.current.restart()
  }, [isAnimating])

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
    <>
      <ThemeCurtain curtainRef={curtainRef} pathRef={pathRef} />

      <div
        style={{ position: 'relative' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={handleToggle}
          disabled={isAnimating}
          className="trp-btn trp-theme-btn"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span className={`trp-icon-wrap ${isDark ? 'dark' : 'light'}`}>
            {isDark
              ? <Moon size={16} strokeWidth={2.2} />
              : <Sun size={16} strokeWidth={2.2} />
            }
          </span>
        </button>

        {/* Accent Swatch Popover — light mode only, shows on hover */}
        {showAccents && !isDark && (
          <div className="trp-popover trp-accent-popover">
            <p style={{
              fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: '0.6rem'
            }}>
              Console Tint
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
            {/* Colour duo accent preview strip */}
            <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.2rem', borderRadius: '6px', overflow: 'hidden' }}>
              {Object.entries(ACCENTS).map(([id, a]) => (
                <div
                  key={id}
                  title={a.label}
                  onClick={() => setAccentId(id)}
                  style={{
                    flex: 1, height: '5px', cursor: 'pointer',
                    background: `linear-gradient(90deg, ${a.value}, ${a.hover})`,
                    borderRadius: '2px',
                    opacity: accentId === id ? 1 : 0.45,
                    transition: 'opacity 0.15s ease, transform 0.15s ease',
                    transform: accentId === id ? 'scaleY(1.4)' : 'scaleY(1)',
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
    </>
  )
}

// ── Top-Right Panel (main export) ─────────────────────────────────────────────
export default function TopRightPanel() {
  return (
    <div className="top-right-panel" id="top-right-panel">
      <ThemeToggleButton />
      <div className="trp-divider" />
      <NotificationBell />
    </div>
  )
}

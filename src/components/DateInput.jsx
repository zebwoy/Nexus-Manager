import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { todayISO } from '../lib/helpers'

/**
 * Premium Native DateInput Component
 * Enhances browser native date inputs with complimentary tactile styling,
 * glowing calendar icons, font alignment, and optional date stepping.
 */
export default function DateInput({
  value,
  onChange,
  showSteppers = false,
  showTodayButton = false,
  disabled = false,
  min,
  max,
  className = '',
  style = {},
  inputStyle = {},
  ...props
}) {
  const isToday = value === todayISO()

  const handleStep = (days) => {
    if (!value || disabled) return
    const d = new Date(value + 'T12:00:00')
    d.setDate(d.getDate() + days)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const newStr = `${y}-${m}-${day}`
    if (onChange) onChange({ target: { value: newStr } })
  }

  const handleSetToday = () => {
    if (disabled) return
    if (onChange) onChange({ target: { value: todayISO() } })
  }

  return (
    <div className={`date-input-container ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', ...style }}>
      {showSteppers && (
        <button
          type="button"
          className="btn-secondary btn-icon"
          onClick={() => handleStep(-1)}
          disabled={disabled}
          title="Previous Day"
          style={{ width: '1.95rem', height: '1.95rem', borderRadius: '8px', padding: 0 }}
        >
          <ChevronLeft size={13} />
        </button>
      )}

      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <Calendar
          size={14}
          style={{
            position: 'absolute',
            left: '0.75rem',
            color: 'var(--accent)',
            pointerEvents: 'none',
            opacity: 0.9,
            zIndex: 1
          }}
        />
        <input
          type="date"
          value={value}
          onChange={onChange}
          disabled={disabled}
          min={min}
          max={max}
          className="input date-input-styled"
          style={{
            paddingLeft: '2.1rem',
            paddingRight: '0.65rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 650,
            fontSize: '0.8125rem',
            letterSpacing: '0.02em',
            ...inputStyle
          }}
          {...props}
        />
      </div>

      {showSteppers && (
        <button
          type="button"
          className="btn-secondary btn-icon"
          onClick={() => handleStep(1)}
          disabled={disabled}
          title="Next Day"
          style={{ width: '1.95rem', height: '1.95rem', borderRadius: '8px', padding: 0 }}
        >
          <ChevronRight size={13} />
        </button>
      )}

      {showTodayButton && !isToday && (
        <button
          type="button"
          onClick={handleSetToday}
          className="badge badge-accent"
          style={{ cursor: 'pointer', border: '1px solid var(--accent-border)', padding: '0.25rem 0.55rem', fontSize: '0.68rem' }}
          title="Jump to Today"
        >
          Today
        </button>
      )}
    </div>
  )
}

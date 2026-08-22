import { Minus, Plus, Clock, Sparkles } from 'lucide-react'
import { formatDuration, formatRupees, calculateDynamicTariff } from '../lib/helpers'

/**
 * DurationSelector — Global reusable duration selector with [-] and [+] controls.
 * Cycles in 30-minute intervals between 30 mins and 8 hours (480 mins).
 *
 * Props:
 *   value        {number}    — current duration in minutes (e.g. 60, 90, 120)
 *   onChange     {function}  — called with new duration in minutes
 *   min          {number}    — minimum minutes allowed (default: 30)
 *   max          {number}    — maximum minutes allowed (default: 480 / 8 hrs)
 *   step         {number}    — minute step increment (default: 30)
 *   hourlyRate   {number}    — optional 1-hour rate to dynamically calculate and display price
 *   label        {string}    — optional label above selector
 *   compact      {boolean}   — whether to render in compact inline mode
 */
export default function DurationSelector({
  value = 60,
  onChange,
  min = 30,
  max = 480,
  step = 30,
  hourlyRate,
  label = 'Session Duration',
  compact = false,
}) {
  const currentMins = Math.min(Math.max(Number(value) || 30, min), max)

  const handleDecrement = () => {
    const next = Math.max(currentMins - step, min)
    onChange?.(next)
  }

  const handleIncrement = () => {
    const next = Math.min(currentMins + step, max)
    onChange?.(next)
  }

  const isMin = currentMins <= min
  const isMax = currentMins >= max
  const price = hourlyRate ? calculateDynamicTariff(hourlyRate, currentMins) : null

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isMin}
          className="btn-secondary btn-icon"
          style={{
            width: '2rem', height: '2rem', borderRadius: '8px',
            opacity: isMin ? 0.35 : 1, cursor: isMin ? 'not-allowed' : 'pointer'
          }}
          aria-label="Decrease duration by 30 mins"
        >
          <Minus size={13} />
        </button>

        <div style={{
          padding: '0.35rem 0.75rem', borderRadius: '8px',
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          textAlign: 'center', minWidth: '95px'
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' }}>
            {formatDuration(currentMins)}
          </span>
          {price !== null && (
            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-text)' }}>
              {formatRupees(price)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={isMax}
          className="btn-secondary btn-icon"
          style={{
            width: '2rem', height: '2rem', borderRadius: '8px',
            opacity: isMax ? 0.35 : 1, cursor: isMax ? 'not-allowed' : 'pointer'
          }}
          aria-label="Increase duration by 30 mins"
        >
          <Plus size={13} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label && (
        <label style={{
          fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: '0.35rem'
        }}>
          <Clock size={13} style={{ color: 'var(--accent)' }} />
          {label}
        </label>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.65rem 0.85rem', borderRadius: '12px',
        background: 'var(--bg-input)', border: '1.5px solid var(--border)',
        boxShadow: 'var(--shadow-inset)'
      }}>
        {/* Decrement Button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isMin}
          className="btn-secondary"
          style={{
            width: '2.5rem', height: '2.5rem', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isMin ? 0.3 : 1, cursor: isMin ? 'not-allowed' : 'pointer',
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-outset)', transition: 'all 0.15s ease'
          }}
          title="Decrease by 30 minutes"
        >
          <Minus size={16} style={{ color: 'var(--text)' }} />
        </button>

        {/* Center Display */}
        <div style={{ textAlign: 'center', padding: '0 1rem' }}>
          <div style={{
            fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)',
            letterSpacing: '-0.02em', lineHeight: 1.2
          }}>
            {formatDuration(currentMins)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ({(currentMins / 60).toFixed(currentMins % 60 === 0 ? 0 : 1)} hrs)
            </span>
            {price !== null && (
              <span className="badge badge-accent" style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                {formatRupees(price)}
              </span>
            )}
          </div>
        </div>

        {/* Increment Button */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={isMax}
          className="btn-secondary"
          style={{
            width: '2.5rem', height: '2.5rem', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isMax ? 0.3 : 1, cursor: isMax ? 'not-allowed' : 'pointer',
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-outset)', transition: 'all 0.15s ease'
          }}
          title="Increase by 30 minutes"
        >
          <Plus size={16} style={{ color: 'var(--text)' }} />
        </button>
      </div>
    </div>
  )
}

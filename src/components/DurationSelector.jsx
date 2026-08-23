import { Minus, Plus } from 'lucide-react'
import { formatDuration, formatRupees, calculateDynamicTariff } from '../lib/helpers'

/**
 * DurationSelector — Sleek duration selector with [-] and [+] controls.
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
  hourlyRate = null,
  label = null,
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
  const price = (hourlyRate && Number(hourlyRate) > 0) ? calculateDynamicTariff(Number(hourlyRate), currentMins) : null

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isMin}
          style={{
            width: '1.9rem', height: '1.9rem', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isMin ? 'var(--bg-input)' : 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: isMin ? 'var(--text-faint)' : 'var(--text)',
            opacity: isMin ? 0.35 : 1, cursor: isMin ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
          aria-label="Decrease duration by 30 mins"
        >
          <Minus size={13} strokeWidth={2.5} />
        </button>

        <div style={{
          padding: '0.25rem 0.65rem', borderRadius: '6px',
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          textAlign: 'center', minWidth: '85px'
        }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 750, color: 'var(--text)' }}>
            {formatDuration(currentMins)}
          </span>
          {price !== null && (
            <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-text)' }}>
              {formatRupees(price)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={isMax}
          style={{
            width: '1.9rem', height: '1.9rem', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isMax ? 'var(--bg-input)' : 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: isMax ? 'var(--text-faint)' : 'var(--text)',
            opacity: isMax ? 0.35 : 1, cursor: isMax ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
          aria-label="Increase duration by 30 mins"
        >
          <Plus size={13} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {label && (
        <label className="label" style={{ marginBottom: 0 }}>
          {label}
        </label>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '42px', padding: '0 0.35rem', borderRadius: '8px',
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-inset)'
      }}>
        {/* Decrement Button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isMin}
          style={{
            width: '32px', height: '32px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isMin ? 0.3 : 1, cursor: isMin ? 'not-allowed' : 'pointer',
            border: '1px solid var(--border)',
            background: isMin ? 'transparent' : 'var(--bg-card)',
            color: isMin ? 'var(--text-faint)' : 'var(--text)',
            transition: 'all 0.15s ease'
          }}
          title="Decrease by 30 minutes"
          aria-label="Decrease duration"
        >
          <Minus size={15} strokeWidth={2.5} />
        </button>

        {/* Center Display */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '0.45rem', padding: '0 0.5rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden'
        }}>
          <span style={{
            fontSize: '0.875rem', fontWeight: 750, color: 'var(--text)',
            letterSpacing: '-0.01em', whiteSpace: 'nowrap'
          }}>
            {formatDuration(currentMins)}
          </span>

          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            ({(currentMins / 60).toFixed(currentMins % 60 === 0 ? 0 : 1)}h)
          </span>
        </div>

        {/* Increment Button */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={isMax}
          style={{
            width: '32px', height: '32px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isMax ? 0.3 : 1, cursor: isMax ? 'not-allowed' : 'pointer',
            border: '1px solid var(--border)',
            background: isMax ? 'transparent' : 'var(--bg-card)',
            color: isMax ? 'var(--text-faint)' : 'var(--text)',
            transition: 'all 0.15s ease'
          }}
          title="Increase by 30 minutes"
          aria-label="Increase duration"
        >
          <Plus size={15} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}


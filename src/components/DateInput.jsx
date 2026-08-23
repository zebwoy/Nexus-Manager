import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X } from 'lucide-react'
import { todayISO } from '../lib/helpers'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/**
 * Premium Custom DatePicker & DateInput Component
 * Replaces the un-stylable browser native OS popup with a bespoke,
 * complimentary tactile calendar dropdown that supports dark/light themes,
 * month/year navigation, quick Today/Clear shortcuts, and 1-day step buttons.
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
  placeholder = 'Select date'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewMode, setViewMode] = useState('days') // 'days' | 'months' | 'years'
  const containerRef = useRef(null)

  // Parse current value or default to today
  const selectedDate = value ? new Date(value + 'T12:00:00') : null
  const isValidSelected = selectedDate && !isNaN(selectedDate.getTime())

  const [viewYear, setViewYear] = useState(() => (isValidSelected ? selectedDate.getFullYear() : new Date().getFullYear()))
  const [viewMonth, setViewMonth] = useState(() => (isValidSelected ? selectedDate.getMonth() : new Date().getMonth()))

  // Keep view in sync when value changes externally
  useEffect(() => {
    if (isValidSelected) {
      setViewYear(selectedDate.getFullYear())
      setViewMonth(selectedDate.getMonth())
    }
  }, [value])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setViewMode('days')
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setViewMode('days')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const todayStr = todayISO()
  const isToday = value === todayStr

  // Stepper handlers
  const handleStep = (days) => {
    if (disabled) return
    const current = isValidSelected ? new Date(value + 'T12:00:00') : new Date()
    current.setDate(current.getDate() + days)
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    const newStr = `${y}-${m}-${d}`
    emitChange(newStr)
  }

  const emitChange = (newDateStr) => {
    if (onChange) {
      onChange({ target: { value: newDateStr } })
    }
  }

  const handleSelectDay = (year, month, day) => {
    const mStr = String(month + 1).padStart(2, '0')
    const dStr = String(day).padStart(2, '0')
    const newStr = `${year}-${mStr}-${dStr}`
    emitChange(newStr)
    setIsOpen(false)
    setViewMode('days')
  }

  const handlePrevMonth = (e) => {
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  const handleNextMonth = (e) => {
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const handleSetToday = (e) => {
    if (e) e.stopPropagation()
    emitChange(todayStr)
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setIsOpen(false)
    setViewMode('days')
  }

  const handleClear = (e) => {
    e.stopPropagation()
    emitChange('')
    setIsOpen(false)
    setViewMode('days')
  }

  // Format display text: "23 Aug 2026" (non-breaking spaces to guarantee zero wrapping)
  const formattedDisplay = isValidSelected
    ? `${String(selectedDate.getDate()).padStart(2, '0')}\u00A0${MONTH_SHORT[selectedDate.getMonth()]}\u00A0${selectedDate.getFullYear()}`
    : placeholder

  // Generate calendar days grid (6 rows of 7 days = 42 cells)
  const generateDaysGrid = () => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const cells = []

    // 1. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const pMonth = viewMonth === 0 ? 11 : viewMonth - 1
      const pYear = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ day: d, month: pMonth, year: pYear, isCurrentMonth: false })
    }

    // 2. Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true })
    }

    // 3. Next month leading days (fill remaining up to 35 or 42 cells)
    const totalCells = cells.length > 35 ? 42 : 35
    const remaining = totalCells - cells.length
    for (let d = 1; d <= remaining; d++) {
      const nMonth = viewMonth === 11 ? 0 : viewMonth + 1
      const nYear = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, month: nMonth, year: nYear, isCurrentMonth: false })
    }

    return cells
  }

  const daysGrid = generateDaysGrid()

  return (
    <div
      ref={containerRef}
      className={`date-picker-custom ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        width: '100%',
        minWidth: 0,
        ...style
      }}
    >
      {/* Optional Stepper: Previous Day */}
      {showSteppers && (
        <button
          type="button"
          className="btn-secondary btn-icon"
          onClick={() => handleStep(-1)}
          disabled={disabled}
          title="Previous Day"
          style={{ width: '2.25rem', height: '2.5rem', borderRadius: '10px', padding: 0, flexShrink: 0 }}
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* Main Trigger Button / Field */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(o => !o)}
        className="input date-picker-trigger"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.45rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '0.45rem 0.65rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: isValidSelected ? 'var(--text)' : 'var(--text-faint)',
          height: '2.5rem',
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
          flex: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderColor: isOpen ? 'var(--accent)' : 'var(--border)',
          boxShadow: isOpen ? '0 0 0 3px var(--accent-dim), var(--shadow-inset)' : 'var(--shadow-inset)',
          transition: 'all 0.15s ease',
          ...inputStyle
        }}
      >
        <Calendar size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formattedDisplay}</span>
      </button>

      {/* Optional Stepper: Next Day */}
      {showSteppers && (
        <button
          type="button"
          className="btn-secondary btn-icon"
          onClick={() => handleStep(1)}
          disabled={disabled}
          title="Next Day"
          style={{ width: '2.25rem', height: '2.5rem', borderRadius: '10px', padding: 0, flexShrink: 0 }}
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Quick Jump Today Badge */}
      {showTodayButton && !isToday && (
        <button
          type="button"
          onClick={handleSetToday}
          className="badge badge-accent"
          style={{
            cursor: 'pointer',
            border: '1px solid var(--accent-border)',
            padding: '0 0.55rem',
            fontSize: '0.725rem',
            fontWeight: 750,
            height: '2.5rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
          title="Jump to Today"
        >
          Today
        </button>
      )}

      {/* ── FLOATING BESPOKE CALENDAR POPUP ── */}
      {isOpen && (
        <div
          className="custom-calendar-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 9999,
            width: '280px',
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)',
            borderRadius: '14px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06), var(--shadow-outset)',
            padding: '1rem',
            animation: 'calendarDropdownOpen 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            userSelect: 'none'
          }}
        >
          {/* Header: Month Year and Up/Down Arrows */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.85rem',
            paddingBottom: '0.65rem',
            borderBottom: '1px solid var(--border)'
          }}>
            <button
              type="button"
              onClick={() => setViewMode(m => (m === 'days' ? 'months' : 'days'))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontSize: '0.9rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
                borderRadius: '6px',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>{MONTH_NAMES[viewMonth]}, {viewYear}</span>
              <ChevronDown size={14} style={{ opacity: 0.6, transform: viewMode !== 'days' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="btn-secondary btn-icon"
                style={{ width: '1.75rem', height: '1.75rem', borderRadius: '6px', padding: 0 }}
                title="Previous Month"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="btn-secondary btn-icon"
                style={{ width: '1.75rem', height: '1.75rem', borderRadius: '6px', padding: 0 }}
                title="Next Month"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* VIEW 1: DAYS VIEW */}
          {viewMode === 'days' && (
            <>
              {/* Weekday Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '0.45rem', textAlign: 'center' }}>
                {WEEKDAYS.map(w => (
                  <span key={w} style={{ fontSize: '0.725rem', fontWeight: 750, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    {w}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                {daysGrid.map((cell, idx) => {
                  const mStr = String(cell.month + 1).padStart(2, '0')
                  const dStr = String(cell.day).padStart(2, '0')
                  const cellISO = `${cell.year}-${mStr}-${dStr}`
                  const isSelected = value === cellISO
                  const isCellToday = todayStr === cellISO

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDay(cell.year, cell.month, cell.day)}
                      style={{
                        height: '2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        border: isSelected
                          ? '1px solid var(--accent)'
                          : isCellToday
                          ? '1px solid rgba(56, 189, 248, 0.4)'
                          : '1px solid transparent',
                        background: isSelected
                          ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)'
                          : 'transparent',
                        color: isSelected
                          ? '#fff'
                          : cell.isCurrentMonth
                          ? 'var(--text)'
                          : 'var(--text-faint)',
                        opacity: cell.isCurrentMonth ? 1 : 0.35,
                        fontSize: '0.8rem',
                        fontWeight: isSelected || isCellToday ? 800 : 600,
                        fontFamily: "'JetBrains Mono', monospace",
                        cursor: 'pointer',
                        boxShadow: isSelected
                          ? '0 0 10px var(--accent-dim), inset 0 1px 0 rgba(255,255,255,0.25)'
                          : 'none',
                        transition: 'all 0.12s ease'
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--bg-hover)'
                          e.currentTarget.style.transform = 'scale(1.08)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.transform = 'scale(1)'
                        }
                      }}
                    >
                      {cell.day}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* VIEW 2: MONTHS & YEARS SELECTOR */}
          {viewMode === 'months' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setViewYear(y => y - 1)}
                  className="btn-secondary btn-icon"
                  style={{ width: '1.75rem', height: '1.75rem' }}
                >
                  <ChevronLeft size={13} />
                </button>
                <span style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.95rem', color: 'var(--accent-text)' }}>
                  {viewYear}
                </span>
                <button
                  type="button"
                  onClick={() => setViewYear(y => y + 1)}
                  className="btn-secondary btn-icon"
                  style={{ width: '1.75rem', height: '1.75rem' }}
                >
                  <ChevronRight size={13} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                {MONTH_SHORT.map((mName, mIdx) => {
                  const isCurrentSelectedMonth = viewMonth === mIdx
                  return (
                    <button
                      key={mName}
                      type="button"
                      onClick={() => {
                        setViewMonth(mIdx)
                        setViewMode('days')
                      }}
                      className="btn-secondary"
                      style={{
                        padding: '0.5rem 0.35rem',
                        fontSize: '0.775rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        background: isCurrentSelectedMonth ? 'var(--accent-dim)' : 'transparent',
                        borderColor: isCurrentSelectedMonth ? 'var(--accent-border)' : 'var(--border)',
                        color: isCurrentSelectedMonth ? 'var(--accent-text)' : 'var(--text)'
                      }}
                    >
                      {mName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer: Clear & Today Shortcuts */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '0.85rem',
            paddingTop: '0.65rem',
            borderTop: '1px solid var(--border)'
          }}>
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
                borderRadius: '6px',
                transition: 'color 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Clear
            </button>

            <button
              type="button"
              onClick={handleSetToday}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-text)',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Today
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes calendarDropdownOpen {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

// ─── Currency ─────────────────────────────────────────────────
export function formatRupees(amount) {
  if (amount == null) return '—'
  return `₹${Number(amount).toLocaleString('en-IN')}`
}

// ─── Duration ─────────────────────────────────────────────────
export function formatDuration(mins) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} mins`
  if (m === 0) return `${h} hr`
  return `${h} hr ${m} mins`
}

// Duration options for dropdowns (30 min steps, 30min to 8hr)
export const DURATION_OPTIONS = Array.from({ length: 16 }, (_, i) => {
  const mins = (i + 1) * 30
  return { value: mins, label: formatDuration(mins) }
})

// ─── Time / Date ──────────────────────────────────────────────
export function formatTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function addMinutes(date, mins) {
  return new Date(new Date(date).getTime() + mins * 60000)
}

// Today's date as YYYY-MM-DD (local timezone, not UTC)
export function todayISO() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Current time as HH:MM (for time inputs)
export function nowTimeInput() {
  const now = new Date()
  return now.toTimeString().slice(0, 5)
}

/**
 * Combine a date string (YYYY-MM-DD) and a time string (HH:MM or HH:MM:SS)
 * into an ISO string. If the resulting datetime is *before* a reference datetime
 * (e.g., time_in), the date is auto-advanced by 1 day (post-midnight sessions).
 *
 * @param {string} dateStr  — e.g. "2025-01-15"
 * @param {string} timeStr  — e.g. "23:45" or "00:15"
 * @param {Date|null} reference — if provided and result < reference, adds 1 day
 */
export function toISO(dateStr, timeStr, reference = null) {
  const dt = new Date(`${dateStr}T${timeStr}`)
  if (reference && dt < new Date(reference)) {
    // Crossed midnight — advance by one day
    dt.setDate(dt.getDate() + 1)
  }
  return dt.toISOString()
}

// ─── Validation ───────────────────────────────────────────────

/**
 * Validate a full name (First + Last required).
 * Used for customer lookups in sessions.
 */
export function validateName(name) {
  if (!name || !name.trim()) return 'Full Name is required'
  // We now allow single-word names (e.g., anonymous clients)
  return null
}

/**
 * Validate a first name (at minimum one word required).
 * Used in contexts like WalkIn Sale / Foreign Sale.
 */
export function validateFirstName(name) {
  if (!name || !name.trim()) return 'Name is required'
  return null
}

/**
 * Validate a 10-digit mobile number.
 * @param {string} mobile
 * @param {boolean} required — if false, empty is allowed
 */
export function validateMobile(mobile, required = false) {
  if (!mobile || !mobile.trim()) {
    return required ? 'Mobile number is required' : null
  }
  const clean = mobile.trim()
  if (!/^\d{10}$/.test(clean)) return 'Mobile number must be exactly 10 numeric digits'
  return null
}

// ─── Toasts & Notifications ───────────────────────────────────
export { showUndoToast } from './undoToast'

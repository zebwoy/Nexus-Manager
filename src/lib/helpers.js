// Format currency in INR
export function formatRupees(amount) {
  if (amount == null) return '—'
  return `₹${Number(amount).toLocaleString('en-IN')}`
}

// Format duration from minutes
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

// Format time as HH:MM
export function formatTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

// Format date as DD MMM YYYY
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

// Add minutes to a date
export function addMinutes(date, mins) {
  return new Date(new Date(date).getTime() + mins * 60000)
}

// Today's date as YYYY-MM-DD
export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// Current time as HH:MM (for time inputs)
export function nowTimeInput() {
  const now = new Date()
  return now.toTimeString().slice(0, 5)
}

// Combine date + time string into ISO string
export function toISO(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`).toISOString()
}

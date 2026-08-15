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

// Validate mandatory name (First Name and Last Name required)
export function validateName(name) {
  if (!name || !name.trim()) return 'Full Name (First and Last Name) is required'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return 'Please enter both First Name and Last Name'
  return null
}

// Validate 10-digit mobile number
export function validateMobile(mobile, required = false) {
  if (!mobile || !mobile.trim()) {
    return required ? 'Mobile number is required' : null
  }
  const clean = mobile.trim()
  if (!/^\d{10}$/.test(clean)) return 'Mobile number must be exactly 10 numeric digits'
  return null
}


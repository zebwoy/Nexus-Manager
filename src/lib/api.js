const BASE = '/api'

/**
 * Maps raw server/DB error strings to user-friendly messages.
 * Keeps internal stack traces, config details, and SQL out of the UI.
 */
function sanitizeApiError(raw, status) {
  if (!raw) return `Something went wrong (${status}). Please try again.`

  // Internal system errors that must never be shown verbatim
  const internalPrefixes = [
    'TENANT_NOT_RESOLVED',
    'TENANT_SUSPENDED',
    'STAFF_SUSPENDED',
    'SQLSTATE',
    'ERROR:',
    'db error',
    'relation "',
    'column "',
    'syntax error',
    'invalid input syntax',
  ]
  const isInternal = internalPrefixes.some(p => raw.toLowerCase().includes(p.toLowerCase()))

  if (raw.startsWith('TENANT_SUSPENDED')) return 'Your cafe account is currently suspended. Please contact support.'
  if (raw.startsWith('STAFF_SUSPENDED'))  return 'Your staff account has been suspended. Contact your admin.'
  if (raw.startsWith('TENANT_NOT_RESOLVED') || isInternal) {
    return 'Unable to reach the server. Please check your connection and try again.'
  }

  // Safe to show — these are intentional user-facing messages from the API
  return raw
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('nexus_user'))
  } catch {
    return null
  }
}

async function request(path, options = {}) {
  const user = getUser()
  const tenantSchema = localStorage.getItem('nexus_tenant_schema')
  const orgId = localStorage.getItem('nexus_org_id')
  const userEmail = localStorage.getItem('nexus_user_email')
  const clerkToken = localStorage.getItem('nexus_clerk_token')

  const userName = localStorage.getItem('nexus_user_name') || user?.full_name
  const userAvatar = localStorage.getItem('nexus_user_avatar') || user?.avatar_url

  const headers = {
    'Content-Type': 'application/json',
    ...(user ? { 'x-user-id': String(user.id), 'x-username': user.username, 'x-role': user.role || 'operator' } : {}),
    ...(userName ? { 'x-user-fullname': userName } : {}),
    ...(userAvatar ? { 'x-user-avatar': userAvatar } : {}),
    ...(tenantSchema ? { 'x-tenant-schema': tenantSchema } : {}),
    ...(orgId ? { 'x-org-id': orgId } : {}),
    ...(userEmail ? { 'x-user-email': userEmail } : {}),
    ...(clerkToken ? { 'Authorization': `Bearer ${clerkToken}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  const text = await res.text()

  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch (e) {
    if (!res.ok) {
      throw new Error(`Server Error (${res.status}): Please check backend database connection or parameters.`)
    }
    throw new Error('Invalid response received from server.')
  }

  if (!res.ok) {
    const raw = data.error || data.message || ''
    // Sanitize internal/technical errors — never show raw system messages to users
    const friendly = sanitizeApiError(raw, res.status)
    throw new Error(friendly)
  }
  return data
}

export const api = {
  get:    (path)         => request(path),
  post:   (path, body)   => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)   => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)         => request(path, { method: 'DELETE' }),
  patch:  (path, body)   => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),

  // Binary upload for Vercel Blob (receipts, logo images, etc.)
  uploadBlob: async (file, schemaName, folder = 'receipts') => {
    const user = getUser()
    const tenantSchema = localStorage.getItem('nexus_tenant_schema')
    const userEmail = localStorage.getItem('nexus_user_email')
    const headers = {
      'Content-Type': file.type,
      'x-filename': file.name,
      'x-content-type': file.type,
      'x-folder': folder,
      'x-schema-name': schemaName || tenantSchema || 'org',
      ...(user ? { 'x-user-id': String(user.id), 'x-username': user.username, 'x-role': user.role || 'operator' } : {}),
      ...(userEmail ? { 'x-user-email': userEmail } : {}),
    }
    const res = await fetch(`${BASE}/blob-upload`, { method: 'POST', headers, body: file })
    const text = await res.text()
    let data
    try { data = text ? JSON.parse(text) : {} } catch { data = {} }
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`)
    return data
  }
}

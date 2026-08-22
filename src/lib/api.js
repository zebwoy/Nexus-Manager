const BASE = '/api'

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

  const headers = {
    'Content-Type': 'application/json',
    ...(user ? { 'x-user-id': String(user.id), 'x-username': user.username, 'x-role': user.role || 'operator' } : {}),
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
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`)
  }
  return data
}

export const api = {
  get:    (path)         => request(path),
  post:   (path, body)   => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)   => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)         => request(path, { method: 'DELETE' }),
  patch:  (path, body)   => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),

  // Binary upload for Vercel Blob (logo images, etc.)
  uploadBlob: async (file, schemaName) => {
    const user = getUser()
    const tenantSchema = localStorage.getItem('nexus_tenant_schema')
    const userEmail = localStorage.getItem('nexus_user_email')
    const headers = {
      'Content-Type': file.type,
      'x-filename': file.name,
      'x-content-type': file.type,
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

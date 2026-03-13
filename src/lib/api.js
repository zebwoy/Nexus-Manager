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
  const headers = {
    'Content-Type': 'application/json',
    ...(user ? { 'x-user-id': String(user.id), 'x-username': user.username } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`)
  }
  return data
}

export const api = {
  get:    (path)         => request(path),
  post:   (path, body)   => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)   => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)         => request(path, { method: 'DELETE' }),
  patch:  (path, body)   => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
}

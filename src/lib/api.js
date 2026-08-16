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
}

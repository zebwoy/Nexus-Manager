import test from 'node:test'
import assert from 'node:assert/strict'
import { handleLogin } from '../api/auth.js'

// Mock pool and response for isolated unit testing
function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.data = payload
      return this
    }
  }
  return res
}

test('Trial sandbox authentication returns 200 and demo schema without crashing on cold starts', async () => {
  const req = { method: 'POST', body: { username: 'trial', pin: '0000' } }
  const res = createMockRes()

  const mockPool = {
    async query(sql) {
      if (sql.includes('information_schema.schemata')) {
        return { rows: [{ schema_name: 'tenant_demo_sandbox' }] }
      }
      return { rows: [] }
    },
    async connect() {
      return {
        async query(sql) {
          if (sql.includes('SELECT id, full_name, username')) {
            return {
              rows: [{
                id: 1,
                full_name: 'Demo Operator',
                username: 'trial',
                email: 'demo@nexus.local',
                avatar_url: '',
                role: 'admin',
                status: 'active'
              }]
            }
          }
          return { rows: [] }
        },
        release() {}
      }
    }
  }

  await handleLogin(mockPool, req, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.data.user.username, 'trial')
  assert.equal(res.data.user.schema_name, 'tenant_demo_sandbox')
  assert.equal(res.data.user.role, 'admin')
})

test('Rejects malformed handles (e.g. "admin", "admina") with 401', async () => {
  const req = { method: 'POST', body: { username: 'admina', pin: '1234' } }
  const res = createMockRes()
  const mockPool = { async query() { return { rows: [] } } }

  await handleLogin(mockPool, req, res)
  assert.equal(res.statusCode, 401)
  assert.match(res.data.error, /Invalid username format/)
})

test('Superadmin bypass returns 200 and super_admin role', async () => {
  const req = { method: 'POST', body: { username: 'superadmin', pin: '9999' } }
  const res = createMockRes()
  const mockPool = { async query() { return { rows: [] } } }

  await handleLogin(mockPool, req, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.data.user.username, 'superadmin')
  assert.equal(res.data.user.role, 'super_admin')
})

test('Authenticates valid tenant handle with correct PIN and returns complete tenant metadata', async () => {
  const req = { method: 'POST', body: { username: 'hgc_admin@1', pin: '1234' } }
  const res = createMockRes()

  const mockPool = {
    async query(sql, params) {
      if (sql.includes('public.tenants')) {
        return {
          rows: [{
            name: 'Headshot Gaming Cafe',
            slug: 'hgc',
            logo_url: 'https://example.com/logo.png',
            schema_name: 'tenant_hgc',
            status: 'active'
          }]
        }
      }
      return { rows: [] }
    },
    async connect() {
      return {
        async query(sql, params) {
          if (sql.includes('SELECT id, full_name, username')) {
            return {
              rows: [{
                id: 1,
                full_name: 'Ayman Shaikh',
                username: 'hgc_admin@1',
                email: 'imanriyaj@gmail.com',
                avatar_url: 'https://example.com/avatar.jpg',
                role: 'admin',
                status: 'active'
              }]
            }
          }
          return { rows: [] }
        },
        release() {}
      }
    }
  }

  await handleLogin(mockPool, req, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.data.user.username, 'hgc_admin@1')
  assert.equal(res.data.user.full_name, 'Ayman Shaikh')
  assert.equal(res.data.user.schema_name, 'tenant_hgc')
  assert.equal(res.data.user.tenant_name, 'Headshot Gaming Cafe')
  assert.equal(res.data.user.avatar_url, 'https://example.com/avatar.jpg')
})


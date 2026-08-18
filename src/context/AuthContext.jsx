import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('nexus_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [activeTenant, setActiveTenantState] = useState(() => {
    const schema = localStorage.getItem('nexus_tenant_schema')
    const name = localStorage.getItem('nexus_tenant_name')
    return schema ? { schemaName: schema, name: name || schema } : null
  })

  const login = (userData) => {
    localStorage.setItem('nexus_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('nexus_user')
    setUser(null)
  }

  const setActiveTenant = (tenant) => {
    if (tenant?.schemaName) {
      localStorage.setItem('nexus_tenant_schema', tenant.schemaName)
      localStorage.setItem('nexus_tenant_name', tenant.name || tenant.schemaName)
      setActiveTenantState(tenant)
    } else {
      localStorage.removeItem('nexus_tenant_schema')
      localStorage.removeItem('nexus_tenant_name')
      setActiveTenantState(null)
    }
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.username === 'trial' || user?.username === 'admin'
  const isSuperAdmin = user?.role === 'super_admin' || user?.username === 'superadmin' || user?.username === 'admin' || user?.is_super_admin === true

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAdmin,
      isSuperAdmin,
      activeTenant,
      setActiveTenant
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

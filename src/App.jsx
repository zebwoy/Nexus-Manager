import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import NewSession from './pages/NewSession'
import SessionDetail from './pages/SessionDetail'
import { PanCafe, NewPanCafe } from './pages/PanCafe'
import { Inventory, WalkInSale, Recharges, NewRecharge, Expenses, NewExpense, Customers, Reports, Settings, EODReconciliation } from './pages/OtherPages'
import Audit from './pages/Audit'

// Super Admin Pages
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import TenantManagement from './pages/superadmin/TenantManagement'
import SuperAdminAudit from './pages/superadmin/SuperAdminAudit'

import JoinOrganization from './pages/JoinOrganization'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

function SuperAdminRoute({ children }) {
  const { user, isSuperAdmin } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperAdmin) return <Navigate to="/" replace />
  return <SuperAdminLayout>{children}</SuperAdminLayout>
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login"               element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/join-organization"   element={<JoinOrganization />} />
      
      {/* Super Admin Routes */}
      <Route path="/super-admin"         element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
      <Route path="/super-admin/tenants" element={<SuperAdminRoute><TenantManagement /></SuperAdminRoute>} />
      <Route path="/super-admin/audit"   element={<SuperAdminRoute><SuperAdminAudit /></SuperAdminRoute>} />

      {/* Tenant Cafe Console Routes */}
      <Route path="/"                element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/sessions"        element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
      <Route path="/sessions/new"    element={<ProtectedRoute><NewSession /></ProtectedRoute>} />
      <Route path="/sessions/:id"    element={<ProtectedRoute><SessionDetail /></ProtectedRoute>} />
      <Route path="/pancafe"         element={<Navigate to="/sessions" replace />} />
      <Route path="/pancafe/new"     element={<ProtectedRoute><NewPanCafe /></ProtectedRoute>} />

      <Route path="/inventory"       element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/inventory/sell"  element={<ProtectedRoute><WalkInSale /></ProtectedRoute>} />
      <Route path="/recharges"       element={<ProtectedRoute><Recharges /></ProtectedRoute>} />
      <Route path="/recharges/new"   element={<ProtectedRoute><NewRecharge /></ProtectedRoute>} />
      <Route path="/expenses"        element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/expenses/new"    element={<ProtectedRoute><NewExpense /></ProtectedRoute>} />
      <Route path="/customers"       element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/reports"         element={<AdminRoute><Reports /></AdminRoute>} />
      <Route path="/audit"           element={<AdminRoute><Audit /></AdminRoute>} />
      <Route path="/settings"        element={<AdminRoute><Settings /></AdminRoute>} />
      <Route path="/eod"             element={<ProtectedRoute><EODReconciliation /></ProtectedRoute>} />
      <Route path="*"                element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer position="bottom-right" theme="dark" autoClose={5000} />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

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

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login"           element={user ? <Navigate to="/" replace /> : <Login />} />
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
      <Route path="/settings"        element={<AdminRoute><Settings /></AdminRoute>} />
      <Route path="/eod"             element={<ProtectedRoute><EODReconciliation /></ProtectedRoute>} />
      <Route path="*"                element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

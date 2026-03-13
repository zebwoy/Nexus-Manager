import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import NewSession from './pages/NewSession'
import { PanCafe, NewPanCafe } from './pages/PanCafe'
import { Inventory, WalkInSale, Recharges, NewRecharge, Expenses, NewExpense, Customers, Reports, Settings } from './pages/OtherPages'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
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
      <Route path="/pancafe"         element={<ProtectedRoute><PanCafe /></ProtectedRoute>} />
      <Route path="/pancafe/new"     element={<ProtectedRoute><NewPanCafe /></ProtectedRoute>} />
      <Route path="/inventory"       element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/inventory/sell"  element={<ProtectedRoute><WalkInSale /></ProtectedRoute>} />
      <Route path="/recharges"       element={<ProtectedRoute><Recharges /></ProtectedRoute>} />
      <Route path="/recharges/new"   element={<ProtectedRoute><NewRecharge /></ProtectedRoute>} />
      <Route path="/expenses"        element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/expenses/new"    element={<ProtectedRoute><NewExpense /></ProtectedRoute>} />
      <Route path="/customers"       element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/reports"         element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/settings"        element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*"                element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  )
}

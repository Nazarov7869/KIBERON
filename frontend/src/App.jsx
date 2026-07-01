// =====================================================================
//  ROUTER — ochiq (auth) va himoyalangan (shell) marshrutlar
// =====================================================================
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Lots from './pages/Lots'
import Rfqs from './pages/Rfqs'
import Pools from './pages/Pools'
import PoolDetail from './pages/PoolDetail'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Advisor from './pages/Advisor'
import Companies from './pages/Companies'
import Leads from './pages/Leads'
import Staff from './pages/Staff'
import Quality from './pages/Quality'

function Protected() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Yuklanmoqda…</div>
  if (!user) return <Navigate to="/login" replace />
  return <AppShell />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lots" element={<Lots />} />
        <Route path="/rfqs" element={<Rfqs />} />
        <Route path="/pools" element={<Pools />} />
        <Route path="/pools/:id" element={<PoolDetail />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="/advisor" element={<Advisor />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

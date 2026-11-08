import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function AdminRoute() {
  const { session } = useAuth()
  if (!session) return <Navigate to="/admin/login" replace />
  if (session.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

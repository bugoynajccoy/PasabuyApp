import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute() {
  const { session } = useAuth(); const loc = useLocation()
  if (!session) return <Navigate to="/login" state={{ from: loc }} replace />
  if (session.role === 'admin') return <Navigate to="/admin" replace /> // admins use the admin interface
  return <Outlet />
}

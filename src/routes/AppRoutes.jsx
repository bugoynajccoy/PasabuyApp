import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute.jsx'
import AdminRoute from './AdminRoute.jsx'
import MainLayout from '../layouts/MainLayout.jsx'
import AdminLayout from '../layouts/AdminLayout.jsx'
import Home from '../pages/user/Home.jsx'
import MobileHome from '../pages/user/MobileHome.jsx'
import Profile from '../pages/user/Profile.jsx'
import Messages from '../pages/user/Messages.jsx'
import Conversation from '../pages/user/Conversation.jsx'
import Notifications from '../pages/user/Notifications.jsx'
import Login from '../pages/auth/Login.jsx'
import Register from '../pages/auth/Register.jsx'
import ForgotPassword from '../pages/auth/ForgotPassword.jsx'
import AdminDashboard from '../pages/admin/AdminDashboard.jsx'
import { UserManagement, PostManagement, TransactionManagement, Reports, ActivityLogs } from '../pages/admin/ManagementPages.jsx'
import Payments from '../pages/admin/Payments.jsx'
import Verifications from '../pages/admin/Verifications.jsx'
import AdminSettings from '../pages/admin/AdminSettings.jsx'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<Login adminMode />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/mobile" element={<MobileHome />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/chat" element={<Conversation />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
      </Route>
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="posts" element={<PostManagement />} />
          <Route path="transactions" element={<TransactionManagement />} />
          <Route path="payments" element={<Payments />} />
          <Route path="verifications" element={<Verifications />} />
          <Route path="reports" element={<Reports />} />
          <Route path="logs" element={<ActivityLogs />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

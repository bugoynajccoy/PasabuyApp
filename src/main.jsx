import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './vendor/bootstrap.bundle.min.js' // Bootstrap's data-bs-* tabs, modals and offcanvas keep working as in the original
import './styles/auth.css'
import './styles/admin.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { initSync } from './services/sync.js'

const start = () => ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
)

initSync().catch(() => {}).finally(start) // pull shared data first so accounts/messages from other devices exist before the app reads them

import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './vendor/bootstrap.bundle.min.js' // Bootstrap's data-bs-* tabs, modals and offcanvas keep working as in the original
import './styles/auth.css'
import './styles/admin.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { initSync } from './services/sync.js'

const start = () => ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </HashRouter>
)

initSync().catch(() => {}).finally(start) // pull shared data first so accounts/messages from other devices exist before the app reads them
import { useEffect } from 'react'

// Shared card used by Login / Register / Forgot password. Reuses the sidebar's "Pasabuy ." brand markup.
export default function AuthShell({ title, children }) {
  // Coming from the app pages, Bootstrap can leave an invisible full-screen backdrop over the page that blocks every click and keystroke. Clear it.
  useEffect(() => {
    document.querySelectorAll('.modal-backdrop,.offcanvas-backdrop').forEach((el) => el.remove())
    document.body.classList.remove('modal-open', 'offcanvas-backdrop')
    document.body.removeAttribute('style')
  }, [])
  return (
    <div className="auth-wrap">
      <div className="card auth-card border p-4">
        <h3 className="fw-bold text-center">Pasabuy <span className="text-warning">.</span></h3>
        <h6 className="text-center text-secondary mb-3">{title}</h6>
        {children}
      </div>
    </div>
  )
}

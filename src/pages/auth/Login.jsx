import { useState } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import AuthShell from '../../components/AuthShell.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Login({ adminMode = false }) {
  const { login, session } = useAuth(); const nav = useNavigate(); const loc = useLocation()
  const [f, setF] = useState({ identifier: '', password: '', remember: false })
  const [show, setShow] = useState(false); const [error, setError] = useState('')
  const success = loc.state?.registered ? 'Account created. You can now log in.' : ''
  // Already signed in: go to the right place. On the admin login page a normal user stays here so they can switch to the admin account.
  if (session && (!adminMode || session.role === 'admin')) return <Navigate to={session.role === 'admin' ? '/admin' : '/'} replace />

  const submit = (e) => {
    e.preventDefault()
    if (!f.identifier.trim() || !f.password) return setError('Please enter your email/username and password.')
    const r = login(f.identifier, f.password, f.remember, adminMode)
    if (!r.ok) return setError(r.error)
    nav(r.user.role === 'admin' ? '/admin' : loc.state?.from?.pathname || '/', { replace: true })
  }
  return (
    <AuthShell title={adminMode ? 'Administrator login' : 'Log in to your account'}>
      {adminMode && session && session.role !== 'admin' && <div className="alert alert-warning py-2">You are signed in as {session.username}. Logging in here switches to the admin account.</div>}
      {success && <div className="alert alert-success py-2">{success}</div>}
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <form onSubmit={submit} noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="identifier">Email or username</label>
          <input id="identifier" className="form-control" value={f.identifier} onChange={(e) => setF({ ...f, identifier: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="password">Password</label>
          <div className="input-group">
            <input id="password" type={show ? 'text' : 'password'} className="form-control" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <div className="d-flex justify-content-between mb-3">
          <div className="form-check">
            <input id="remember" type="checkbox" className="form-check-input" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} />
            <label className="form-check-label" htmlFor="remember">Remember me</label>
          </div>
          <Link to="/forgot-password" className="small">Forgot password?</Link>
        </div>
        <button className="btn btn-dark w-100">Log in</button>
      </form>
      {!adminMode && <p className="text-center small mt-3 mb-0">No account? <Link to="/register">Create an account</Link></p>}
    </AuthShell>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../../components/AuthShell.jsx'

export default function ForgotPassword() {
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState(null)
  const submit = (e) => {
    e.preventDefault()
    setMsg(/^\S+@\S+\.\S+$/.test(email) ? { ok: true, t: 'If that email is registered, a reset link will be sent. (Prototype: no email is actually sent.)' } : { ok: false, t: 'Enter a valid email address.' })
  }
  return (
    <AuthShell title="Reset your password">
      {msg && <div className={`alert py-2 alert-${msg.ok ? 'success' : 'danger'}`}>{msg.t}</div>}
      <form onSubmit={submit} noValidate>
        <label className="form-label" htmlFor="fp">Email address</label>
        <input id="fp" className="form-control mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-dark w-100">Send reset link</button>
      </form>
      <p className="text-center small mt-3 mb-0"><Link to="/login">Back to log in</Link></p>
    </AuthShell>
  )
}

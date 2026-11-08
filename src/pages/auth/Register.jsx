import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../../components/AuthShell.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { readImage } from '../../utils/format.js'

const fields = [['name', 'Full name', 'text'], ['username', 'Username', 'text'], ['email', 'Email address', 'email'], ['phone', 'Contact number', 'tel'], ['password', 'Password', 'password'], ['confirm', 'Confirm password', 'password']]

export default function Register() {
  const { register, session, logout } = useAuth(); const nav = useNavigate()
  const [f, setF] = useState({ name: '', username: '', email: '', phone: '', password: '', confirm: '', terms: false })
  const [error, setError] = useState(''); const [avatar, setAvatar] = useState('')
  const pick = async (e) => { const file = e.target.files?.[0]; setAvatar(''); if (!file) return; try { setError(''); setAvatar(await readImage(file, 256)) } catch (x) { setError(x.message) } }
  const submit = (e) => {
    e.preventDefault()
    if (fields.some(([k]) => !f[k].trim())) return setError('Please fill in all required fields.')
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError('Enter a valid email address.')
    if (f.password.length < 8) return setError('Password must be at least 8 characters.')
    if (f.password !== f.confirm) return setError('Passwords do not match.')
    if (!f.terms) return setError('You must accept the terms and conditions.')
    let r; try { r = register({ ...f, avatar }) } catch { r = { ok: false, error: 'Something went wrong while creating the account. Please try again.' } }
    if (!r.ok) return setError(r.error)
    if (session) logout() // otherwise /login bounces straight back to the account that is still signed in
    nav('/login', { state: { registered: true } })
  }
  return (
    <AuthShell title="Create your account">
      {session && <div className="alert alert-warning py-2 small">You are signed in as <b>{session.username}</b>. Creating an account will sign you out so you can log in with the new one.</div>}
      {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
      <form onSubmit={submit} noValidate>
        {fields.map(([k, label, type]) => (
          <div className="mb-2" key={k}>
            <label className="form-label" htmlFor={k}>{label}</label>
            <input id={k} type={type} className="form-control" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </div>
        ))}
        <div className="mb-2">
          <label className="form-label" htmlFor="avatar">Profile picture (optional)</label>
          <input id="avatar" type="file" accept="image/*" className="form-control" onChange={pick} />
        </div>
        <div className="form-check mb-3">
          <input id="terms" type="checkbox" className="form-check-input" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} />
          <label className="form-check-label" htmlFor="terms">I accept the terms and conditions</label>
        </div>
        <button className="btn btn-dark w-100">Register</button>
      </form>
      <p className="text-center small mt-3 mb-0">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthShell>
  )
}

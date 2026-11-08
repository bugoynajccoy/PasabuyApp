import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { load, save, logAction } from '../../data/store.js'
import { seedUsers } from '../../data/mockData.js'

export default function AdminSettings() {
  const { session } = useAuth()
  const [pw, setPw] = useState({ cur: '', next: '', confirm: '' }); const [msg, setMsg] = useState(null)
  const [platform, setPlatform] = useState(() => load('pb_platform', { name: 'Pasabuy', maintenance: false }))
  const changePassword = (e) => {
    e.preventDefault()
    const users = load('pb_users', seedUsers); const me = users.find((u) => u.id === session.id)
    if (me.password !== pw.cur) return setMsg({ ok: false, t: 'Current password is incorrect.' })
    if (pw.next.length < 8 || pw.next !== pw.confirm) return setMsg({ ok: false, t: 'New password must be 8+ characters and match the confirmation.' })
    save('pb_users', users.map((u) => (u.id === me.id ? { ...u, password: pw.next } : u))); logAction('Changed admin password')
    setPw({ cur: '', next: '', confirm: '' }); setMsg({ ok: true, t: 'Password updated.' })
  }
  return (
    <>
      <h4 className="fw-bold mb-3">Settings</h4>
      <div className="row g-3">
        <div className="col-lg-4"><div className="card card-body"><h6 className="fw-bold">Admin profile</h6><div>{session.name}</div><div className="text-secondary">@{session.username}</div></div></div>
        <div className="col-lg-4"><form className="card card-body" onSubmit={changePassword}>
          <h6 className="fw-bold">Change password</h6>
          {msg && <div className={`alert py-2 alert-${msg.ok ? 'success' : 'danger'}`}>{msg.t}</div>}
          {[['cur', 'Current'], ['next', 'New'], ['confirm', 'Confirm new']].map(([k, l]) => <input key={k} type="password" className="form-control mb-2" placeholder={l} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} />)}
          <button className="btn btn-dark">Update password</button>
        </form></div>
        <div className="col-lg-4"><div className="card card-body">
          <h6 className="fw-bold">Platform settings</h6>
          <input className="form-control mb-2" value={platform.name} onChange={(e) => setPlatform({ ...platform, name: e.target.value })} />
          <div className="form-check form-switch mb-2"><input id="mt" type="checkbox" className="form-check-input" checked={platform.maintenance} onChange={(e) => setPlatform({ ...platform, maintenance: e.target.checked })} /><label className="form-check-label" htmlFor="mt">Maintenance mode</label></div>
          <button className="btn btn-dark" onClick={() => { save('pb_platform', platform); logAction('Updated platform settings') }}>Save</button>
        </div></div>
      </div>
    </>
  )
}

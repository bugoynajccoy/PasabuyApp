import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { initial } from '../utils/format.js'
import useActor from '../hooks/useActor.js'
import useLive from '../hooks/useLive.js'
import { verificationService } from '../services/index.js'

// Same sprite + icon sizing as the user-facing Home sidebar / bottom nav.
const Icon = ({ name, size = 'bi-md' }) => <svg className={`bi ${size} align-middle`} aria-hidden="true"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-${name}`} /></svg>

// tab: shown in the mobile bottom bar. The rest live under "More".
const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'grid-3x3-gap', end: true, tab: true },
  { to: '/admin/users', label: 'User Management', short: 'Users', icon: 'people', tab: true },
  { to: '/admin/posts', label: 'Post Management', short: 'Posts', icon: 'collection', tab: true },
  { to: '/admin/transactions', label: 'Transaction Management', short: 'Transactions', icon: 'receipt', tab: true },
  { to: '/admin/payments', label: 'Payments', icon: 'wallet2' },
  { to: '/admin/verifications', label: 'ID Verifications', icon: 'patch-check', badge: true },
  { to: '/admin/reports', label: 'Reports and Disputes', icon: 'flag' },
  { to: '/admin/logs', label: 'Activity Logs', icon: 'clock-history' },
  { to: '/admin/settings', label: 'Settings', icon: 'gear' },
]
const TABS = NAV.filter((n) => n.tab)
const MORE = NAV.filter((n) => !n.tab)

const Avatar = ({ name, size = 36 }) => (
  <span className="d-flex rounded-circle bg-primary align-items-center justify-content-center flex-shrink-0 text-white fw-bold" style={{ width: size, height: size }} aria-hidden="true">{initial(name)}</span>
)

export default function AdminLayout() {
  const { session, logout } = useAuth(); const go = useNavigate(); const { pathname } = useLocation()
  const [more, setMore] = useState(false); const admin = useActor(); const [pending, setPending] = useState(0)
  const refreshPending = useCallback(async () => { if (admin) try { setPending(await verificationService.pendingCount(admin)) } catch { /* not an admin yet */ } }, [admin])
  useEffect(() => { refreshPending() }, [refreshPending]); useLive(refreshPending)
  const count = (n) => (n.badge && pending > 0 ? <span className="badge rounded-pill bg-warning text-dark ms-2" aria-label={`${pending} pending`}>{pending}</span> : null)
  const doLogout = () => { if (window.confirm('Log out?')) { logout(); go('/admin/login') } }
  const moreActive = MORE.some((n) => pathname.startsWith(n.to))

  useEffect(() => { setMore(false) }, [pathname])
  useEffect(() => {
    if (!more) return undefined
    const key = (e) => e.key === 'Escape' && setMore(false)
    window.addEventListener('keydown', key)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev }
  }, [more])

  const item = 'list-group-item list-group-item-action rounded-2 mb-2'
  const on = { backgroundColor: 'var(--admin-active)' } // same soft highlight Home's sidebar uses for the current page
  const link = (n, extra = '') => ({ className: ({ isActive }) => `${item} ${extra}${isActive ? ' fw-bold' : ''}`.trim(), style: ({ isActive }) => (isActive ? on : undefined) })

  return (
    <div className="d-lg-flex">
      {/* Desktop sidebar: same #sidebar element, classes and icon sizing as Home, so the GitHub theme styles it identically */}
      <aside id="sidebar" className="admin-sidebar d-none d-lg-flex flex-column list-group list-group-flush bg-white text-black p-2" aria-label="Admin navigation">
        <h3 className="fw-bold p-2">Pasabuy<span className="text-warning">.</span> <small className="fs-6 text-secondary fw-normal">Admin</small></h3>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} {...link(n)}><Icon name={n.icon} /> {n.label}{count(n)}</NavLink>
        ))}
        <div className="mt-auto pt-2 admin-foot">
          <div className="d-flex align-items-center gap-2 p-2">
            <Avatar name={session.username} />
            <div className="lh-sm text-truncate"><div className="fw-bold text-black text-truncate">{session.username}</div><small className="text-secondary">Administrator</small></div>
          </div>
          <a href="#logout" className={item} onClick={(e) => { e.preventDefault(); doLogout() }}><Icon name="box-arrow-right" /> Log out</a>
        </div>
      </aside>

      <div className="admin-main flex-grow-1 d-flex flex-column min-vh-100">
        {/* Mobile top bar: identical markup to Home's navbar */}
        <nav className="navbar navbar-expand-lg bg-white text-black d-lg-none sticky-top" style={{ borderBottom: '2px solid rgba(128, 128, 128, 0.13)' }}>
          <div className="container">
            <h3 className="fw-bold p-2 navbar-brand text-black">Pasabuy<span className="text-warning">.</span> <small className="fs-6 text-secondary fw-normal">Admin</small></h3>
            <ul className="navbar-nav"><div className="d-flex flex-row">
              <li className="nav-item px-2"><button type="button" aria-label="Log out" onClick={doLogout} className="nav-link text-black bg-transparent border-0"><Icon name="box-arrow-right" /></button></li>
            </div></ul>
          </div>
        </nav>

        <main className="admin-content p-3 flex-grow-1"><Outlet /></main>

        {/* Mobile bottom bar: identical markup to Home's bottom nav */}
        <nav className="navbar navbar-expand-lg bg-white sticky-bottom d-lg-none py-0 admin-tabbar" style={{ borderTop: '2px solid rgba(128, 128, 128, 0.13)' }} aria-label="Admin navigation">
          <div className="container"><ul className="navbar-nav w-100"><div className="d-flex justify-content-around align-items-center">
            {TABS.map((n) => (
              <li className="nav-item" key={n.to}>
                <NavLink to={n.to} end={n.end} className={({ isActive }) => `nav-link d-flex flex-column justify-content-center align-items-center admin-tab ${isActive ? 'active text-black fw-bold' : 'text-secondary'}`}>
                  <span className="admin-tab-icon"><Icon name={n.icon} /></span><span><small>{n.short || n.label}</small></span>
                </NavLink>
              </li>
            ))}
            <li className="nav-item">
              <button type="button" className={`nav-link d-flex flex-column justify-content-center align-items-center admin-tab bg-transparent border-0 ${moreActive || more ? 'active text-black fw-bold' : 'text-secondary'}`} onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more}>
                <span className="admin-tab-icon position-relative"><Icon name="three-dots" />{pending > 0 && <span className="position-absolute top-0 end-0 translate-middle p-1 bg-warning rounded-circle" style={{ marginRight: -6, marginTop: 6 }}><span className="visually-hidden">{pending} pending verifications</span></span>}</span><span><small>More</small></span>
              </button>
            </li>
          </div></ul></div>
        </nav>
      </div>

      {more && (
        <div className="admin-sheet-backdrop d-lg-none" onMouseDown={(e) => e.target === e.currentTarget && setMore(false)}>
          <div className="admin-sheet bg-white" role="dialog" aria-modal="true" aria-label="More admin pages">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="d-flex align-items-center gap-2"><Avatar name={session.username} /><div className="lh-sm"><div className="fw-bold text-black">{session.username}</div><small className="text-secondary">Administrator</small></div></div>
              <button type="button" className="btn btn-close" aria-label="Close" onClick={() => setMore(false)} />
            </div>
            <div className="list-group list-group-flush pt-2">
              {MORE.map((n) => (
                <NavLink key={n.to} to={n.to} {...link(n, 'py-3')}><Icon name={n.icon} /> {n.label}{count(n)}</NavLink>
              ))}
              <a href="#logout" className={`${item} py-3`} onClick={(e) => { e.preventDefault(); doLogout() }}><Icon name="box-arrow-right" /> Log out</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

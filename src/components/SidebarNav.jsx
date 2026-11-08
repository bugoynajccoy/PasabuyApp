import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useComposer } from './PostComposer.jsx'
import UnreadBadge from './UnreadBadge.jsx'

const Icon = ({ id, cls = 'bi-md' }) => <svg className={`bi ${cls} align-middle`}><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#${id}`} /></svg>
const item = 'list-group-item list-group-item-action rounded-2 mb-2'
const on = { backgroundColor: 'rgba(255, 193, 7, 0.18)' }

// Desktop sidebar content. Same destinations as the mobile bars: Home, Search, Post, Profile, plus the bell and chat from the mobile top bar.
// Every entry is a real route (or opens the shared search / composer), so it works the same on every page.
export default function SidebarNav() {
  const { pathname } = useLocation(); const [params] = useSearchParams(); const nav = useNavigate()
  const { logout } = useAuth(); const { openComposer } = useComposer()
  const home = pathname === '/' || pathname === '/mobile'
  const messages = pathname.startsWith('/messages')
  const notifications = pathname === '/notifications'
  const ownProfile = pathname === '/profile' && !params.get('user')
  const cls = (a) => `${item}${a ? ' fw-bold' : ''}`
  const doLogout = () => { logout(); nav('/login', { replace: true }) }
  return (
    <>
      <h3 className="fw-bold p-2">Pasabuy<span className="text-warning">.</span></h3>
      <Link to="/" className={cls(home)} style={home ? on : undefined} aria-current={home ? 'page' : undefined}><Icon id="bi-house-door" /> Home</Link>
      <a href="#search" className={item}><Icon id="bi-search" /> Search</a>
      <Link to="/messages" className={cls(messages)} style={messages ? on : undefined} aria-current={messages ? 'page' : undefined}><Icon id="bi-chat" /> Messages<UnreadBadge kind="messages" inline /></Link>
      <Link to="/notifications" className={cls(notifications)} style={notifications ? on : undefined} aria-current={notifications ? 'page' : undefined}><Icon id="bi-heart" /> Notifications<UnreadBadge kind="notifications" inline /></Link>
      <a href="#post" onClick={(e) => { e.preventDefault(); openComposer() }} className={item}><Icon id="bi-plus-square" cls="bi-sm" /> Post</a>
      <Link to="/profile" className={cls(ownProfile)} style={ownProfile ? on : undefined} aria-current={ownProfile ? 'page' : undefined}><Icon id="bi-person-circle" cls="bi-sm" /> Profile</Link>
      <a href="#logout" onClick={(e) => { e.preventDefault(); doLogout() }} className={item}><Icon id="bi-box-arrow-right" /> Log out</a>
    </>
  )
}

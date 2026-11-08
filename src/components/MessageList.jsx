import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { messageService } from '../services/index.js'
import useActor from '../hooks/useActor.js'
import useLive from '../hooks/useLive.js'
import { initial } from '../utils/format.js'

const TX_BADGE = {
  pending: ['warning', 'Awaiting approval'], approved: ['warning', 'Approved'], paid: ['warning', 'Payment held'],
  in_transit: ['secondary', 'In transit'], delivered: ['secondary', 'Delivered'], completed: ['success', 'Completed'], disputed: ['danger', 'Disputed'],
}
const row = { borderBottom: '2px solid rgba(128, 128, 128, 0.13)' }
const dot = { width: '10px', height: '10px' }

export function listTime(iso) {
  const d = new Date(iso); const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1)
  if (d.toDateString() === t.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
export const Avatar = ({ user, size = 45, cls = 'h3' }) => (
  <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 overflow-hidden" style={{ width: `${size}px`, height: `${size}px`, objectFit: 'cover' }}>
    {user?.avatar ? <img src={user.avatar} alt="" className="w-100 h-100" style={{ objectFit: 'cover' }} /> : (cls === 'h2' ? <h2 className="text-light fw-bold m-0">{initial(user?.username)}</h2> : <h3 className="text-light fw-bold m-0">{initial(user?.username)}</h3>)}
  </div>
)

function contextBadge(c) {
  if (c.tx) { const [color, label] = TX_BADGE[c.tx.transactionStatus] || ['secondary', c.tx.transactionStatus]; return [color, label] }
  if (c.post) return c.post.type === 'trip' ? ['warning', `Trip: ${c.post.origin} to ${c.post.destination}`] : ['success', `Request: ${c.post.title}`]
  return null
}

export default function MessageList() {
  const actor = useActor()
  const [items, setItems] = useState(null); const [tab, setTab] = useState('all'); const [q, setQ] = useState('')
  const load = useCallback(async () => { if (actor) setItems(await messageService.getConversations(actor)) }, [actor])
  useLive(load); useState(() => { load() }) // initial load; live updates after that

  const s = q.trim().toLowerCase()
  const shown = (items || []).filter((c) => (tab === 'all' || (tab === 'unread' && c.unread > 0) || (tab === 'tx' && c.tx))
    && (!s || (c.otherUsername || '').toLowerCase().includes(s) || c.last.content.toLowerCase().includes(s)))

  return (
    <div className="container p-0 min-vh-100">
      <div className="p-4">
        <input id="search" type="search" placeholder="Search" className="form-control bg-opacity-25 rounded-5" style={{ border: '2px solid rgba(128, 128, 128, 0.13)' }} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="row gap-2 w-100 px-4 my-3" role="tablist">
        {[['all', 'All'], ['unread', 'Unread'], ['tx', 'Transactions']].map(([k, label]) => (
          <button key={k} type="button" className={`btn btn-outline-dark btn-sm col-auto rounded-3 ${tab === k ? 'active' : ''}`} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div className="tab-content">
        <div className="tab-pane fade show active" role="tabpanel">
          <div className="p-2">
            <div className="rounded-3 px-3 py-2 d-flex bg-success-subtle align-items-center justify-content-start gap-3">
              <svg className="bi bi-md align-middle text-success"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-shield-check`} /></svg>
              <div className="d-flex flex-column"><p className="text-success fw-bold m-0">Keep chats and payment in Pasabuy. <span className="text-success fw-normal m-0">We can protect deals and transaction made here.</span></p></div>
            </div>
          </div>
          {items === null && <p className="text-center text-secondary my-5">Loading…</p>}
          {items && shown.length === 0 && (
            <p className="text-center text-secondary my-5 px-4">
              {items.length === 0 ? 'No conversations yet. Tap “Send a message” on a post to start one.' : 'No conversations match.'}
            </p>
          )}
          {shown.map((c) => {
            const badge = contextBadge(c); const mine = c.last.senderId === actor
            return (
              <Link key={c.id} to={`/messages/chat?with=${c.otherId}`} className="nav-link">
                <div className={`d-flex flex-column gap-3 ${c.unread ? 'bg-warning bg-opacity-10' : 'bg-white'} p-2 w-100`} style={row}>
                  <div className="d-flex flex-row gap-2">
                    <Avatar user={c.other} />
                    <div className="d-flex justify-content-between align-items-center w-100 gap-2" style={{ minWidth: 0 }}>
                      <div className="d-flex flex-column" style={{ minWidth: 0 }}>
                        <p className="text-black fw-bold m-0">{c.otherUsername || 'deleted user'}{badge && <> <span className={`badge rounded-pill bg-${badge[0]} bg-opacity-25 text-${badge[0]}`}>{badge[1]}</span></>}</p>
                        <p className={`m-0 text-truncate ${c.unread ? 'text-black fw-semibold' : 'text-secondary'}`}>{mine ? 'You: ' : ''}{c.last.content}</p>
                      </div>
                      <small className="text-secondary flex-shrink-0">{listTime(c.last.createdAt)}{c.unread > 0 && <span className="d-inline-block bg-warning rounded-5 ms-1 align-middle" style={dot}></span>}</small>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

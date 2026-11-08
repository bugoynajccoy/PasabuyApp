import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationService } from '../services/index.js'
import useActor from '../hooks/useActor.js'
import useLive from '../hooks/useLive.js'
import { timeAgo, initial, POSTS_CHANGED } from '../utils/format.js'

const TABS = [
  { key: '', label: 'All' },
  { key: 'tx', label: 'Transactions', types: ['transaction'] },
  { key: 'msg', label: 'Messages', types: ['message'] },
  { key: 'posts', label: 'Posts', types: ['offer', 'offer_rejected', 'post_removed'] },
]
const ICON = { transaction: 'bi-credit-card', verification: 'bi-shield-check', post_removed: 'bi-bag', offer: 'bi-bag', offer_rejected: 'bi-bag', message: 'bi-chat', like: 'bi-heart', comment: 'bi-chat', payment: 'bi-credit-card' }
const border = { borderBottom: '1px solid rgba(128, 128, 128, 0.13)' }

export default function NotificationList() {
  const actor = useActor(); const navigate = useNavigate()
  const [items, setItems] = useState(null); const [tab, setTab] = useState('')
  const load = useCallback(async () => { if (actor) setItems((await notificationService.getForUser(actor)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))) }, [actor])
  useEffect(() => { load() }, [load])
  useLive(load)
  useEffect(() => { window.addEventListener(POSTS_CHANGED, load); return () => window.removeEventListener(POSTS_CHANGED, load) }, [load])

  const types = TABS.find((t) => t.key === tab)?.types
  const shown = (items || []).filter((n) => !types || types.includes(n.type))
  const unread = (items || []).filter((n) => !n.isRead).length
  const open = async (n) => { if (!n.isRead) { await notificationService.markRead(n.id, actor); load() } if (n.link) navigate(n.link) }
  const markAll = async () => { await notificationService.markAllRead(actor); load() }

  return (
    <div className="container min-vh-100 w-100 p-0">
      <div className="row gap-2 w-100 px-4 my-3">
        {TABS.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`btn btn-outline-dark btn-sm col-auto rounded-3 ${tab === t.key ? 'active' : ''}`}>{t.label}</button>)}
      </div>
      <div className="d-flex justify-content-between p-2 align-items-center">
        <h6 className="fw-bold m-0">{unread ? `${unread} new` : 'Notifications'}</h6>
        {unread > 0 && <button className="btn text-warning btn-sm rounded-4" onClick={markAll}>Mark all as read</button>}
      </div>
      {items === null && <p className="text-center text-secondary my-5">Loading…</p>}
      {items && shown.length === 0 && <p className="text-center text-secondary my-5">No notifications yet.</p>}
      {shown.map((n) => (
        <div key={n.id} role="button" onClick={() => open(n)} className={`d-flex flex-row gap-2 px-2 py-3 w-100 position-relative ${n.isRead ? '' : 'bg-warning bg-opacity-10'}`} style={{ ...border, cursor: 'pointer' }}>
          <div className="bg-success bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 45, height: 45 }}>
            {ICON[n.type] ? <svg className="bi bi-md align-middle text-success"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#${ICON[n.type]}`} /></svg> : <b className="text-success">{initial(n.type)}</b>}
          </div>
          <div className="d-flex flex-column flex-grow-1"><p className="m-0 text-black">{n.message}</p><small className="text-secondary">{timeAgo(n.createdAt)}</small></div>
          {!n.isRead && <span className="bg-warning rounded-5 flex-shrink-0 mt-1" style={{ width: 10, height: 10 }} />}
        </div>
      ))}
    </div>
  )
}

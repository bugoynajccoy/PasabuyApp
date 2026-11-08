import { useCallback, useEffect, useRef, useState } from 'react'
import UnreadBadge from './UnreadBadge.jsx'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useComposer } from './PostComposer.jsx'
import VerificationPanel from './VerificationPanel.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import useActor from '../hooks/useActor.js'
import { postService, transactionService, reviewService, userService } from '../services/index.js'
import { peso, fmtDate, initial, readImage, POSTS_CHANGED } from '../utils/format.js'

const card = { border: '2px solid rgba(128, 128, 128, 0.13)' }
const memberSince = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '')
const DONE = { approved: 1, paid: 2, in_transit: 3, delivered: 4, completed: 4, disputed: 2 }
const STATUS_LABEL = { pending: 'Awaiting approval', approved: 'Approved', paid: 'Payment held', in_transit: 'In transit', delivered: 'Delivered', disputed: 'Disputed' }
const POST_BADGE = { active: ['success', 'Open'], closed: ['warning', 'Matched'], expired: ['secondary', 'Expired'], completed: ['secondary', 'Done'] }
const STEPS = [
  { label: 'Approved', bar: 'bg-success', text: 'text-dark-emphasis' },
  { label: 'Paid', bar: 'bg-success', text: 'text-dark-emphasis' },
  { label: 'Purchased', bar: 'bg-warning', text: 'text-warning' },
  { label: 'Delivered', bar: 'bg-dark', text: 'text-dark-emphasis' },
]

function Progress({ status }) {
  const n = DONE[status] || 0
  return (
    <div className="row g-1 text-center">
      {STEPS.map((s, i) => (
        <div className="col-3" key={s.label}>
          <div className="progress" style={{ height: '5px' }}><div className={`progress-bar ${s.bar}`} style={{ width: i < n ? '100%' : '0%' }}></div></div>
          <small className={i < n ? s.text : 'text-secondary'}>{s.label}</small>
        </div>
      ))}
    </div>
  )
}

function EditProfile({ user, actor, onClose, onSaved }) {
  const [f, setF] = useState({ name: user.name || '', phone: user.phone || '', location: user.location || '', bio: user.bio || '', avatar: user.avatar || '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const fileRef = useRef(null)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const pick = async (e) => { const file = e.target.files?.[0]; if (!file) return; try { setErr(''); setF((p) => ({ ...p, avatar: '' })); const avatar = await readImage(file, 256); setF((p) => ({ ...p, avatar })) } catch (x) { setErr(x.message) } }
  const save = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await userService.update(actor, actor, { ...f, name: f.name.trim(), phone: f.phone.trim() }); onSaved() } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-end align-items-md-center justify-content-center" style={{ zIndex: 2000, background: 'rgba(0,0,0,.45)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Edit profile">
      <div className="bg-white rounded-top-4 rounded-bottom-md-4 w-100 d-flex flex-column" style={{ maxWidth: 520, maxHeight: '92vh' }}>
        <div className="d-flex justify-content-between align-items-center p-3 pb-2"><h5 className="m-0">Edit profile</h5><button type="button" className="btn btn-close" aria-label="Close" onClick={onClose} /></div>
        <form onSubmit={save} noValidate className="p-3 pt-1 overflow-auto">
          <div className="d-flex flex-column align-items-center mb-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="d-flex rounded-circle bg-primary align-items-center justify-content-center flex-shrink-0 border-0 p-0 overflow-hidden" style={{ width: '80px', height: '80px' }} aria-label="Change photo">
              {f.avatar ? <img src={f.avatar} alt="" className="w-100 h-100" style={{ objectFit: 'cover' }} /> : <span className="fs-1 text-white fw-bold">{initial(user.username)}</span>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
            <small className="text-secondary mt-1">Tap to change photo</small>
            {f.avatar && <button type="button" className="btn btn-sm text-warning" onClick={() => setF((p) => ({ ...p, avatar: '' }))}>Remove photo</button>}
          </div>
          <div className="mb-2"><label className="form-label mb-1" htmlFor="pf-name">Name</label><input id="pf-name" className="form-control" value={f.name} onChange={set('name')} maxLength={60} /></div>
          <div className="mb-2"><label className="form-label mb-1" htmlFor="pf-phone">Mobile number</label><input id="pf-phone" className="form-control" inputMode="tel" placeholder="09XXXXXXXXX" value={f.phone} onChange={set('phone')} /></div>
          <div className="mb-2"><label className="form-label mb-1" htmlFor="pf-loc">Location</label><input id="pf-loc" className="form-control" placeholder="e.g. Dimasalang" value={f.location} onChange={set('location')} maxLength={60} /></div>
          <div className="mb-2"><label className="form-label mb-1" htmlFor="pf-bio">Bio</label><textarea id="pf-bio" className="form-control" rows={3} value={f.bio} onChange={set('bio')} maxLength={160} /></div>
          {err && <div className="alert alert-danger py-2 my-2" role="alert">{err}</div>}
          <div className="d-flex gap-2 pt-2"><button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-warning fw-bold flex-grow-1" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </div>
    </div>
  )
}

const TabCard = ({ children }) => <div className="card bg-white bg-opacity-25 p-3 m-3 rounded-4" style={card}>{children}</div>
const Empty = ({ text }) => <TabCard><div className="text-dark-emphasis text-center">{text}</div></TabCard>

// Shared real profile. `embedded` = desktop tab inside Home (no mobile top/bottom bars).
export default function ProfileView({ embedded = false }) {
  const { openComposer } = useComposer()
  const { logout } = useAuth(); const nav = useNavigate(); const actor = useActor()
  const [params] = useSearchParams(); const viewId = embedded ? null : params.get('user'); const target = viewId || actor; const own = !viewId || viewId === actor
  const [data, setData] = useState(null); const [tab, setTab] = useState('requests'); const [editing, setEditing] = useState(false); const [shareMsg, setShareMsg] = useState('')

  const load = useCallback(async () => {
    if (!actor || !target) return
    let user; try { user = await userService.getById(target) } catch { setData({ missing: true }); return }
    const [posts, txs, reviews, users] = await Promise.all([postService.getAll({ userId: target, status: 'all' }), transactionService.getForUser(target), reviewService.getForUser(target), userService.getAll()])
    const mine = posts.filter((p) => p.status !== 'removed')
    const active = !own ? null : txs.filter((t) => !['completed', 'cancelled'].includes(t.transactionStatus)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
    let activeInfo = null
    if (active) {
      const other = users.find((u) => u.id === (active.requesterId === actor ? active.travelerId : active.requesterId))
      let post = null; try { post = await postService.getById(active.postId) } catch { /* post may be gone */ }
      activeInfo = { tx: active, other, post }
    }
    setData({
      user, activeInfo,
      requests: mine.filter((p) => p.type === 'request'), trips: mine.filter((p) => p.type === 'trip'),
      deliveries: txs.filter((t) => t.travelerId === target && t.transactionStatus === 'completed').length,
      reviews: reviews.map((r) => ({ ...r, reviewer: users.find((u) => u.id === r.reviewerId) })),
    })
  }, [actor, target, own])
  useEffect(() => { setData(null); load() }, [load])
  useEffect(() => { window.addEventListener(POSTS_CHANGED, load); return () => window.removeEventListener(POSTS_CHANGED, load) }, [load])

  const share = async () => {
    const text = `@${data.user.username} on Pasabuy`
    try {
      if (navigator.share) { await navigator.share({ title: 'Pasabuy', text, url: window.location.origin }); return }
      await navigator.clipboard.writeText(`${text} ${window.location.origin}`); setShareMsg('Copied to clipboard')
    } catch (e) { if (e?.name !== 'AbortError') setShareMsg('Could not share right now') }
    setTimeout(() => setShareMsg(''), 2500)
  }
  const doLogout = () => { logout(); nav('/login', { replace: true }) }

  if (!data) return <div className="text-center text-secondary my-5">Loading profile…</div>
  if (data.missing) return <div className="container text-center my-5"><p className="text-secondary">This profile doesn't exist.</p><Link to="/profile" className="btn btn-warning fw-bold">Back to my profile</Link></div>
  const { user, activeInfo } = data
  const joined = memberSince(user.createdAt)
  const ai = activeInfo
  const activeTitle = ai?.tx.itemDetails
  const activeWith = ai ? `with ${ai.other?.name || 'another user'}${ai.post ? ` ${ai.post.origin} to ${ai.post.destination}` : ''}` : ''

  return (
    <>
{!embedded && (<nav className="navbar navbar-expand-lg bg-white text-black d-lg-none sticky-top" style={{borderBottom:'2px solid rgba(128, 128, 128, 0.13)'}}>{' '}<div className="container">{' '}<h3 className="fw-bold p-2 navbar-brand text-black">{' '}@{user.username}{' '}<span className="text-warning">.</span>{' '}</h3>{' '}<ul className="navbar-nav"><div className="d-flex flex-row">{' '}{!own && <li className="nav-item px-2"><button type="button" aria-label="Back" onClick={() => nav(-1)} className="nav-link text-black bg-transparent border-0"><svg className="bi bi-md align-middle"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-arrow-left`} /></svg></button></li>}{own && <>{' '}<li className="nav-item px-2">{' '}<button type="button" aria-label="Log out" onClick={doLogout} className="nav-link text-black bg-transparent border-0">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-box-arrow-right`} />{' '}</svg>{' '}</button>{' '}</li></>}{' '}</div></ul>{' '}</div>{' '}</nav>)}
{!embedded && !own && (<div className="d-none d-lg-flex align-items-center gap-3 container py-2" style={{borderBottom:'2px solid rgba(128, 128, 128, 0.13)'}}><button type="button" aria-label="Back" onClick={() => nav(-1)} className="btn p-0 border-0 bg-transparent"><svg className="bi bi-md align-middle text-secondary"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-arrow-left`} /></svg></button><span className="fw-bold">@{user.username}</span></div>)}
<div className="container-fluid p-2">
  <div className="d-flex flex-column justify-content-center align-items-center px-2">
    <div className="d-flex rounded-circle bg-primary align-items-center justify-content-center flex-shrink-0 overflow-hidden" style={{width:'80px',height:'80px'}}>
      {user.avatar ? <img src={user.avatar} alt={user.username} className="w-100 h-100" style={{objectFit:'cover'}} /> : <p className="fs-1 text-white fw-bold text-center m-0">{initial(user.username)}</p>}
    </div>
    <h5 className="fw-bold m-0 mt-2">{user.username}</h5>
    {user.verified ? (
      <div className="text-primary mb-2"><svg className="bi bi-sm align-middle"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-patch-check`} /></svg>{' '}<small>Verified Traveler & Requester</small></div>
    ) : (
      <div className="text-secondary mb-2"><small>Traveler & Requester</small></div>
    )}
    <div className="row flex-grow-1 mb-2 align-items-center text-center w-100">
      <div className="col-4"><div className="d-flex flex-column align-items-center justify-content-center"><h5 className="m-0 fw-bold">{data.deliveries}</h5><small className="m-0 text-secondary">Deliveries</small></div></div>
      <div className="col-4"><div className="d-flex flex-column align-items-center justify-content-center"><h5 className="m-0 fw-bold">{data.requests.length}</h5><small className="m-0 text-secondary">Requests</small></div></div>
      <div className="col-4"><div className="d-flex flex-column align-items-center justify-content-center"><h5 className="m-0 fw-bold">{user.reviewCount ? user.rating.toFixed(1) : '—'}</h5><small className="m-0 text-secondary">Ratings</small></div></div>
    </div>
    {user.bio ? <p className="m-0">{user.bio}</p> : <p className="m-0 text-secondary">No bio yet</p>}
    <div className="text-muted"><svg className="bi bi-sm align-middle"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-geo-alt`} /></svg>{' '}<small>{user.location ? `${user.location}. ` : ''}Member since {joined}</small></div>
  </div>
  <div className="row mt-3 g-1 align-items-center justify-content-center">
    <div className="col-7">{own ? <button className="btn fw-bold w-100 custom-button btn-warning" onClick={() => setEditing(true)}>Edit profile</button> : <Link to={`/messages/chat?with=${user.id}`} className="btn fw-bold w-100 custom-button btn-warning">Send a message</Link>}</div>
    <div className="col-2"><button className="btn fw-bold rounded-5 d-flex align-items-center justify-content-center" style={{width:'40px',height:'40px'}} onClick={share} aria-label="Share profile"><svg className="bi bi-md align-middle text-warning"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-share`} /></svg></button></div>
    {embedded && own && <div className="col-2"><button className="btn fw-bold rounded-5 d-flex align-items-center justify-content-center" style={{width:'40px',height:'40px'}} onClick={doLogout} aria-label="Log out" title="Log out"><svg className="bi bi-md align-middle text-warning"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-box-arrow-right`} /></svg></button></div>}
  </div>
  {shareMsg && <div className="text-center"><small className="text-secondary">{shareMsg}</small></div>}
  {own && <VerificationPanel actor={actor} accountName={user.name} onChange={load} />}
  {ai && (
    <div className="bg-warning bg-opacity-10 p-2 mt-3 rounded-4">
      <div className="d-flex justify-content-between rounded-3"><small className="text-secondary m-0 fw-bold">Active transaction</small><p className="badge rounded-pill text-warning bg-warning bg-opacity-25 align-middle">{STATUS_LABEL[ai.tx.transactionStatus] || ai.tx.transactionStatus}</p></div>
      <div className="d-flex flex-column"><h5 className="text-black m-0">{activeTitle}</h5><p className="text-dark-emphasis">{activeWith}</p><Progress status={ai.tx.transactionStatus} /></div>
    </div>
  )}
  <ul className="nav nav-tabs w-100" style={{'--bs-nav-tabs-link-active-bg':'none','--bs-nav-tabs-link-active-color':'orange','--bs-nav-tabs-link-color':'black'}}><div className="d-flex justify-content-around align-items-center w-100">
    {[['requests', 'Requests'], ['trips', 'Trips'], ['reviews', 'Reviews']].map(([k, label]) => (
      <li className="nav-item fw-bold" key={k}><button className={`nav-link ${tab === k ? 'active' : ''}`} type="button" onClick={() => setTab(k)}>{label}</button></li>
    ))}
  </div></ul>
</div>
<div className="tab-content">
  {tab === 'requests' && (data.requests.length === 0 ? <Empty text="No requests yet." /> : data.requests.map((p) => { const [c, l] = POST_BADGE[p.status] || ['secondary', p.status]; return (
    <TabCard key={p.id}>
      <div className="d-flex justify-content-between align-items-center"><h5 className="fw-bold text-black">{p.title}</h5><span className={`badge rounded-pill bg-${c} bg-opacity-25 text-${c}`}>{l}</span></div>
      <div className="text-dark-emphasis">{p.origin} to {p.destination}. Budget {peso(p.budget)}</div>
      <div className="text-dark-emphasis">{p.offerCount} offer{p.offerCount === 1 ? '' : 's'} so far</div>
    </TabCard>) }))}
  {tab === 'trips' && (data.trips.length === 0 ? <Empty text="No trips yet." /> : data.trips.map((p) => { const [c, l] = POST_BADGE[p.status] || ['secondary', p.status]; return (
    <TabCard key={p.id}>
      <div className="d-flex justify-content-between align-items-center"><h5 className="fw-bold text-black">{p.origin} to {p.destination}</h5><span className={`badge rounded-pill bg-${c} bg-opacity-25 text-${c}`}>{l}</span></div>
      <div className="text-dark-emphasis">{fmtDate(p.travelDate)}. Service fee {peso(p.serviceFee)}</div>
      <div className="text-dark-emphasis">{p.spaceLeft} item{p.spaceLeft === 1 ? '' : 's'} space left</div>
    </TabCard>) }))}
  {tab === 'reviews' && (data.reviews.length === 0 ? <Empty text="No reviews yet." /> : data.reviews.map((r) => (
    <TabCard key={r.id}>
      <div className="d-flex flex-column gap-3"><div className="d-flex flex-row gap-3">
        <div className="bg-primary rounded-circle d-flex flex-shrink-0 align-items-center justify-content-center" style={{width:'45px',height:'45px',objectFit:'cover'}}><h3 className="text-light m-0">{initial(r.reviewer?.username)}</h3></div>
        <div className="name d-flex gap-0 flex-column">
          <div className="text-black fw-bold">{r.reviewer?.username || 'deleted user'}{' '}<div className="badge rounded-pill bg-warning bg-opacity-25 text-warning">{r.rating.toFixed(1)} Ratings</div></div>
          <div className="text-dark-emphasis">{r.reviewer?.location ? `${r.reviewer.location}. ` : ''}Member since {memberSince(r.reviewer?.createdAt)}</div>
        </div>
      </div></div>
      {r.comment && <div className="text-black mt-2"><span className="text-success">Feedback:</span> {r.comment}</div>}
    </TabCard>)))}
</div>
{!embedded && (<>
<div className="p-3 offcanvas offcanvas-bottom d-lg-none bg-white rounded-top-4" tabIndex="-1" id="CartCanvas" style={{backdropFilter:'blur(6px)'}}>
  <div className="d-flex flex-column">
    <div className="d-flex justify-content-between"><h5 className="text-black">Active transaction{ai && <>{' '}<span className="badge rounded-pill text-warning bg-warning bg-opacity-25 align-middle">{STATUS_LABEL[ai.tx.transactionStatus] || ai.tx.transactionStatus}</span></>}</h5><button className="btn btn-close" type="button" data-bs-dismiss="offcanvas"></button></div>
    {ai ? (<><h5 className="text-black">{activeTitle}</h5><p className="text-dark-emphasis">{activeWith}</p></>) : <p className="text-dark-emphasis">No active transaction right now.</p>}
  </div>
  {ai && <div className="offcanvas-body"><Progress status={ai.tx.transactionStatus} /></div>}
</div>
<nav className="navbar navbar-expand-lg bg-white sticky-bottom d-lg-none py-0" style={{borderTop:'2px solid rgba(128, 128, 128, 0.13)'}}>{' '}<div className="container">{' '}<ul className="navbar-nav w-100"><div className="d-flex justify-content-around align-items-center">{' '}<li className="nav-item">{' '}<Link to="/" className="nav-link text-secondary d-flex flex-column justify-content-center align-items-center">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-house-door`} />{' '}</svg>{' '}<span><small>Home</small></span>{' '}</Link>{' '}</li>{' '}<li className="nav-item">{' '}<a href="#search" className="nav-link text-secondary d-flex flex-column justify-content-center align-items-center" data-bs-target="#SearchCanvas" data-bs-toggle="offcanvas">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-search`} />{' '}</svg>{' '}<span><small>Search</small></span>{' '}</a>{' '}</li>{' '}<li className="nav-item d-flex align-items-center justify-content-center bg-warning-subtle rounded-4" style={{width:'50px',height:'50px'}}>{' '}<button type="button" onClick={openComposer} aria-label="New post" className="nav-link text-warning d-flex flex-column justify-content-center align-items-center">{' '}<svg className="bi bi-lg align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-plus-square`} />{' '}</svg>{' '}</button>{' '}</li>{' '}<li className="nav-item">{' '}<Link to="/messages" className="nav-link text-secondary d-flex flex-column justify-content-center align-items-center position-relative" aria-label="Messages">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-chat`} />{' '}</svg><UnreadBadge kind="messages" />{' '}<span><small>Messages</small></span>{' '}</Link>{' '}</li>{' '}<li className="nav-item">{' '}<Link to="/profile" className="nav-link text-secondary d-flex flex-column justify-content-center align-items-center" type="button">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-person-circle`} />{' '}</svg>{' '}<span><small>Profile</small></span>{' '}</Link>{' '}</li>{' '}</div></ul>{' '}</div>{' '}</nav>
</>)}
{own && editing && <EditProfile user={user} actor={actor} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />}
    </>
  )
}

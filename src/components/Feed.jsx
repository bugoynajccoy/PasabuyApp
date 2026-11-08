import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { postService, offerService, messageService, engageService, userService } from '../services/index.js'
import useLive from '../hooks/useLive.js'
import CommentsSheet from './CommentsSheet.jsx'
import useActor from '../hooks/useActor.js'
import { useComposer } from './PostComposer.jsx'
import { useSearch } from './SearchSheet.jsx'
import { peso, initial, fmtDate, timeAgo, POSTS_CHANGED, notifyPostsChanged } from '../utils/format.js'

const border = { borderBottom: '2px solid rgba(128, 128, 128, 0.13)' }
const Icon = ({ id, cls = 'bi-sm' }) => <svg className={`bi ${cls} align-middle`}><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#${id}`} /></svg>
const Avatar = ({ user }) => <div className="bg-primary text-light fw-bold fs-4 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 overflow-hidden" style={{ width: 45, height: 45 }}>{user?.avatar ? <img src={user.avatar} alt="" className="w-100 h-100" style={{ objectFit: 'cover' }} /> : initial(user?.username)}</div>

function OfferForm({ post, actor, onDone }) {
  const [price, setPrice] = useState(''); const [message, setMessage] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const send = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await offerService.create(actor, { postId: post.id, proposedPrice: price, message }); if (message.trim()) { try { await messageService.send(actor, post.userId, message, post.id) } catch { /* offer already sent */ } } notifyPostsChanged(); onDone(true) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={send} className="border rounded-3 p-2 mt-2 bg-light" noValidate>
      <label className="form-label mb-1 fw-semibold">Your service fee (₱)</label>
      <input className="form-control mb-2" type="number" min="0" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
      <label className="form-label mb-1 fw-semibold">Message (optional)</label>
      <textarea className="form-control mb-2" rows={2} maxLength={300} placeholder="When are you going? Where can you pick it up?" value={message} onChange={(e) => setMessage(e.target.value)} />
      {err && <div className="alert alert-danger py-1 mb-2">{err}</div>}
      <div className="d-flex gap-2"><button type="button" className="btn btn-outline-secondary" onClick={() => onDone(false)}>Cancel</button><button className="btn btn-warning fw-bold flex-grow-1" disabled={busy}>{busy ? 'Sending…' : 'Send offer'}</button></div>
    </form>
  )
}

function PostCard({ post, actor, me, stat, onRemoved }) {
  const mine = post.userId === actor
  const [offering, setOffering] = useState(false); const [sent, setSent] = useState(false); const [err, setErr] = useState('')
  const req = post.type === 'request'
  const [like, setLike] = useState({ liked: !!stat?.liked, likes: stat?.likes || 0 }); const [showComments, setShowComments] = useState(false); const [pop, setPop] = useState(false)
  useEffect(() => { setLike({ liked: !!stat?.liked, likes: stat?.likes || 0 }) }, [stat?.liked, stat?.likes])
  const toggleLike = async (only = null) => { // only === 'like' never un-likes (double-tap)
    if (only === 'like' && like.liked) return
    const prev = like; setLike({ liked: !prev.liked, likes: prev.likes + (prev.liked ? -1 : 1) }); setErr('')
    try { const r = await engageService.toggleLike(actor, 'post', post.id); setLike(r) } catch (x) { setLike(prev); setErr(x.message) }
  }
  const doubleTap = () => { toggleLike('like'); setPop(true); setTimeout(() => setPop(false), 700) }
  const remove = async () => {
    if (!window.confirm('Delete this post?')) return
    try { await postService.remove(post.id, actor); notifyPostsChanged(); onRemoved?.() } catch (x) { setErr(x.message) }
  }
  return (
    <div className="container-fluid my-4 pb-3" style={border}>
      <div className="card h-100 border-0">
        <div className="card-header border-0 bg-white d-flex flex-row gap-3 align-items-center">
          <Link to={mine ? '/profile' : `/profile?user=${post.userId}`} aria-label={`View ${post.author?.username || 'user'} profile`} className="text-decoration-none flex-shrink-0"><Avatar user={post.author} /></Link>
          <div className="name d-flex flex-column flex-grow-1">
            <div className="text-black fw-bold"><Link to={mine ? '/profile' : `/profile?user=${post.userId}`} className="text-black text-decoration-none">{post.author?.username || 'unknown'}</Link>{post.author?.verified && <span className="ms-1 text-primary"><Icon id="bi-patch-check" /></span>}</div>
            <div className="text-dark">{req ? 'Requester' : 'Traveler'}.{req ? post.destination : post.origin} <span className="text-secondary">· {timeAgo(post.createdAt)}</span></div>
          </div>
          {mine && <button className="btn btn-sm btn-outline-danger" onClick={remove}>Delete</button>}
        </div>

        {req ? (<>
          {post.image && <div className="card position-relative rounded-3 my-1 text-dark" onDoubleClick={doubleTap}><img src={post.image} alt={post.title} className="card-img-top" style={{ maxHeight: 420, objectFit: 'cover' }} />{pop && <span className="position-absolute top-50 start-50 translate-middle text-white" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.5))', pointerEvents: 'none' }}><svg className="bi align-middle" style={{ width: 90, height: 90 }}><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-heart-fill`} /></svg></span>}</div>}
          <div className="w-100 card p-2 rounded-3 my-1 text-dark">
            <h5 className="fw-bold mb-1">{post.title}{post.quantity > 1 && <span className="text-secondary fw-normal"> ×{post.quantity}</span>}</h5>
            <span className="text-secondary">{post.origin} <span>⟼</span> {post.destination}</span>
            <div className="d-flex gap-2 mt-2 flex-wrap">
              <span className="badge rounded-pill bg-dark bg-opacity-50 text-light"><Icon id="bi-clock" /> Needed by {fmtDate(post.neededDate)}</span>
              <span className="badge rounded-pill bg-success bg-opacity-25 text-success">Budget {peso(post.budget)}</span>
            </div>
          </div>
        </>) : (
          <div className="w-100 card p-2 rounded-3 py-3 my-1 text-dark">
            {post.image && <img src={post.image} alt={post.title} className="card-img-top rounded-3 mb-2" style={{ maxHeight: 360, objectFit: 'cover' }} />}
            <div className="card-header p-0 py-2 bg-white w-100">
              <h5 className="fw-bold">{post.origin} <span className="text-secondary">⟼</span> {post.destination}</h5>
              <span className="badge rounded-pill bg-warning bg-opacity-25 text-warning"><Icon id="bi-clock" /> Leaves {fmtDate(post.travelDate)}</span>
            </div>
            <div className="d-flex w-100 justify-content-around mt-2">
              <div className="d-flex flex-column"><small className="text-muted fw-medium">Service fee</small><p className="fw-bold m-0">from {peso(post.serviceFee)}</p></div>
              <div className="d-flex flex-column px-2" style={{ borderLeft: '1px solid rgba(128,128,128,.5)' }}><small className="text-muted fw-medium">Space left</small><p className="fw-bold m-0">{post.spaceLeft} item{post.spaceLeft === 1 ? '' : 's'}</p></div>
              <div className="d-flex flex-column px-2" style={{ borderLeft: '1px solid rgba(128,128,128,.5)' }}><small className="text-muted fw-medium">Returns</small><p className="fw-bold m-0">{post.returnDate ? fmtDate(post.returnDate) : '—'}</p></div>
            </div>
          </div>
        )}

        <div className="d-flex align-items-center gap-3 mt-2 px-1">
          <button type="button" className={`btn p-0 border-0 ${like.liked ? 'text-danger' : 'text-black'}`} aria-pressed={like.liked} aria-label={like.liked ? 'Unlike' : 'Like'} onClick={() => toggleLike()}><Icon id={like.liked ? 'bi-heart-fill' : 'bi-heart'} cls="bi-md" /></button>
          <button type="button" className="btn p-0 border-0 text-black" aria-label="Comments" onClick={() => setShowComments(true)}><Icon id="bi-chat" cls="bi-md" /></button>
          {!mine && <Link to={`/messages/chat?with=${post.userId}&post=${post.id}`} className="text-black" aria-label={`Message ${post.author?.username || 'author'}`}><Icon id="bi-send" cls="bi-md" /></Link>}
        </div>
        {like.likes > 0 && <div className="fw-bold text-black px-1 mt-1">{like.likes} like{like.likes === 1 ? '' : 's'}</div>}
        {post.description && <div className="d-flex text-black bg-white mt-1 px-1"><p className="m-0"><span className="fw-bold">{post.author?.username}</span> {post.description}</p></div>}
        <div className="px-1 mb-1">{stat?.comments > 0 ? <button type="button" className="btn btn-link p-0 text-secondary text-decoration-none" onClick={() => setShowComments(true)}>View {stat.comments === 1 ? '1 comment' : `all ${stat.comments} comments`}</button> : <button type="button" className="btn btn-link p-0 text-secondary text-decoration-none" onClick={() => setShowComments(true)}>Add a comment…</button>}</div>
        {showComments && <CommentsSheet post={post} actor={actor} me={me} onClose={() => setShowComments(false)} />}

        <div className="p-2">
          <div className="rounded-3 px-3 py-2 d-flex bg-success-subtle align-items-center gap-3">
            <Icon id="bi-shield-check" cls="bi-md text-success" />
            <div className="d-flex flex-column">
              <p className="text-success fw-bold m-0">{req ? 'Payment protected' : post.author?.verified ? 'ID verified' : 'Payments stay in Pasabuy'}</p>
              <small className="text-success m-0">{req ? 'Held safely until you confirm the item arrived.' : 'Chat and pay inside Pasabuy so the deal is protected.'}</small>
            </div>
          </div>
        </div>

        <div className="d-flex flex-column bg-white">
          {req && <p className="text-secondary mb-1">{post.offerCount} offer{post.offerCount === 1 ? '' : 's'} so far</p>}
          {err && <div className="alert alert-danger py-1">{err}</div>}
          {sent && <div className="alert alert-success py-1 mb-1">Offer sent! The requester has been notified.</div>}
          {!mine && req && !offering && !sent && <button className="btn btn-warning fw-bold" onClick={() => setOffering(true)}>Offer to deliver</button>}
          {!mine && req && offering && <OfferForm post={post} actor={actor} onDone={(ok) => { setOffering(false); if (ok) setSent(true) }} />}
          {!mine && !req && <Link to={`/messages/chat?with=${post.userId}&post=${post.id}`} className="btn btn-primary fw-bold">Send a message</Link>}
          {!mine && req && <Link to={`/messages/chat?with=${post.userId}&post=${post.id}`} className="btn btn-outline-secondary mt-1">Send a message</Link>}
          {mine && <small className="text-secondary">This is your {req ? 'request' : 'trip'}.</small>}
        </div>
      </div>
    </div>
  )
}

export default function Feed() {
  const actor = useActor(); const { openComposer } = useComposer(); const { query: q, setQuery } = useSearch()
  const [posts, setPosts] = useState(null); const [stats, setStats] = useState({}); const [me, setMe] = useState(null); const [type, setType] = useState(''); const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { const list = await postService.getAll({ type, q }); setPosts(list); setStats(await engageService.getStats(list.map((p) => p.id), actor)); setError('') } catch (e) { setError(e.message) }
  }, [type, q, actor])
  useEffect(() => { load() }, [load]); useLive(load, { poll: 0 }) // new likes/comments from anyone show up without a reload
  useEffect(() => { if (actor) userService.getById(actor).then(setMe).catch(() => setMe(null)) }, [actor])
  useEffect(() => { window.addEventListener(POSTS_CHANGED, load); window.addEventListener('storage', load); return () => { window.removeEventListener(POSTS_CHANGED, load); window.removeEventListener('storage', load) } }, [load])

  const chip = (v, label) => <button key={label} type="button" onClick={() => setType(v)} className={`btn btn-sm rounded-3 ${type === v ? 'btn-dark' : 'btn-outline-dark'}`}>{label}</button>
  return (
    <>
      <div className="container-fluid pb-2" style={border}>
        <div className="d-flex gap-2 flex-wrap">{chip('', 'All')}{chip('request', 'Requests')}{chip('trip', 'Trips')}</div>
      </div>
      {q && (
        <div className="container-fluid py-2 d-flex justify-content-between align-items-center" style={border}>
          <span className="text-secondary">Results for <b className="text-black">“{q}”</b>{posts ? ` · ${posts.length}` : ''}</span>
          <button className="btn btn-sm btn-outline-dark rounded-4" onClick={() => setQuery('')}>Clear search</button>
        </div>
      )}
      {error && <div className="alert alert-danger m-3">{error}</div>}
      {posts === null && !error && <p className="text-center text-secondary my-5">Loading feed…</p>}
      {posts?.length === 0 && (
        <div className="text-center my-5 px-3">
          <h5 className="fw-bold">{q || type ? 'No posts match your search' : 'Nothing here yet'}</h5>
          <p className="text-secondary">{q || type ? 'Try a different search or filter.' : 'Be the first to post a request or a trip.'}</p>
          <button className="btn btn-warning fw-bold" onClick={openComposer}>Create a post</button>
        </div>
      )}
      {posts?.map((p) => <PostCard key={p.id} post={p} actor={actor} me={me} stat={stats[p.id]} />)}
    </>
  )
}

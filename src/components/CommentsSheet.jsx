import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { engageService, MAX_COMMENT } from '../services/index.js'
import useLive from '../hooks/useLive.js'
import { initial, timeAgo } from '../utils/format.js'

const Icon = ({ id, cls = 'bi-sm' }) => <svg className={`bi ${cls} align-middle`} aria-hidden="true"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#${id}`} /></svg>
const Face = ({ user, size = 36 }) => <div className="bg-primary text-light fw-bold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 overflow-hidden" style={{ width: size, height: size }}>{user?.avatar ? <img src={user.avatar} alt="" className="w-100 h-100" style={{ objectFit: 'cover' }} /> : initial(user?.username)}</div>

function Row({ c, actor, postOwner, small, onReply, onLike, onDelete, children }) {
  const canDelete = c.userId === actor || postOwner === actor
  return (
    <div className="d-flex gap-2 py-2">
      <Face user={c.author} size={small ? 28 : 36} />
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}><Link to={c.userId === actor ? '/profile' : `/profile?user=${c.userId}`} data-close className="fw-bold text-black text-decoration-none">{c.author?.username || 'unknown'}</Link>{c.author?.verified && <span className="ms-1 text-primary"><Icon id="bi-patch-check" /></span>} {c.content}</div>
        <div className="d-flex gap-3 small text-secondary fw-bold">
          <span className="fw-normal">{timeAgo(c.createdAt)}</span>
          {c.likes > 0 && <span>{c.likes} like{c.likes === 1 ? '' : 's'}</span>}
          <button type="button" className="btn btn-link p-0 small text-secondary fw-bold text-decoration-none" onClick={() => onReply(c)}>Reply</button>
          {canDelete && <button type="button" className="btn btn-link p-0 small text-secondary fw-bold text-decoration-none" onClick={() => onDelete(c)}>Delete</button>}
        </div>
        {children}
      </div>
      <button type="button" className={`btn p-0 align-self-start border-0 ${c.liked ? 'text-danger' : 'text-secondary'}`} aria-pressed={c.liked} aria-label={c.liked ? 'Unlike comment' : 'Like comment'} onClick={() => onLike(c)}><Icon id={c.liked ? 'bi-heart-fill' : 'bi-heart'} /></button>
    </div>
  )
}

// Instagram-style comments: bottom sheet on phones, centered card on larger screens.
export default function CommentsSheet({ post, actor, me, onClose, onChanged }) {
  const [list, setList] = useState(null); const [text, setText] = useState(''); const [reply, setReply] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [open, setOpen] = useState({})
  const inputRef = useRef(null)
  const load = useCallback(async () => { try { setList(await engageService.getComments(post.id, actor)) } catch (e) { setErr(e.message) } }, [post.id, actor])
  useEffect(() => { load() }, [load]); useLive(load, { poll: 0 })
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev } }, [onClose])
  const guard = async (fn) => { setErr(''); try { await fn(); await load(); onChanged?.() } catch (e) { setErr(e.message) } }
  const startReply = (c) => { setReply(c); setText(`@${c.author?.username || ''} `); inputRef.current?.focus() }
  const send = async (e) => {
    e.preventDefault(); if (!text.trim() || busy) return; setBusy(true)
    await guard(async () => { const c = await engageService.addComment(actor, post.id, text, reply?.id || null); if (reply) setOpen((o) => ({ ...o, [reply.parentId || reply.id]: true })); setText(''); setReply(null); return c }); setBusy(false)
  }
  const remove = (c) => window.confirm(c.parentId ? 'Delete this reply?' : 'Delete this comment and its replies?') && guard(() => engageService.deleteComment(actor, c.id))
  const total = list ? list.reduce((n, c) => n + 1 + c.replies.length, 0) : 0
  const caption = post.description || (post.type === 'request' ? post.title : `${post.origin} to ${post.destination}`)
  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-end align-items-md-center justify-content-center" style={{ zIndex: 2000, background: 'rgba(0,0,0,.45)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()} onClick={(e) => e.target.closest?.('[data-close]') && onClose()} role="dialog" aria-modal="true" aria-label="Comments">
      <div className="bg-white rounded-top-4 rounded-bottom-md-4 w-100 d-flex flex-column" style={{ maxWidth: 520, height: '75vh', maxHeight: 700 }}>
        <div className="d-flex justify-content-between align-items-center px-3 py-2" style={{ borderBottom: '1px solid rgba(128, 128, 128, 0.13)' }}>
          <h5 className="fw-bold m-0 text-black">Comments<span className="text-warning">.</span></h5>
          <button type="button" className="btn btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="flex-grow-1 overflow-auto px-3">
          <div className="d-flex gap-2 py-2" style={{ borderBottom: '1px solid rgba(128, 128, 128, 0.13)' }}>
            <Face user={post.author} /><div style={{ overflowWrap: 'anywhere' }}><span className="fw-bold text-black">{post.author?.username}</span> {caption}<div className="small text-secondary">{timeAgo(post.createdAt)}</div></div>
          </div>
          {list === null && !err && <p className="text-center text-secondary my-4">Loading…</p>}
          {list?.length === 0 && <div className="text-center my-5"><h6 className="fw-bold mb-1">No comments yet</h6><small className="text-secondary">Start the conversation.</small></div>}
          {list?.map((c) => (
            <Row key={c.id} c={c} actor={actor} postOwner={post.userId} onReply={startReply} onLike={(x) => guard(() => engageService.toggleLike(actor, 'comment', x.id))} onDelete={remove}>
              {c.replies.length > 0 && (
                <div className="mt-1">
                  <button type="button" className="btn btn-link p-0 small text-secondary text-decoration-none" onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}>{open[c.id] ? 'Hide replies' : `View ${c.replies.length} repl${c.replies.length === 1 ? 'y' : 'ies'}`}</button>
                  {open[c.id] && c.replies.map((r) => <Row key={r.id} c={r} small actor={actor} postOwner={post.userId} onReply={startReply} onLike={(x) => guard(() => engageService.toggleLike(actor, 'comment', x.id))} onDelete={remove} />)}
                </div>
              )}
            </Row>
          ))}
        </div>
        <form onSubmit={send} className="px-3 py-2" style={{ borderTop: '1px solid rgba(128, 128, 128, 0.13)' }} noValidate>
          {reply && <div className="d-flex justify-content-between small text-secondary mb-1"><span>Replying to <b>{reply.author?.username}</b></span><button type="button" className="btn btn-link p-0 small text-secondary text-decoration-none" onClick={() => { setReply(null); setText('') }}>Cancel</button></div>}
          {err && <small className="text-danger d-block mb-1">{err}</small>}
          <div className="d-flex align-items-center gap-2">
            <Face user={me} size={32} />
            <input ref={inputRef} className="form-control rounded-5" placeholder="Add a comment…" aria-label="Add a comment" value={text} maxLength={MAX_COMMENT} onChange={(e) => setText(e.target.value)} />
            <button className="btn btn-link fw-bold text-warning text-decoration-none p-0" disabled={!text.trim() || busy}>Post</button>
          </div>
        </form>
      </div>
    </div>
  )
}

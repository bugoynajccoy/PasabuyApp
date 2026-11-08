import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { messageService, conversationId, transactionService, paymentService, userService, postService, reportService, PAY_METHODS, AUTO_RELEASE_HOURS } from '../../services/index.js'
import useActor from '../../hooks/useActor.js'
import useLive from '../../hooks/useLive.js'
import { usePresence } from '../../hooks/usePresence.js'
import { Avatar } from '../../components/MessageList.jsx'
import { peso } from '../../utils/format.js'

const TX_LABEL = { pending: 'Awaiting approval', approved: 'Approved', paid: 'Payment held', in_transit: 'In transit', delivered: 'Delivered', completed: 'Completed', cancelled: 'Declined', disputed: 'Disputed' }
const when = (v) => (v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const PAY_LABEL = { held: 'Held', disputed: 'Held (disputed)', released: 'Released', refunded: 'Refunded' }
const REASONS = [['scam', 'Scam or fake item'], ['pay', 'Asked to pay outside Pasabuy'], ['rude', 'Rude or harassing messages'], ['noshow', "Didn't show up"]]

// Buttons that make sense for this person on this form right now.
function formActions(t, actor) {
  const requester = actor === t.requesterId; const creator = actor === t.history[0]?.by; const s = t.transactionStatus
  if (s === 'pending') return creator ? { note: 'Waiting for the other person to approve.', buttons: [['cancel', 'Cancel form', 'btn-outline-dark']] } : { buttons: [['approve', 'Approve', 'btn-warning'], ['cancel', 'Decline', 'btn-danger']] }
  if (s === 'approved') return requester ? { note: 'Simulated payment: no real money moves.', buttons: [['pay', 'Pay', 'btn-warning'], ['cancel', 'Decline', 'btn-danger']] } : { note: 'Waiting for the requester to pay.', buttons: [['cancel', 'Cancel form', 'btn-outline-dark']] }
  if (s === 'paid') return requester ? { note: 'Payment is held until you confirm receipt.', buttons: [], canDispute: true } : { note: "The requester's payment is held. Start delivery to continue.", buttons: [['ship', 'Start delivery', 'btn-warning']], canDispute: true }
  if (s === 'in_transit') return requester ? { note: 'The traveler is on the way. Your payment stays held.', buttons: [], canDispute: true } : { buttons: [['deliver', 'Mark as delivered', 'btn-warning']], canDispute: true }
  if (s === 'delivered') return requester ? { note: `Confirm receipt to release the payment. It releases by itself ${AUTO_RELEASE_HOURS} hours after delivery.`, buttons: [['confirm', 'Confirm receipt', 'btn-warning']], canDispute: true } : { note: 'Waiting for the requester to confirm. Payment releases to you after confirmation.', buttons: [], canDispute: true }
  if (s === 'disputed') return { note: 'Payment stays held while an admin reviews this dispute.', buttons: [] }
  return { buttons: [] }
}

function PaymentPanel({ pay, t, actor }) {
  if (!pay) return null
  const requester = actor === t.requesterId
  const due = pay.status === 'held' && pay.autoReleaseAt ? when(pay.autoReleaseAt) : ''
  const msg = { held: requester ? 'Held safely. The traveler is paid only after you confirm receipt.' : 'Held safely for you. It is released after the requester confirms receipt.', disputed: 'On hold while an admin reviews the dispute.', released: requester ? 'Released to the traveler.' : 'Released to you.', refunded: requester ? 'Refunded to you.' : 'Refunded to the requester.' }[pay.status]
  const tone = pay.status === 'released' ? 'success' : pay.status === 'refunded' ? 'secondary' : 'warning'
  return (
    <div className="bg-warning bg-opacity-10 rounded-3 p-2 mb-2">
      <div className="d-flex justify-content-between align-items-center"><small className="fw-bold text-secondary">Payment (simulated)</small><span className={`badge rounded-pill bg-${tone} bg-opacity-25 text-${tone}`}>{PAY_LABEL[pay.status]}</span></div>
      <div className="fw-bold text-black">{peso(pay.amount)} <small className="fw-normal text-secondary">via {pay.method}</small></div>
      <small className="text-dark-emphasis d-block">{msg}</small>
      {due && <small className="text-secondary d-block">Auto-release: {due}</small>}
      <small className="text-secondary d-block">Ref {pay.reference}. Held {when(pay.heldAt)}.</small>
    </div>
  )
}

function PayStep({ t, other, busy, onBack, onConfirm }) {
  const [method, setMethod] = useState(PAY_METHODS[0]); const [ok, setOk] = useState(false)
  return (
    <div className="border rounded-3 p-2 mb-2">
      <h6 className="fw-bold mb-2">Pay and hold</h6>
      <div className="d-flex justify-content-between"><small className="text-secondary">Item</small><small className="text-black">{t.itemDetails}{t.quantity > 1 ? ` ×${t.quantity}` : ''}</small></div>
      <div className="d-flex justify-content-between"><small className="text-secondary">Traveler</small><small className="text-black">{other?.username || 'Traveler'}</small></div>
      <div className="d-flex justify-content-between mb-2"><small className="text-secondary">Amount to hold</small><small className="text-black fw-bold">{peso(t.agreedPrice)}</small></div>
      <p className="fw-bold mb-1 small">Pay with</p>
      {PAY_METHODS.map((m, i) => <div className="form-check mb-1" key={m}><input className="form-check-input" type="radio" name={`method-${t.id}`} id={`m-${t.id}-${i}`} checked={method === m} onChange={() => setMethod(m)} /><label className="form-check-label" htmlFor={`m-${t.id}-${i}`}>{m}</label></div>)}
      <div className="form-check my-2"><input className="form-check-input" type="checkbox" id={`c-${t.id}`} checked={ok} onChange={(e) => setOk(e.target.checked)} /><label className="form-check-label small" htmlFor={`c-${t.id}`}>I understand the payment is held and only released to the traveler after I confirm receipt (or {AUTO_RELEASE_HOURS} hours after delivery).</label></div>
      <small className="text-secondary d-block mb-2">Demo only: no real money moves and no payment account is charged.</small>
      <div className="row g-2">
        <div className="col-6"><button type="button" className="btn btn-outline-dark w-100" disabled={busy} onClick={onBack}>Back</button></div>
        <div className="col-6"><button type="button" className="btn btn-warning w-100 fw-bold" disabled={busy || !ok} onClick={() => onConfirm(method)}>Hold {peso(t.agreedPrice)}</button></div>
      </div>
    </div>
  )
}

function TxCard({ t, actor, post, other, onChanged }) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [paying, setPaying] = useState(false); const [pay, setPay] = useState(null)
  const { buttons, note, canDispute } = formActions(t, actor)
  useEffect(() => { let live = true; paymentService.getByTransaction(t.id, actor).then((p) => live && setPay(p)).catch(() => live && setPay(null)); return () => { live = false } }, [t.id, t.transactionStatus, t.paymentStatus, actor])
  const run = async (action, opts) => { setErr(''); setBusy(true); try { await transactionService.act(t.id, actor, action, opts); setPaying(false); onChanged() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const dispute = () => window.confirm('Open a dispute? The payment stays held and an admin will decide whether to release or refund it.') && run('dispute')
  const click = (a) => (a === 'pay' ? setPaying(true) : run(a))
  return (
    <div className="card w-100 my-2">
      <div className="card-body">
        <div className="d-flex justify-content-between">
          <h6 className="fw-bold">Transaction form</h6>
          <span className="badge rounded-pill bg-warning bg-opacity-25 text-warning align-middle">{TX_LABEL[t.transactionStatus] || t.transactionStatus}</span>
        </div>
        <div className="d-flex flex-column">
          <div className="gap-5 d-flex"><p className="text-secondary w-25">item</p><span className="text-black">{t.itemDetails}{t.quantity > 1 ? ` ×${t.quantity}` : ''}</span></div>
          <div className="gap-5 d-flex"><p className="text-secondary w-25">Pickup</p><span className="text-black">{t.pickup || post?.origin || '—'}</span></div>
          <div className="gap-5 d-flex"><p className="text-secondary w-25">Deliver</p><span className="text-black">{t.deliverTo || post?.destination || '—'}{t.deliverAt ? `, ${when(t.deliverAt)}` : ''}</span></div>
          <div className="gap-5 d-flex"><p className="text-secondary w-25">Price</p><span className="text-black fw-bold">{peso(t.agreedPrice)}</span></div>
          {t.notes && <div className="gap-5 d-flex"><p className="text-secondary w-25">Notes</p><span className="text-black">{t.notes}</span></div>}
        </div>
        <PaymentPanel pay={pay} t={t} actor={actor} />
        {note && <small className="text-secondary d-block mb-2">{note}</small>}
        {err && <div className="alert alert-danger py-1 my-2">{err}</div>}
        {paying ? <PayStep t={t} other={other} busy={busy} onBack={() => setPaying(false)} onConfirm={(method) => run('pay', { method })} /> : buttons.length > 0 && (
          <div className="row g-2">
            {buttons.map(([a, label, cls]) => <div className={buttons.length > 1 ? 'col-6' : 'col-12'} key={a}><button className={`btn ${cls} w-100 fw-bold`} disabled={busy} onClick={() => click(a)}>{label}</button></div>)}
          </div>
        )}
        {canDispute && !paying && <button type="button" className="btn btn-link text-danger p-0 mt-2 small" disabled={busy} onClick={dispute}>Report a problem and open a dispute</button>}
      </div>
    </div>
  )
}

export default function Conversation() {
  const actor = useActor(); const nav = useNavigate(); const [params] = useSearchParams()
  const otherId = params.get('with'); const postParam = params.get('post')
  const convId = actor && otherId ? conversationId(actor, otherId) : null
  const [state, setState] = useState(null); const [text, setText] = useState(''); const [sendErr, setSendErr] = useState('')
  const [formErr, setFormErr] = useState(''); const [reportMsg, setReportMsg] = useState(''); const [optErr, setOptErr] = useState('')
  const endRef = useRef(null); const closeRef = useRef(null); const formRef = useRef(null)
  const presence = usePresence(otherId)

  const load = useCallback(async () => {
    if (!convId) return
    try {
      const [other, thread, txs, prefs, trips] = await Promise.all([userService.getById(otherId), messageService.getThread(actor, convId), transactionService.getBetween(actor, otherId), messageService.getPrefs(actor, convId), postService.getAll({ userId: otherId, type: 'trip' })])
      const postId = postParam || [...thread].reverse().find((m) => m.relatedId)?.relatedId
      let post = null; if (postId) { try { post = await postService.getById(postId) } catch { /* removed */ } }
      setState({ other, thread, txs: txs.filter((t) => t.transactionStatus !== 'cancelled'), prefs, post, isTraveler: trips.length > 0 })
    } catch (e) { setState({ error: e.message }) }
  }, [actor, otherId, convId, postParam])
  useEffect(() => { load() }, [load])
  useLive(load)
  const count = state?.thread?.length
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [count, state?.txs?.length])

  if (!otherId) return <Navigate to="/messages" replace />
  if (!state) return <div className="text-center text-secondary my-5">Loading chat…</div>
  if (state.error) return <div className="container text-center my-5"><p className="text-secondary">{state.error}</p><Link to="/messages" className="btn btn-warning fw-bold">Back to Messages</Link></div>
  const { other, thread, txs, prefs, post } = state
  const lastTx = txs.at(-1)
  const items = [...thread.map((m) => ({ k: 'm', at: m.createdAt, m })), ...txs.map((t) => ({ k: 't', at: t.createdAt, t }))].sort((a, b) => a.at.localeCompare(b.at))
  const sendable = !prefs.blocked

  const send = async () => {
    if (!text.trim() || !sendable) return
    setSendErr(''); const body = text
    try { setText(''); await messageService.send(actor, otherId, body, post?.id || null); load() } catch (e) { setText(body); setSendErr(e.message) }
  }
  const submitForm = async (e) => {
    e.preventDefault(); setFormErr(''); const f = Object.fromEntries(new FormData(e.currentTarget).entries())
    try {
      await transactionService.createFromForm(actor, { otherId, item: f.item, quantity: f.quantity, price: f.price, pickup: f.pickup, deliver: f.deliver, when: f.when, notes: f.notes, postId: post?.id || null })
      formRef.current?.reset(); closeRef.current?.click(); load()
    } catch (x) { setFormErr(x.message) }
  }
  const setPref = async (patch) => { await messageService.setPref(actor, convId, patch); load() }
  const report = async (e) => {
    e.preventDefault(); setOptErr(''); const f = new FormData(e.currentTarget); const reason = REASONS.find((r) => r[0] === f.get('reportReason'))?.[1]; const more = (f.get('reportDetails') || '').toString().trim()
    try { await reportService.create(actor, { targetId: otherId, targetType: 'user', reason: `${reason}${more ? `: ${more}` : ''}` }); e.currentTarget.reset(); setReportMsg('Report sent. Our team will review it.') } catch (x) { setOptErr(x.message) }
  }
  const block = async () => { setOptErr(''); try { await (prefs.blockedByMe ? messageService.unblock(actor, otherId) : messageService.block(actor, otherId)); if (!prefs.blockedByMe) { nav('/messages'); return } load() } catch (x) { setOptErr(x.message) } }
  const del = async () => { await messageService.clear(actor, convId); nav('/messages') }
  const role = state.isTraveler ? 'Traveler' : 'Requester'

  return (
    <>
<nav className="navbar navbar-expand-lg bg-white text-black sticky-top" style={{borderBottom:'2px solid rgba(128, 128, 128, 0.13)'}}>
  <div className="container">
    <div className="d-flex flex-row gap-2">
      <div className="d-flex align-items-center justify-content-center"><Link to="/messages" aria-label="Back"><svg className="bi bi-md align-middle text-secondary"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-arrow-left`} /></svg></Link></div>
      <Link to={`/profile?user=${other.id}`} aria-label={`View ${other.username} profile`} className="text-decoration-none flex-shrink-0"><Avatar user={other} /></Link>
      <div className="d-flex justify-content-between align-items-center w-100">
        <div className="d-flex flex-column">
          <p className="text-black fw-bold m-0"><Link to={`/profile?user=${other.id}`} className="text-black text-decoration-none">{other.username}</Link>{other.verified && <> <span className="badge rounded-pill bg-success bg-opacity-25 text-success">Verified</span></>}</p>
          <p className="m-0 text-secondary">{role}. {presence}</p>
        </div>
      </div>
    </div>
    <ul className="navbar-nav"><div className="d-flex flex-row"><li className="nav-item px-2">
      <a type="button" data-bs-target="#conversationSetting" data-bs-toggle="offcanvas" className="nav-link text-black" aria-label="Chat details"><svg className="bi bi-md align-middle"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-three-dots-vertical`} /></svg></a>
    </li></div></ul>
  </div>
</nav>
<div className="container-fluid p-0">
  <div className="container p-0 min-vh-100">
    <div className="p-2">
      {post && (
        <div className="bg-warning bg-opacity-10 rounded-3 p-2 my-2 d-flex justify-content-between gap-2">
          <small className="text-secondary fw-bold flex-shrink-0">About this post</small>
          <small className="text-black text-truncate">{post.type === 'request' ? post.title : `${post.origin} to ${post.destination}`}</small>
        </div>
      )}
      {items.length === 0 && <p className="text-center text-secondary my-5">No messages yet. Say hi to {other.username}.</p>}
      {items.map((it) => it.k === 't' ? <TxCard key={it.t.id} t={it.t} actor={actor} post={post} other={other} onChanged={load} /> : it.m.senderId === actor ? (
        <div key={it.m.id} className="d-flex flex-row gap-2 align-items-center my-2 justify-content-end">
          <div className="d-flex justify-content-between align-items-center bg-warning text-black bg-opacity-25 p-2 rounded-3" style={{maxWidth:'75%'}}><p className="m-0" style={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{it.m.content}</p></div>
        </div>
      ) : (
        <div key={it.m.id} className="d-flex flex-row gap-2 align-items-center my-2">
          <Avatar user={other} />
          <div className="d-flex justify-content-between align-items-center bg-secondary bg-opacity-10 p-2 rounded-3" style={{maxWidth:'75%'}}><p className="m-0" style={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{it.m.content}</p></div>
        </div>
      ))}
      {txs.length > 0 && <div className="d-flex align-items-center justify-content-center my-2"><small className="text-secondary text-center">Payment starts after both of you approve and is held until receipt is confirmed.</small></div>}
      <div ref={endRef} />
    </div>
  </div>
  <div className="offcanvas offcanvas-bottom rounded-top-4 h-75 px-2 py-2" tabIndex="-1" id="TransactionForm">
    <div className="offcanvas-header py-0">
      <div className="d-flex flex-row justify-content-between"><div className="d-flex flex-column"><h4 className="text-start">Create transaction form</h4><small className="text-secondary">Fill what you agreed on. Both of you must approve.</small></div></div>
      <button className="btn btn-close" data-bs-dismiss="offcanvas" ref={closeRef} aria-label="Close"></button>
    </div>
    <div className="offcanvas-body">
      <form ref={formRef} className="w-100" id="transactionForm" onSubmit={submitForm} noValidate>
        <div className="mb-1"><label htmlFor="tfItem" className="form-label text-start m-0">Item</label><input type="text" name="item" id="tfItem" className="form-control" placeholder="e.g. Chocolate cake, 8 inch" defaultValue={post?.type === 'request' ? post.title : ''} /></div>
        <div className="mb-1 d-flex gap-2">
          <div className="w-50"><label htmlFor="tfQty" className="form-label text-start m-0">Quantity</label><input type="number" name="quantity" id="tfQty" className="form-control" min="1" defaultValue="1" /></div>
          <div className="w-50"><div><label htmlFor="tfPrice" className="form-label text-start m-0">Price(₱)</label><input type="number" name="price" id="tfPrice" className="form-control" min="0" step="1" placeholder="900" defaultValue={post?.type === 'request' ? post.budget : ''} /></div></div>
        </div>
        <div className="mb-1"><label htmlFor="tfPickup" className="form-label text-start m-0">Pickup place</label><input type="text" name="pickup" id="tfPickup" className="form-control" placeholder="e.g. Goldilocks, Masbate City" defaultValue={post?.type === 'request' ? post.origin : ''} /></div>
        <div className="mb-1 d-flex gap-2 w-100">
          <div className="w-50"><label htmlFor="tfDeliver" className="form-label text-start m-0">Deliver to</label><input type="text" name="deliver" id="tfDeliver" className="form-control" placeholder="e.g. Dimasalang" defaultValue={post?.type === 'request' ? post.destination : ''} /></div>
          <div className="w-50"><div><label htmlFor="tfWhen" className="form-label text-start m-0">Date and time</label><input type="datetime-local" name="when" id="tfWhen" className="form-control" /></div></div>
        </div>
        <div className="mb-1"><label htmlFor="tfNotes" className="form-label text-start m-0">Notes (optional)</label><textarea name="notes" id="tfNotes" className="form-control" rows="2" placeholder='e.g. Write "Happy Birthday" on the cake'></textarea></div>
        <small className="text-secondary">Payment is held safely until you confirm receipt.</small>
        {formErr && <div className="alert alert-danger py-2 mt-2 mb-0" role="alert">{formErr}</div>}
      </form>
    </div>
    <div className="d-flex justify-content-center"><div><small className="text-success fw-bold">Only verified users can approve this form</small><button className="btn btn-warning w-100 mt-2" type="submit" form="transactionForm">Send for approval</button></div></div>
  </div>
  <div className="offcanvas offcanvas-end" tabIndex="-1" id="conversationSetting" aria-labelledby="conversationSettingLabel">
    <div className="offcanvas-header border-bottom"><h5 className="offcanvas-title fw-bold" id="conversationSettingLabel">Chat details</h5><button type="button" className="btn btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button></div>
    <div className="offcanvas-body p-0">
      <div className="d-flex flex-column align-items-center text-center p-3 pb-2">
        <Avatar user={other} size={70} cls="h2" />
        <h6 className="fw-bold m-0 mt-2">{other.username}</h6>
        {other.verified ? <div className="text-primary"><svg className="bi bi-sm align-middle"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-patch-check`} /></svg> <small>Verified {role}</small></div> : <div className="text-secondary"><small>{role}</small></div>}
        <small className="text-secondary">{other.location ? `${other.location}. ` : ''}{presence}</small>
      </div>
      {lastTx && (
        <div className="bg-warning bg-opacity-10 p-2 mx-3 mb-3 rounded-4">
          <div className="d-flex justify-content-between"><small className="text-secondary m-0 fw-bold">Shared form</small><span className="badge rounded-pill bg-warning bg-opacity-25 text-warning">{TX_LABEL[lastTx.transactionStatus]}</span></div>
          <p className="text-black fw-bold m-0">{lastTx.itemDetails}</p>
          <small className="text-dark-emphasis">{lastTx.pickup || post?.origin} to {lastTx.deliverTo || post?.destination}. {peso(lastTx.agreedPrice)}</small>
        </div>
      )}
      <div id="chatOptions">
        <div className="list-group list-group-flush border-top">
          <Link to={`/profile?user=${other.id}`} data-bs-dismiss="offcanvas" className="list-group-item list-group-item-action d-flex align-items-center gap-3 py-3">
            <svg className="bi bi-md align-middle text-secondary flex-shrink-0"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-person`} /></svg>
            <div className="d-flex flex-column"><span className="text-black">View profile</span><small className="text-secondary">Ratings, trips and reviews</small></div>
          </Link>
          <div className="list-group-item d-flex align-items-center gap-3 py-3">
            <svg className="bi bi-md align-middle text-secondary flex-shrink-0"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-bell-slash`} /></svg>
            <label className="d-flex flex-column flex-grow-1" htmlFor="muteChat"><span className="text-black">Mute notifications</span><small className="text-secondary">Stop alerts from this chat</small></label>
            <div className="form-check form-switch m-0"><input className="form-check-input" type="checkbox" role="switch" id="muteChat" name="muteChat" checked={!!prefs.muted} onChange={(e) => setPref({ muted: e.target.checked })} /></div>
          </div>
          <div className="list-group-item d-flex align-items-center gap-3 py-3">
            <svg className="bi bi-md align-middle text-secondary flex-shrink-0"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-bookmark`} /></svg>
            <label className="d-flex flex-column flex-grow-1" htmlFor="pinChat"><span className="text-black">Pin conversation</span><small className="text-secondary">Keep it at the top of Messages</small></label>
            <div className="form-check form-switch m-0"><input className="form-check-input" type="checkbox" role="switch" id="pinChat" name="pinChat" checked={!!prefs.pinned} onChange={(e) => setPref({ pinned: e.target.checked })} /></div>
          </div>
          <button type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-3 py-3" data-bs-toggle="collapse" data-bs-target="#reportUser">
            <svg className="bi bi-md align-middle text-secondary flex-shrink-0"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-flag`} /></svg>
            <div className="d-flex flex-column align-items-start text-start"><span className="text-black">Report</span><small className="text-secondary">Scam, rude messages or payment outside Pasabuy</small></div>
          </button>
        </div>
        <div className="collapse" id="reportUser" data-bs-parent="#chatOptions">
          <form className="p-3 bg-body-tertiary" onSubmit={report}>
            <p className="fw-bold mb-2">What happened?</p>
            {REASONS.map(([v, label], i) => <div className="form-check mb-1" key={v}><input className="form-check-input" type="radio" name="reportReason" id={`reason${i}`} defaultValue={v} required={i === 0} /><label className="form-check-label" htmlFor={`reason${i}`}>{label}</label></div>)}
            <label htmlFor="reportDetails" className="form-label mt-2 mb-1"><small className="text-secondary">More details (optional)</small></label>
            <textarea className="form-control mb-2" id="reportDetails" name="reportDetails" rows="3" placeholder="Tell us what happened"></textarea>
            {reportMsg && <div className="alert alert-success py-1">{reportMsg}</div>}
            <button type="submit" className="btn btn-danger w-100 fw-bold">Send report</button>
          </form>
        </div>
        <div className="list-group list-group-flush">
          <button type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-3 py-3" data-bs-toggle="collapse" data-bs-target="#blockUser">
            <svg className="bi bi-md align-middle text-secondary flex-shrink-0"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-slash-circle`} /></svg>
            <div className="d-flex flex-column align-items-start text-start"><span className="text-black">{prefs.blockedByMe ? 'Unblock' : 'Block'} {other.username}</span><small className="text-secondary">{prefs.blockedByMe ? 'They will be able to message you again' : "They won't be able to message you"}</small></div>
          </button>
        </div>
        <div className="collapse" id="blockUser" data-bs-parent="#chatOptions">
          <div className="p-3 bg-body-tertiary">
            <p className="fw-bold mb-1">{prefs.blockedByMe ? 'Unblock' : 'Block'} {other.username}?</p>
            <small className="text-secondary d-block mb-2">You can't block while a payment is held for an active transaction.</small>
            {optErr && <div className="alert alert-danger py-1">{optErr}</div>}
            <div className="row g-2">
              <div className="col-6"><button type="button" className="btn btn-outline-dark w-100" data-bs-toggle="collapse" data-bs-target="#blockUser">Cancel</button></div>
              <div className="col-6"><button type="button" className="btn btn-danger w-100 fw-bold" onClick={block}>{prefs.blockedByMe ? 'Unblock' : 'Block'}</button></div>
            </div>
          </div>
        </div>
        <div className="list-group list-group-flush">
          <button type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-3 py-3" data-bs-toggle="collapse" data-bs-target="#deleteChat">
            <svg className="bi bi-md align-middle text-secondary flex-shrink-0"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-trash`} /></svg>
            <div className="d-flex flex-column align-items-start text-start"><span className="text-black">Delete conversation</span><small className="text-secondary">Removes the chat from your list</small></div>
          </button>
        </div>
        <div className="collapse" id="deleteChat" data-bs-parent="#chatOptions">
          <div className="p-3 bg-body-tertiary">
            <p className="fw-bold mb-1">Delete this conversation?</p>
            <small className="text-secondary d-block mb-2">Your transaction form stays in Activity.</small>
            <div className="row g-2">
              <div className="col-6"><button type="button" className="btn btn-outline-dark w-100" data-bs-toggle="collapse" data-bs-target="#deleteChat">Cancel</button></div>
              <div className="col-6"><button type="button" className="btn btn-danger w-100 fw-bold" onClick={del}>Delete</button></div>
            </div>
          </div>
        </div>
      </div>
      <div className="d-flex align-items-start gap-2 text-secondary p-3">
        <svg className="bi bi-sm align-middle flex-shrink-0 mt-1"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-shield-check`} /></svg>
        <small>Keep chats and payment in Pasabuy. We can protect deals and transactions made here.</small>
      </div>
    </div>
  </div>
  <nav className="navbar navbar-expand-lg bg-white sticky-bottom py-2" style={{borderTop:'2px solid rgba(128, 128, 128, 0.13)'}}>
    <div className="container d-flex flex-column align-items-center justify-content-center">
      {sendErr && <small className="text-danger mb-1">{sendErr}</small>}
      {!sendable && <small className="text-secondary mb-1">You can't message this user.</small>}
      <ul className="navbar-nav w-100"><div className="row w-100 mx-0 align-items-center">
        <div className="col-2"><li className="nav-item bg-warning bg-opacity-25 rounded-circle" style={{width:'40px',height:'40px'}}>
          <button type="button" aria-label="Create transaction form" className="nav-link text-warning d-flex flex-column justify-content-center align-items-center bg-transparent border-0 w-100 h-100" data-bs-toggle="offcanvas" data-bs-target="#TransactionForm"><svg className="bi bi-md align-middle"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-plus-circle`} /></svg></button>
        </li></div>
        <div className="col-8"><input type="text" placeholder="Message" className="form-control rounded-5 w-100" value={text} disabled={!sendable} maxLength={1000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())} /></div>
        <div className="col-2"><li className="nav-item bg-warning rounded-circle" style={{width:'40px',height:'40px'}}>
          <button type="button" aria-label="Send" className="nav-link text-black d-flex flex-column justify-content-center align-items-center bg-transparent border-0 w-100 h-100" disabled={!sendable} onClick={send}><svg className="bi bi-md align-middle"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-send`} /></svg></button>
        </li></div>
      </div></ul>
    </div>
  </nav>
</div>
    </>
  )
}

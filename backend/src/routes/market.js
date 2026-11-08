import { Router } from 'express'; import crypto from 'crypto'
import { pool, q, one, fail, h } from '../db.js'; import { requireAuth } from '../middleware.js'; import { notify } from '../notify.js'
const r = Router(); r.use(requireAuth)
const today = () => new Date().toISOString().slice(0, 10); const num = (v) => (v === '' || v == null ? NaN : Number(v))
// ---------- POSTS ----------
const POST_SQL = `SELECT p.*, u.username AS author_username, u.verified AS author_verified, u.avatar AS author_avatar,
  (SELECT COUNT(*) FROM offers o WHERE o.post_id=p.id AND o.status IN ('pending','accepted')) AS offer_count FROM posts p JOIN users u ON u.id=p.user_id`
const shape = (p) => ({ id: p.id, userId: p.user_id, type: p.type, title: p.title, description: p.description, image: p.image, origin: p.origin, destination: p.destination, budget: p.budget, quantity: p.quantity, neededDate: p.needed_date,
  serviceFee: p.service_fee, spaceLeft: p.space_left, travelDate: p.travel_date, returnDate: p.return_date, createdAt: p.created_at, offerCount: p.offer_count,
  status: p.status === 'active' && (p.type === 'request' ? p.needed_date : p.travel_date) < today() ? 'expired' : p.status, author: { id: p.user_id, username: p.author_username, verified: !!p.author_verified, avatar: p.author_avatar } })
function validate(d) {
  if (!['request', 'trip'].includes(d.type)) fail(400, 'Choose a post type.'); if (!String(d.origin || '').trim() || !String(d.destination || '').trim()) fail(400, 'Origin and destination are required.')
  if (d.type === 'request') { if (!String(d.title || '').trim()) fail(400, 'Item name is required.'); if (!Number.isInteger(num(d.quantity)) || num(d.quantity) < 1) fail(400, 'Quantity must be at least 1.')
    if (!(num(d.budget) >= 0)) fail(400, 'Budget must be zero or more.'); if (!d.neededDate || d.neededDate < today()) fail(400, 'Needed-by date must be today or later.') }
  else { if (!d.travelDate || d.travelDate < today()) fail(400, 'Travel date must be today or later.'); if (!(num(d.serviceFee) >= 0)) fail(400, 'Service fee must be zero or more.')
    if (!Number.isInteger(num(d.spaceLeft)) || num(d.spaceLeft) < 1) fail(400, 'Space left must be at least 1.'); if (d.returnDate && d.returnDate < d.travelDate) fail(400, 'Return date cannot be before travel date.') }
}
r.get('/posts', h(async (req, res) => {
  const { type, q: s = '', destination = '', status = 'active', userId } = req.query; const where = ["p.status<>'removed'"]; const args = []
  if (type) { where.push('p.type=?'); args.push(type) } if (userId) { where.push('p.user_id=?'); args.push(userId) } if (destination) { where.push('p.destination=?'); args.push(destination) }
  if (s.trim()) { where.push('(p.title LIKE ? OR p.origin LIKE ? OR p.destination LIKE ? OR u.username LIKE ?)'); args.push(...Array(4).fill(`%${s.trim()}%`)) }
  let rows = (await q(`${POST_SQL} WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC`, args)).map(shape); if (status !== 'all') rows = rows.filter((p) => p.status === status); res.json(rows)
}))
r.get('/posts/:id', h(async (req, res) => { const p = await one(`${POST_SQL} WHERE p.id=? AND p.status<>'removed'`, [req.params.id]); if (!p) fail(404, 'Post not found.'); res.json(shape(p)) }))
const cols = (d) => d.type === 'request' ? { budget: num(d.budget), quantity: num(d.quantity), needed_date: d.neededDate } : { service_fee: num(d.serviceFee), space_left: num(d.spaceLeft), travel_date: d.travelDate, return_date: d.returnDate || null }
r.post('/posts', h(async (req, res) => {
  const d = req.body; validate(d); const id = crypto.randomUUID(); const f = { id, user_id: req.user.id, type: d.type, title: String(d.title || `${d.origin} to ${d.destination}`).trim(), description: String(d.description || '').trim(), image: d.image || null, origin: d.origin.trim(), destination: d.destination.trim(), ...cols(d) }
  await q(`INSERT INTO posts (${Object.keys(f)}) VALUES (${Object.keys(f).map(() => '?')})`, Object.values(f)); res.status(201).json(shape(await one(`${POST_SQL} WHERE p.id=?`, [id])))
}))
r.put('/posts/:id', h(async (req, res) => {
  const p = await one('SELECT * FROM posts WHERE id=?', [req.params.id]); if (!p || p.status === 'removed') fail(404, 'Post not found.'); if (p.user_id !== req.user.id) fail(403, 'Only the owner can edit this post.'); if (p.status !== 'active') fail(400, 'Only active posts can be edited.')
  const d = { type: p.type, origin: p.origin, destination: p.destination, title: p.title, neededDate: p.needed_date, quantity: p.quantity, budget: p.budget, serviceFee: p.service_fee, spaceLeft: p.space_left, travelDate: p.travel_date, returnDate: p.return_date, ...req.body, type: p.type }; validate(d)
  const f = { title: String(d.title).trim(), description: String(d.description ?? p.description ?? '').trim(), image: d.image ?? p.image, origin: d.origin.trim(), destination: d.destination.trim(), ...cols(d) }
  await q(`UPDATE posts SET ${Object.keys(f).map((k) => `${k}=?`)} WHERE id=?`, [...Object.values(f), p.id]); res.json(shape(await one(`${POST_SQL} WHERE p.id=?`, [p.id])))
}))
r.delete('/posts/:id', h(async (req, res) => {
  const p = await one('SELECT * FROM posts WHERE id=?', [req.params.id]); if (!p || p.status === 'removed') fail(404, 'Post not found.'); if (p.user_id !== req.user.id) fail(403, 'Only the owner can delete this post.')
  if (await one("SELECT id FROM transactions WHERE post_id=? AND transaction_status NOT IN ('cancelled','completed')", [p.id])) fail(400, 'This post has an active transaction.')
  await q("UPDATE posts SET status='removed' WHERE id=?", [p.id]); await q("UPDATE offers SET status='rejected' WHERE post_id=? AND status='pending'", [p.id]); res.json({ ok: true })
}))
// ---------- OFFERS ----------
r.post('/posts/:id/offers', h(async (req, res) => {
  const p = await one('SELECT * FROM posts WHERE id=?', [req.params.id]); if (!p || p.status !== 'active' || p.needed_date < today()) fail(400, 'This request is no longer available.'); if (p.type !== 'request') fail(400, 'Offers can only be sent to requester posts.')
  if (p.user_id === req.user.id) fail(403, 'You cannot offer on your own request.'); const price = num(req.body.proposedPrice); if (!(price >= 0)) fail(400, 'Enter a valid price (0 or more).')
  if (await one("SELECT id FROM offers WHERE post_id=? AND traveler_id=? AND status='pending'", [p.id, req.user.id])) fail(409, 'You already have a pending offer on this request.')
  const id = crypto.randomUUID(); await q('INSERT INTO offers (id,post_id,traveler_id,requester_id,proposed_price,message) VALUES (?,?,?,?,?,?)', [id, p.id, req.user.id, p.user_id, price, String(req.body.message || '').trim().slice(0, 500)])
  await notify(p.user_id, 'offer', `${req.user.username} sent an offer on "${p.title}".`, p.id, '/'); res.status(201).json({ id })
}))
r.get('/posts/:id/offers', h(async (req, res) => { const p = await one('SELECT user_id FROM posts WHERE id=?', [req.params.id]); if (!p || p.user_id !== req.user.id) fail(403, 'Only the post owner can see offers.')
  res.json(await q('SELECT o.id, o.post_id AS postId, o.traveler_id AS travelerId, o.proposed_price AS proposedPrice, o.message, o.status, o.created_at AS createdAt, u.username AS travelerUsername FROM offers o JOIN users u ON u.id=o.traveler_id WHERE o.post_id=? ORDER BY o.created_at DESC', [req.params.id])) }))
r.get('/offers/mine', h(async (req, res) => res.json(await q('SELECT o.id, o.post_id AS postId, o.proposed_price AS proposedPrice, o.message, o.status, o.created_at AS createdAt, p.title FROM offers o JOIN posts p ON p.id=o.post_id WHERE o.traveler_id=? ORDER BY o.created_at DESC', [req.user.id]))))
r.post('/offers/:id/cancel', h(async (req, res) => { const o = await one('SELECT * FROM offers WHERE id=? AND traveler_id=?', [req.params.id, req.user.id]); if (!o) fail(404, 'Offer not found.'); if (o.status !== 'pending') fail(400, 'Only pending offers can be cancelled.'); await q("UPDATE offers SET status='cancelled' WHERE id=?", [o.id]); res.json({ ok: true }) }))
r.post('/offers/:id/reject', h(async (req, res) => { const o = await one('SELECT * FROM offers WHERE id=? AND requester_id=?', [req.params.id, req.user.id]); if (!o) fail(404, 'Offer not found.'); if (o.status !== 'pending') fail(400, 'Offer is no longer pending.')
  await q("UPDATE offers SET status='rejected' WHERE id=?", [o.id]); await notify(o.traveler_id, 'offer_rejected', `Your offer was rejected by ${req.user.username}.`, o.post_id, '/'); res.json({ ok: true }) }))
r.post('/offers/:id/accept', h(async (req, res) => { // atomic: offer + post + competing offers + new transaction
  const c = await pool.getConnection(); const txId = crypto.randomUUID(); let post, others
  try {
    await c.beginTransaction(); const [[o]] = await c.execute('SELECT * FROM offers WHERE id=? AND requester_id=? FOR UPDATE', [req.params.id, req.user.id]); if (!o) fail(404, 'Offer not found.')
    ;[[post]] = await c.execute('SELECT * FROM posts WHERE id=? FOR UPDATE', [o.post_id]); if (o.status !== 'pending' || post.status !== 'active') fail(400, 'This offer can no longer be accepted.')
    await c.execute("UPDATE offers SET status='accepted' WHERE id=?", [o.id]); await c.execute("UPDATE posts SET status='closed' WHERE id=?", [post.id])
    ;[others] = await c.execute("SELECT traveler_id FROM offers WHERE post_id=? AND id<>? AND status='pending'", [post.id, o.id]); await c.execute("UPDATE offers SET status='rejected' WHERE post_id=? AND id<>? AND status='pending'", [post.id, o.id])
    await c.execute('INSERT INTO transactions (id,post_id,offer_id,requester_id,traveler_id,item_details,quantity,agreed_price) VALUES (?,?,?,?,?,?,?,?)', [txId, post.id, o.id, post.user_id, o.traveler_id, post.title, post.quantity || 1, o.proposed_price])
    await c.execute('INSERT INTO transaction_history (transaction_id,status,actor_id) VALUES (?,"pending",?)', [txId, req.user.id]); await c.commit()
    await notify(o.traveler_id, 'transaction', `Your offer for "${post.title}" was accepted. A transaction was created.`, txId, '/transactions')
    for (const x of others) await notify(x.traveler_id, 'offer_rejected', `Another traveler was chosen for "${post.title}".`, post.id, '/')
    res.status(201).json({ id: txId })
  } catch (e) { await c.rollback(); throw e } finally { c.release() }
}))
// ---------- TRANSACTIONS (same state machine as the frontend prototype; payment is SIMULATED) ----------
export const PAY_METHODS = ['GCash', 'Maya', 'Bank transfer']; export const AUTO_RELEASE_HOURS = 48 // keep in sync with src/services/paymentService.js
export const payEvent = (c, paymentId, type, actorId, note) => c.execute('INSERT INTO payment_events (payment_id,type,actor_id,note) VALUES (?,?,?,?)', [paymentId, type, actorId, note])
const FLOW = { approve: ['pending', 'approved', 'traveler', 'approved the transaction details'], cancel: [['pending', 'approved'], 'cancelled', 'either', 'cancelled the transaction'], pay: ['approved', 'paid', 'requester', 'made a SIMULATED payment (held)'],
  ship: ['paid', 'in_transit', 'traveler', 'started delivery'], deliver: ['in_transit', 'delivered', 'traveler', 'marked the item as delivered'], confirm: ['delivered', 'completed', 'requester', 'confirmed receipt: transaction completed'], dispute: [['paid', 'in_transit', 'delivered'], 'disputed', 'either', 'opened a dispute'] }
const SIDE = { pay: { payment_status: 'held' }, ship: { delivery_status: 'in_transit' }, deliver: { delivery_status: 'delivered' }, confirm: { payment_status: 'released', delivery_status: 'received' }, cancel: { payment_status: 'unpaid' } }
export const TX_SQL = `SELECT t.id, t.post_id AS postId, t.offer_id AS offerId, t.requester_id AS requesterId, t.traveler_id AS travelerId, t.item_details AS itemDetails, t.quantity, t.agreed_price AS agreedPrice,
  t.payment_status AS paymentStatus, t.delivery_status AS deliveryStatus, t.transaction_status AS transactionStatus, t.created_at AS createdAt, rq.username AS requesterUsername, tr.username AS travelerUsername
  FROM transactions t JOIN users rq ON rq.id=t.requester_id JOIN users tr ON tr.id=t.traveler_id`
r.get('/transactions', h(async (req, res) => res.json(await q(`${TX_SQL} WHERE t.requester_id=? OR t.traveler_id=? ORDER BY t.created_at DESC`, [req.user.id, req.user.id]))))
r.get('/transactions/:id', h(async (req, res) => { const t = await one(`${TX_SQL} WHERE t.id=?`, [req.params.id]); if (!t || (t.requesterId !== req.user.id && t.travelerId !== req.user.id && req.user.role !== 'admin')) fail(403, 'You cannot view this transaction.')
  t.history = await q('SELECT status, actor_id AS actorId, created_at AS at FROM transaction_history WHERE transaction_id=? ORDER BY id', [t.id]); res.json(t) }))
r.get('/transactions/:id/payment', h(async (req, res) => {
  const p = await one('SELECT p.id, p.transaction_id AS transactionId, p.payer_id AS payerId, p.payee_id AS payeeId, p.amount, p.method, p.reference, p.status, p.held_at AS heldAt, p.auto_release_at AS autoReleaseAt, p.released_at AS releasedAt, p.refunded_at AS refundedAt FROM payments p WHERE p.transaction_id=?', [req.params.id])
  if (!p) return res.json(null); if (![p.payerId, p.payeeId].includes(req.user.id) && req.user.role !== 'admin') fail(403, 'You cannot view this payment.')
  p.events = await q('SELECT type, actor_id AS actorId, note, created_at AS at FROM payment_events WHERE payment_id=? ORDER BY id', [p.id]); res.json(p)
}))
r.post('/transactions/:id/:action', h(async (req, res) => {
  const rule = FLOW[req.params.action]; if (!rule) fail(400, 'Unknown action.'); const [from, to, by, note] = rule
  const c = await pool.getConnection()
  try {
    await c.beginTransaction(); const [[t]] = await c.execute('SELECT * FROM transactions WHERE id=? FOR UPDATE', [req.params.id]); if (!t) fail(404, 'Transaction not found.')
    const role = req.user.id === t.requester_id ? 'requester' : req.user.id === t.traveler_id ? 'traveler' : null; if (!role) fail(403, 'You are not part of this transaction.'); if (by !== 'either' && by !== role) fail(403, `Only the ${by} can do this.`)
    if (![].concat(from).includes(t.transaction_status)) fail(400, `Cannot ${req.params.action}: transaction is "${t.transaction_status}".`)
    const set = { transaction_status: to, ...(SIDE[req.params.action] || {}) }; await c.execute(`UPDATE transactions SET ${Object.keys(set).map((k) => `${k}=?`)} WHERE id=?`, [...Object.values(set), t.id])
    await c.execute('INSERT INTO transaction_history (transaction_id,status,actor_id) VALUES (?,?,?)', [t.id, to, req.user.id])
    // payment hold ledger (simulated): the hold is created with the payment and only ever closed by confirm / auto-release / admin ruling
    const act = req.params.action
    if (act === 'pay') {
      if (!PAY_METHODS.includes(req.body.method)) fail(400, 'Choose a payment method.')
      const pid = crypto.randomUUID(); const ref = `PB-${crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase()}`
      await c.execute('INSERT INTO payments (id,transaction_id,payer_id,payee_id,amount,method,reference) VALUES (?,?,?,?,?,?,?)', [pid, t.id, t.requester_id, t.traveler_id, t.agreed_price, req.body.method, ref])
      await payEvent(c, pid, 'held', req.user.id, `Payment held via ${req.body.method} (simulated)`)
    } else if (['deliver', 'dispute', 'confirm'].includes(act)) {
      const [[p]] = await c.execute('SELECT id FROM payments WHERE transaction_id=? FOR UPDATE', [t.id])
      if (p && act === 'deliver') { await c.execute('UPDATE payments SET auto_release_at=DATE_ADD(NOW(), INTERVAL ? HOUR) WHERE id=?', [AUTO_RELEASE_HOURS, p.id]); await payEvent(c, p.id, 'delivered', req.user.id, `Auto-release in ${AUTO_RELEASE_HOURS} hours unless disputed`) }
      if (p && act === 'dispute') { await c.execute("UPDATE payments SET status='disputed', auto_release_at=NULL WHERE id=?", [p.id]); await payEvent(c, p.id, 'disputed', req.user.id, 'Held until an admin decides') }
      if (p && act === 'confirm') { await c.execute("UPDATE payments SET status='released', released_at=NOW(), auto_release_at=NULL WHERE id=?", [p.id]); await payEvent(c, p.id, 'released', req.user.id, 'Requester confirmed receipt') }
    }
    if (req.params.action === 'cancel') await c.execute("UPDATE posts SET status='active' WHERE id=? AND status='closed'", [t.post_id]); await c.commit()
    await notify(role === 'requester' ? t.traveler_id : t.requester_id, req.params.action === 'cancel' ? 'transaction_cancelled' : 'transaction', `${req.user.username} ${note} for "${t.item_details}".`, t.id, '/transactions'); res.json({ ok: true, status: to })
  } catch (e) { await c.rollback(); throw e } finally { c.release() }
}))
// ---------- REVIEWS & REPORTS ----------
r.post('/reviews', h(async (req, res) => {
  const { transactionId, rating, comment = '' } = req.body; const t = await one('SELECT * FROM transactions WHERE id=?', [transactionId]); if (!t) fail(404, 'Transaction not found.'); if (t.transaction_status !== 'completed') fail(400, 'Only completed transactions can be reviewed.')
  if (![t.requester_id, t.traveler_id].includes(req.user.id)) fail(403, 'You are not part of this transaction.'); const n = Number(rating); if (!Number.isInteger(n) || n < 1 || n > 5) fail(400, 'Choose a rating from 1 to 5 stars.')
  if (await one('SELECT id FROM reviews WHERE transaction_id=? AND reviewer_id=?', [t.id, req.user.id])) fail(409, 'You already reviewed this transaction.')
  await q('INSERT INTO reviews (id,transaction_id,reviewer_id,reviewed_user_id,rating,comment) VALUES (?,?,?,?,?,?)', [crypto.randomUUID(), t.id, req.user.id, req.user.id === t.requester_id ? t.traveler_id : t.requester_id, n, String(comment).trim().slice(0, 500)]); res.status(201).json({ ok: true })
}))
r.post('/reports', h(async (req, res) => { const { targetId, targetType, reason = '' } = req.body; if (!['post', 'user', 'transaction'].includes(targetType) || !targetId) fail(400, 'Choose what you are reporting.'); if (!reason.trim()) fail(400, 'Please describe the reason.')
  await q('INSERT INTO reports (id,reporter_id,target_id,target_type,reason) VALUES (?,?,?,?,?)', [crypto.randomUUID(), req.user.id, targetId, targetType, reason.trim().slice(0, 500)]); res.status(201).json({ ok: true }) }))
export default r

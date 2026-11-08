import { db, newId, now, fail, requireActive, requireAdmin } from './db.js'
import { notificationService as notify } from './notificationService.js'
import { paymentService } from './paymentService.js'
// Valid transitions only. Payment actions are SIMULATED: no money is processed. The hold itself is recorded by paymentService.
export const FLOW = {
  approve: { from: ['pending'], to: 'approved', by: 'counterparty', note: 'approved the transaction details' },
  cancel: { from: ['pending', 'approved'], to: 'cancelled', by: 'either', note: 'cancelled the transaction' },
  pay: { from: ['approved'], to: 'paid', by: 'requester', note: 'made a SIMULATED payment (held)' },
  ship: { from: ['paid'], to: 'in_transit', by: 'traveler', note: 'started delivery' },
  deliver: { from: ['in_transit'], to: 'delivered', by: 'traveler', note: 'marked the item as delivered' },
  confirm: { from: ['delivered'], to: 'completed', by: 'requester', note: 'confirmed receipt: transaction completed' },
  dispute: { from: ['paid', 'in_transit', 'delivered'], to: 'disputed', by: 'either', note: 'opened a dispute' },
}
const side = { pay: { paymentStatus: 'held' }, ship: { deliveryStatus: 'in_transit' }, deliver: { deliveryStatus: 'delivered' }, confirm: { paymentStatus: 'released', deliveryStatus: 'received' }, cancel: { paymentStatus: 'unpaid' } }
const load = (id) => { const t = db.all('transactions').find((x) => x.id === id); if (!t) fail('Transaction not found.', 'NOT_FOUND'); return t }
const canView = (t, uid) => [t.requesterId, t.travelerId].includes(uid) || db.all('users').find((u) => u.id === uid)?.role === 'admin'
export const transactionService = {
  async createFromOffer(offer, post) { // called by offerService.accept
    const t = { id: newId('tx'), postId: post.id, offerId: offer.id, requesterId: post.userId, travelerId: offer.travelerId, itemDetails: post.title, quantity: post.quantity || 1, agreedPrice: offer.proposedPrice,
      paymentStatus: 'unpaid', deliveryStatus: 'not_started', transactionStatus: 'pending', createdAt: now(), history: [{ at: now(), status: 'pending', by: post.userId }] }
    db.save('transactions', [t, ...db.all('transactions')])
    await notify.create({ userId: t.travelerId, type: 'transaction', message: `Your offer for "${post.title}" was accepted. A transaction was created.`, relatedId: t.id, link: `/messages/chat?with=${post.userId}` }); return t
  },
  // A form made inside a chat. Roles come from the post the chat is about; with no post, the sender is the traveler.
  async createFromForm(actorId, { otherId, item, quantity, price, pickup, deliver, when, notes = '', postId = null }) {
    const me = requireActive(actorId); const other = db.all('users').find((u) => u.id === otherId)
    if (!other || otherId === actorId) fail('Choose a valid person to send the form to.')
    if (!(item || '').trim()) fail('Item is required.')
    const q = Number(quantity); if (!Number.isInteger(q) || q < 1) fail('Quantity must be a whole number of at least 1.')
    if (price === '' || price == null || !(Number(price) >= 0)) fail('Enter a valid price (0 or more).')
    if (!(pickup || '').trim() || !(deliver || '').trim()) fail('Pickup and delivery places are required.')
    if (!when || Number.isNaN(Date.parse(when))) fail('Choose a date and time.'); if (Date.parse(when) < Date.now() - 60000) fail('Date and time cannot be in the past.')
    const post = postId ? db.all('posts').find((p) => p.id === postId) : null
    let actorIsTraveler = true
    if (post) actorIsTraveler = (post.type === 'trip') === (post.userId === actorId)
    const t = { id: newId('tx'), postId: post?.id || null, offerId: null, requesterId: actorIsTraveler ? otherId : actorId, travelerId: actorIsTraveler ? actorId : otherId,
      itemDetails: item.trim(), quantity: q, agreedPrice: Number(price), pickup: pickup.trim(), deliverTo: deliver.trim(), deliverAt: when, notes: (notes || '').trim(), createdBy: actorId,
      paymentStatus: 'unpaid', deliveryStatus: 'not_started', transactionStatus: 'pending', createdAt: now(), history: [{ at: now(), status: 'pending', by: actorId }] }
    db.save('transactions', [t, ...db.all('transactions')])
    await notify.create({ userId: otherId, type: 'transaction', message: `${me.username} sent you a transaction form for "${t.itemDetails}".`, relatedId: t.id, link: `/messages/chat?with=${actorId}` }); return t
  },
  // No server clock in demo mode, so overdue holds are released whenever transactions are read. A real backend does this in a scheduled job.
  async sweep() {
    const due = db.all('payments').filter((p) => p.status === 'held' && p.autoReleaseAt && p.autoReleaseAt <= now())
    for (const p of due) {
      const all = db.all('transactions'); const t = all.find((x) => x.id === p.transactionId); if (!t || t.transactionStatus !== 'delivered') continue
      Object.assign(t, { paymentStatus: 'released', deliveryStatus: 'received', transactionStatus: 'completed' }); t.history.push({ at: now(), status: 'completed', by: 'system' }); db.save('transactions', all)
      const rel = paymentService.release(t.id, 'system', 'Auto-released: the requester did not respond within 48 hours of delivery')
      await paymentService.notifyBoth(rel, `Payment for "${t.itemDetails}" was released automatically (simulated). The requester did not respond within 48 hours of delivery.`)
    }
  },
  async getBetween(a, b) { await this.sweep(); return db.all('transactions').filter((t) => [t.requesterId, t.travelerId].every((x) => [a, b].includes(x))).sort((x, y) => x.createdAt.localeCompare(y.createdAt)) },
  async getAll() { await this.sweep(); return db.all('transactions') },
  async getForUser(uid) { await this.sweep(); return db.all('transactions').filter((t) => canView(t, uid)) },
  async getById(id, actorId) { const t = load(id); if (!canView(t, actorId)) fail('You cannot view this transaction.', 'FORBIDDEN'); return t },
  async act(id, actorId, action, opts = {}) {
    requireActive(actorId); const rule = FLOW[action]; if (!rule) fail('Unknown action.')
    const all = db.all('transactions'); const t = all.find((x) => x.id === id); if (!t) fail('Transaction not found.', 'NOT_FOUND')
    const role = actorId === t.requesterId ? 'requester' : actorId === t.travelerId ? 'traveler' : null
    if (!role) fail('You are not part of this transaction.', 'FORBIDDEN')
    if (rule.by === 'counterparty') {
      if (actorId === t.history[0]?.by) fail('The other person has to approve this form.', 'FORBIDDEN')
      if (!db.all('users').find((u) => u.id === actorId)?.verified) fail('Only verified users can approve a transaction form. Get verified from your profile first.', 'FORBIDDEN')
    } else if (rule.by !== 'either' && rule.by !== role) fail(`Only the ${rule.by} can do this.`, 'FORBIDDEN')
    if (!rule.from.includes(t.transactionStatus)) fail(`Cannot ${action}: transaction is "${t.transactionStatus}".`, 'INVALID_TRANSITION')
    let pay = null
    if (action === 'pay') pay = paymentService.hold(t, actorId, opts.method) // validates the method first; nothing below runs if it throws
    Object.assign(t, side[action], { transactionStatus: rule.to }); t.history.push({ at: now(), status: rule.to, by: actorId }); db.save('transactions', all)
    if (action === 'deliver') paymentService.markDelivered(t.id, actorId)
    if (action === 'dispute') paymentService.markDisputed(t.id, actorId)
    if (action === 'confirm') paymentService.release(t.id, actorId, 'Requester confirmed receipt: released to the traveler')
    if (action === 'cancel') db.save('posts', db.all('posts').map((p) => (p.id === t.postId && p.status === 'closed' ? { ...p, status: 'active' } : p)))
    const me = db.all('users').find((u) => u.id === actorId)
    await notify.create({ userId: role === 'requester' ? t.travelerId : t.requesterId, type: action === 'cancel' ? 'transaction_cancelled' : 'transaction', message: pay ? `${me.username} paid ₱${pay.amount.toLocaleString('en-PH')} for "${t.itemDetails}". It is held safely until delivery is confirmed (simulated).` : `${me.username} ${rule.note} for "${t.itemDetails}".`, relatedId: t.id, link: '/transactions' })
    return t
  },
  async resolveDispute(id, adminId, outcome) { // admin only; still simulated
    requireAdmin(adminId); const all = db.all('transactions'); const t = all.find((x) => x.id === id)
    if (!t || t.transactionStatus !== 'disputed') fail('Transaction is not disputed.', 'INVALID_TRANSITION')
    if (!['release', 'refund'].includes(outcome)) fail('Choose release or refund.')
    Object.assign(t, outcome === 'release' ? { transactionStatus: 'completed', paymentStatus: 'released' } : { transactionStatus: 'cancelled', paymentStatus: 'refunded' })
    t.history.push({ at: now(), status: t.transactionStatus, by: adminId }); db.save('transactions', all)
    if (outcome === 'release') paymentService.release(t.id, adminId, 'Admin ruled in favour of the traveler: released'); else paymentService.refund(t.id, adminId, 'Admin ruled in favour of the requester: refunded')
    for (const userId of [t.requesterId, t.travelerId]) await notify.create({ userId, type: 'transaction', message: `Dispute for "${t.itemDetails}" resolved by admin: ${outcome === 'release' ? 'payment released (simulated)' : 'refunded (simulated)'}.`, relatedId: t.id, link: '/transactions' })
    return t
  },
}

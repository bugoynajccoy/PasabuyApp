import { db, newId, now, fail, requireAdmin } from './db.js'
import { notificationService as notify } from './notificationService.js'
// Payment HOLD ledger. SIMULATED: no real money moves and no payment gateway is called. One record per paid transaction.
// held -> released (requester confirms, auto-release, or admin ruling)
// held -> disputed -> released | refunded (admin ruling)
export const METHODS = ['GCash', 'Maya', 'Bank transfer'] // labels only; no Cash on Delivery
export const AUTO_RELEASE_HOURS = 48 // after the traveler marks delivered, the hold releases by itself if the requester stays silent
const reference = () => `PB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
const hoursFromNow = (h) => new Date(Date.now() + h * 36e5).toISOString()
const byTx = (txId) => db.all('payments').find((p) => p.transactionId === txId) || null
const patch = (txId, changes, event) => {
  const all = db.all('payments'); const p = all.find((x) => x.transactionId === txId); if (!p) return null
  Object.assign(p, changes); p.events.push({ at: now(), ...event }); db.save('payments', all); return p
}
export const paymentService = {
  // Internal: called by transactionService.act when the requester pays. Throws BEFORE anything is changed.
  hold(t, payerId, method) {
    if (!METHODS.includes(method)) fail('Choose a payment method.')
    if (byTx(t.id)) fail('A payment is already held for this transaction.', 'CONFLICT')
    const amount = Number(t.agreedPrice) || 0
    const p = { id: newId('pay'), transactionId: t.id, payerId, payeeId: t.travelerId, amount, method, reference: reference(), status: 'held', heldAt: now(), autoReleaseAt: null, releasedAt: null, refundedAt: null,
      events: [{ at: now(), type: 'held', by: payerId, note: `Payment of ${amount} held via ${method} (simulated)` }] }
    db.save('payments', [p, ...db.all('payments')]); return p
  },
  markDelivered(txId, by) { return patch(txId, { autoReleaseAt: hoursFromNow(AUTO_RELEASE_HOURS) }, { type: 'delivered', by, note: `Traveler marked delivered. Auto-release in ${AUTO_RELEASE_HOURS} hours unless disputed.` }) },
  markDisputed(txId, by) { return patch(txId, { status: 'disputed', autoReleaseAt: null }, { type: 'disputed', by, note: 'Dispute opened. Auto-release stopped; the payment stays held until an admin decides.' }) },
  release(txId, by, note = 'Released to the traveler') { return patch(txId, { status: 'released', releasedAt: now(), autoReleaseAt: null }, { type: 'released', by, note }) },
  refund(txId, by, note = 'Refunded to the requester') { return patch(txId, { status: 'refunded', refundedAt: now(), autoReleaseAt: null }, { type: 'refunded', by, note }) },
  async getByTransaction(txId, actorId) {
    const p = byTx(txId); if (!p) return null
    const admin = db.all('users').find((u) => u.id === actorId)?.role === 'admin'
    if (!admin && ![p.payerId, p.payeeId].includes(actorId)) fail('You cannot view this payment.', 'FORBIDDEN'); return p
  },
  async getForUser(uid) { return db.all('payments').filter((p) => [p.payerId, p.payeeId].includes(uid)) },
  async getAll(adminId) { requireAdmin(adminId); return db.all('payments') },
  async summary(adminId) {
    requireAdmin(adminId); const out = { held: 0, disputed: 0, released: 0, refunded: 0 }
    for (const p of db.all('payments')) out[p.status] += p.amount; return out
  },
  async notifyBoth(p, message) { for (const userId of [p.payerId, p.payeeId]) await notify.create({ userId, type: 'payment', message, relatedId: p.transactionId, link: '/transactions' }) },
}

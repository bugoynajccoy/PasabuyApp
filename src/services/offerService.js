import { db, newId, now, fail, requireActive } from './db.js'
import { notificationService as notify } from './notificationService.js'
import { transactionService } from './transactionService.js'
const uname = (id) => db.all('users').find((u) => u.id === id)?.username
export const offerService = {
  async create(actorId, { postId, proposedPrice, message = '' }) {
    requireActive(actorId); const post = db.all('posts').find((p) => p.id === postId)
    if (!post || post.status !== 'active') fail('This request is no longer available.')
    if (post.type !== 'request') fail('Offers can only be sent to requester posts.')
    if (post.userId === actorId) fail('You cannot offer on your own request.', 'FORBIDDEN')
    const price = Number(proposedPrice); if (proposedPrice === '' || !(price >= 0)) fail('Enter a valid price (0 or more).')
    if (db.all('offers').some((o) => o.postId === postId && o.travelerId === actorId && o.status === 'pending')) fail('You already have a pending offer on this request.', 'CONFLICT')
    const o = { id: newId('o'), postId, travelerId: actorId, requesterId: post.userId, proposedPrice: price, message: message.trim(), status: 'pending', createdAt: now() }
    db.save('offers', [o, ...db.all('offers')])
    await notify.create({ userId: post.userId, type: 'offer', message: `${uname(actorId)} sent an offer on "${post.title}".`, relatedId: postId, link: '/' }); return o
  },
  async getByPost(postId, actorId) { const post = db.all('posts').find((p) => p.id === postId); if (!post || post.userId !== actorId) fail('Only the post owner can see offers.', 'FORBIDDEN'); return db.all('offers').filter((o) => o.postId === postId).map((o) => ({ ...o, travelerUsername: uname(o.travelerId) })) },
  async getForUser(uid) { return db.all('offers').filter((o) => o.travelerId === uid || o.requesterId === uid) },
  async cancel(id, actorId) {
    const all = db.all('offers'); const o = all.find((x) => x.id === id); if (!o || o.travelerId !== actorId) fail('Offer not found.', 'NOT_FOUND')
    if (o.status !== 'pending') fail('Only pending offers can be cancelled.', 'INVALID_TRANSITION'); o.status = 'cancelled'; db.save('offers', all)
  },
  async reject(id, actorId) {
    requireActive(actorId); const all = db.all('offers'); const o = all.find((x) => x.id === id); if (!o || o.requesterId !== actorId) fail('Offer not found.', 'NOT_FOUND')
    if (o.status !== 'pending') fail('Offer is no longer pending.', 'INVALID_TRANSITION'); o.status = 'rejected'; db.save('offers', all)
    await notify.create({ userId: o.travelerId, type: 'offer_rejected', message: `Your offer was rejected by ${uname(actorId)}.`, relatedId: o.postId, link: '/' })
  },
  async accept(id, actorId) {
    requireActive(actorId); const all = db.all('offers'); const o = all.find((x) => x.id === id); if (!o || o.requesterId !== actorId) fail('Offer not found.', 'NOT_FOUND')
    const posts = db.all('posts'); const post = posts.find((p) => p.id === o.postId)
    if (o.status !== 'pending' || post.status !== 'active') fail('This offer can no longer be accepted.', 'INVALID_TRANSITION')
    o.status = 'accepted'; post.status = 'closed'
    for (const x of all) if (x.postId === o.postId && x.id !== o.id && x.status === 'pending') { x.status = 'rejected'; await notify.create({ userId: x.travelerId, type: 'offer_rejected', message: `Another traveler was chosen for "${post.title}".`, relatedId: post.id, link: '/' }) }
    db.save('offers', all); db.save('posts', posts); return transactionService.createFromOffer(o, post)
  },
}

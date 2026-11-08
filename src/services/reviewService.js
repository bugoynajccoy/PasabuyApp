import { db, newId, now, fail, requireActive } from './db.js'
export const reviewService = {
  async create(actorId, { transactionId, rating, comment = '' }) {
    requireActive(actorId); const t = db.all('transactions').find((x) => x.id === transactionId); if (!t) fail('Transaction not found.', 'NOT_FOUND')
    if (t.transactionStatus !== 'completed') fail('Only completed transactions can be reviewed.')
    if (![t.requesterId, t.travelerId].includes(actorId)) fail('You are not part of this transaction.', 'FORBIDDEN')
    const r = Number(rating); if (!Number.isInteger(r) || r < 1 || r > 5) fail('Choose a rating from 1 to 5 stars.')
    if (db.all('reviews').some((x) => x.transactionId === transactionId && x.reviewerId === actorId)) fail('You already reviewed this transaction.', 'CONFLICT')
    const rev = { id: newId('rv'), transactionId, reviewerId: actorId, reviewedUserId: actorId === t.requesterId ? t.travelerId : t.requesterId, rating: r, comment: comment.trim(), createdAt: now() }
    db.save('reviews', [rev, ...db.all('reviews')]); return rev
  },
  async getForUser(uid) { return db.all('reviews').filter((r) => r.reviewedUserId === uid) },
  async hasReviewed(transactionId, uid) { return db.all('reviews').some((x) => x.transactionId === transactionId && x.reviewerId === uid) },
  async summary(uid) { const rs = db.all('reviews').filter((r) => r.reviewedUserId === uid); return { count: rs.length, average: rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : 0 } },
}

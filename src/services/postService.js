import { db, newId, now, fail, requireActive } from './db.js'
const today = () => new Date().toISOString().slice(0, 10)
const effective = (p) => (p.status === 'active' && (p.type === 'request' ? p.neededDate : p.travelDate) < today() ? 'expired' : p.status)
const num = (v) => (v === '' || v == null ? NaN : Number(v))
function validate(d) {
  if (!d.type || !['request', 'trip'].includes(d.type)) fail('Choose a post type.')
  if (!(d.origin || '').trim() || !(d.destination || '').trim()) fail('Origin and destination are required.')
  if (d.type === 'request') {
    if (!(d.title || '').trim()) fail('Item name is required.')
    if (!Number.isInteger(num(d.quantity)) || num(d.quantity) < 1) fail('Quantity must be a whole number of at least 1.')
    if (!(num(d.budget) >= 0)) fail('Budget must be zero or more.')
    if (!d.neededDate || d.neededDate < today()) fail('Needed-by date must be today or later.')
  } else {
    if (!d.travelDate || d.travelDate < today()) fail('Travel date must be today or later.')
    if (!(num(d.serviceFee) >= 0)) fail('Service fee must be zero or more.')
    if (!Number.isInteger(num(d.spaceLeft)) || num(d.spaceLeft) < 1) fail('Space left must be at least 1.')
    if (d.returnDate && d.returnDate < d.travelDate) fail('Return date cannot be before the travel date.')
  }
}
const clean = (d) => ({ type: d.type, title: (d.title || `${d.origin} to ${d.destination}`).trim(), description: (d.description || '').trim(), image: d.image || '', origin: d.origin.trim(), destination: d.destination.trim(),
  ...(d.type === 'request' ? { budget: num(d.budget), quantity: num(d.quantity), neededDate: d.neededDate } : { serviceFee: num(d.serviceFee), spaceLeft: num(d.spaceLeft), travelDate: d.travelDate, returnDate: d.returnDate || '' }) })
const decorate = (p) => {
  const author = db.all('users').find((u) => u.id === p.userId)
  return { ...p, status: effective(p), author: author ? { id: author.id, username: author.username, verified: author.verified, avatar: author.avatar } : null,
    offerCount: db.all('offers').filter((o) => o.postId === p.id && ['pending', 'accepted'].includes(o.status)).length }
}
export const postService = {
  // filters: { type, q, destination, status ('active' default | 'all') , userId }
  async getAll({ type, q = '', destination = '', status = 'active', userId } = {}) {
    const s = q.trim().toLowerCase()
    return db.all('posts').map(decorate).filter((p) => p.status !== 'removed' || status === 'all')
      .filter((p) => (status === 'all' ? true : p.status === status) && (!type || p.type === type) && (!userId || p.userId === userId)
        && (!destination || p.destination.toLowerCase() === destination.toLowerCase())
        && (!s || [p.title, p.origin, p.destination, p.author?.username].some((x) => (x || '').toLowerCase().includes(s))))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  async getById(id) { const p = db.all('posts').find((x) => x.id === id); if (!p) fail('Post not found.', 'NOT_FOUND'); return decorate(p) },
  async create(actorId, data) { requireActive(actorId); validate(data); const p = { id: newId('p'), userId: actorId, ...clean(data), status: 'active', createdAt: now() }; db.save('posts', [p, ...db.all('posts')]); return decorate(p) },
  async update(id, actorId, data) {
    requireActive(actorId); const all = db.all('posts'); const p = all.find((x) => x.id === id); if (!p) fail('Post not found.', 'NOT_FOUND')
    if (p.userId !== actorId) fail('Only the owner can edit this post.', 'FORBIDDEN')
    if (p.status !== 'active') fail('Only active posts can be edited.'); validate({ ...p, ...data }); Object.assign(p, clean({ ...p, ...data })); db.save('posts', all); return decorate(p)
  },
  async remove(id, actorId) {
    requireActive(actorId); const all = db.all('posts'); const p = all.find((x) => x.id === id); if (!p) fail('Post not found.', 'NOT_FOUND')
    if (p.userId !== actorId) fail('Only the owner can delete this post.', 'FORBIDDEN')
    if (db.all('transactions').some((t) => t.postId === id && !['cancelled', 'completed'].includes(t.transactionStatus))) fail('This post has an active transaction.')
    p.status = 'removed'; db.save('posts', all)
    db.save('offers', db.all('offers').map((o) => (o.postId === id && o.status === 'pending' ? { ...o, status: 'rejected' } : o)))
  },
}

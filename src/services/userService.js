import { db, fail, requireActive } from './db.js'
import { reviewService } from './reviewService.js'
import { syncActors } from './actor.js'
const safe = ({ password, ...u }) => u
export const userService = {
  async getAll() { syncActors(); return db.all('users').map(safe) },
  // People anyone can find and message: active, non-admin accounts other than the caller. Public fields only (no email/phone/password).
  async search(actorId, q = '', limit = 8) {
    syncActors(); const s = (q || '').trim().toLowerCase()
    return db.all('users').filter((u) => u.role === 'user' && u.accountStatus === 'active' && u.id !== actorId
      && (!s || [u.username, u.name].some((x) => (x || '').toLowerCase().includes(s))))
      .sort((a, b) => (s ? a.username.localeCompare(b.username) : (b.createdAt || '').localeCompare(a.createdAt || '')))
      .slice(0, limit).map(({ id, name, username, verified, avatar, location, bio }) => ({ id, name, username, verified, avatar, location, bio }))
  },
  async getById(id) {
    const u = db.all('users').find((x) => x.id === id); if (!u) fail('User not found.', 'NOT_FOUND')
    const { average, count } = await reviewService.summary(id); return { ...safe(u), rating: average, reviewCount: count }
  },
  async update(id, actorId, patch) {
    if (id !== actorId) fail('You can only edit your own profile.', 'FORBIDDEN'); requireActive(actorId)
    const name = (patch.name ?? '').trim(); if (!name) fail('Name is required.')
    if (patch.phone && !/^(09|\+639)\d{9}$/.test(patch.phone)) fail('Enter a valid PH mobile number.')
    const all = db.all('users'); const u = all.find((x) => x.id === id)
    Object.assign(u, { name, phone: patch.phone ?? u.phone, bio: patch.bio ?? u.bio, location: patch.location ?? u.location, avatar: patch.avatar ?? u.avatar }); db.save('users', all); return safe(u)
  },
}

// Bridges the login session (AuthContext, pb_users, numeric ids) to the service layer's users (pb2_users, "u_xxx" ids).
// Services need an actor id that exists in their own store; this finds it by username or creates it on first use.
import { db, newId, now } from './db.js'
import { load, save } from '../data/store.js'
import { seedUsers } from '../data/mockData.js'

const mirror = (src) => ({ id: newId('u'), name: src.name, username: src.username, email: src.email, phone: src.phone || '', password: src.password,
  role: src.role === 'admin' ? 'admin' : 'user', accountStatus: src.status === 'suspended' ? 'suspended' : 'active', verified: !!src.verified,
  bio: src.bio || '', avatar: src.avatar || '', createdAt: src.createdAt || now(),
  verificationStatus: src.verified ? 'verified' : (src.verificationStatus || 'unverified') })

// Makes sure EVERY registered account exists in the service layer, not just the ones that have logged in.
// Without this, someone who registered but has not logged in yet cannot be messaged, found in search or have their profile opened.
export function syncActors() {
  const have = db.all('users'); const names = new Set(have.map((u) => u.username.toLowerCase()))
  const fresh = load('pb_users', seedUsers).filter((s) => s.username && !names.has(s.username.toLowerCase())).map(mirror)
  if (fresh.length) db.save('users', [...have, ...fresh])
  return fresh.length
}

export function resolveActorId(session) {
  if (!session?.username) return null
  syncActors()
  const uname = session.username.toLowerCase()
  return db.all('users').find((u) => u.username.toLowerCase() === uname)?.id || null
}

// The admin tables and login read pb_users, the feed and services read pb2_users. Verification changes must reach both,
// so this applies a patch to the login-layer copy of an account (matched by username, like the rest of this bridge).
export function patchLegacyUser(username, patch) {
  const k = String(username || '').toLowerCase(); const rows = load('pb_users', seedUsers)
  if (!rows.some((u) => String(u.username || '').toLowerCase() === k)) return
  save('pb_users', rows.map((u) => (String(u.username || '').toLowerCase() === k ? { ...u, ...patch } : u)))
}

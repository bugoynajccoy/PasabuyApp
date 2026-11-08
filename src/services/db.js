// localStorage adapter: the ONLY place that touches storage. Replace with fetch() calls when the Express API exists.
import { seed } from '../data/seed.js'
import { syncPush } from './sync.js'
const PREFIX = 'pb2_'
export const now = () => new Date().toISOString()
export const newId = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export class ServiceError extends Error { constructor(message, code = 'BAD_REQUEST') { super(message); this.code = code } }
export const fail = (m, c) => { throw new ServiceError(m, c) }
export const db = {
  all(name) {
    try { const v = JSON.parse(localStorage.getItem(PREFIX + name)); if (v) return v } catch { /* reseed */ }
    const s = seed[name] || []; localStorage.setItem(PREFIX + name, JSON.stringify(s)); return s
  },
  save: (name, rows) => { localStorage.setItem(PREFIX + name, JSON.stringify(rows)); syncPush(PREFIX + name); try { window.dispatchEvent(new CustomEvent('pb:data', { detail: name })) } catch { /* non-browser */ } },
  raw: { get: (k) => localStorage.getItem(PREFIX + k) ?? sessionStorage.getItem(PREFIX + k), set: (k, v, remember) => (remember ? localStorage : sessionStorage).setItem(PREFIX + k, v), del: (k) => { localStorage.removeItem(PREFIX + k); sessionStorage.removeItem(PREFIX + k) } },
}
export const requireUser = (id) => { const u = db.all('users').find((x) => x.id === id); if (!u) fail('Please log in.', 'UNAUTHORIZED'); return u }
export const requireActive = (id) => { const u = requireUser(id); if (u.accountStatus === 'suspended') fail('Your account is suspended.', 'FORBIDDEN'); return u }
export const requireAdmin = (id) => { const u = requireUser(id); if (u.role !== 'admin') fail('Administrator access required.', 'FORBIDDEN'); return u }

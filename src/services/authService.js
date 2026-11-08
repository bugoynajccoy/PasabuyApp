import { db, newId, now, fail } from './db.js'
// PROTOTYPE AUTH ONLY: not secure. Production: Express + hashed passwords (bcrypt) + httpOnly-cookie sessions/JWT + server-side role checks.
const toSession = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role })
export const authService = {
  getSession() { try { return JSON.parse(db.raw.get('session')) } catch { return null } },
  async login(identifier, password, remember = false, adminOnly = false) {
    const id = (identifier || '').trim().toLowerCase(); if (!id || !password) fail('Please enter your email/username and password.')
    const u = db.all('users').find((x) => x.email.toLowerCase() === id || x.username.toLowerCase() === id)
    if (!u || u.password !== password) fail('Invalid email/username or password.', 'UNAUTHORIZED')
    if (adminOnly && u.role !== 'admin') fail('This account is not an administrator.', 'FORBIDDEN')
    if (u.accountStatus === 'suspended') fail('This account has been suspended.', 'FORBIDDEN')
    const s = toSession(u); db.raw.del('session'); db.raw.set('session', JSON.stringify(s), remember); return s
  },
  async register(f) {
    const v = (k) => (f[k] || '').trim()
    if (!v('name') || !v('username') || !v('email') || !v('phone') || !f.password || !f.confirm) fail('Please fill in all required fields.')
    if (!/^[a-z0-9._]{3,20}$/i.test(v('username'))) fail('Username must be 3-20 letters, numbers, dots or underscores.')
    if (!/^\S+@\S+\.\S+$/.test(v('email'))) fail('Enter a valid email address.')
    if (!/^(09|\+639)\d{9}$/.test(v('phone'))) fail('Enter a valid PH mobile number (e.g. 09171234567).')
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) fail('Password needs 8+ characters with letters and numbers.')
    if (f.password !== f.confirm) fail('Passwords do not match.')
    if (!f.terms) fail('You must accept the terms and conditions.')
    const all = db.all('users')
    if (all.some((u) => u.username.toLowerCase() === v('username').toLowerCase())) fail('Username is already taken.', 'CONFLICT')
    if (all.some((u) => u.email.toLowerCase() === v('email').toLowerCase())) fail('Email is already registered.', 'CONFLICT')
    const u = { id: newId('u'), name: v('name'), username: v('username'), email: v('email'), phone: v('phone'), password: f.password, role: 'user', accountStatus: 'active', verified: false, bio: '', avatar: f.avatar || '', createdAt: now() }
    db.save('users', [...all, u]); return toSession(u) // role is ALWAYS 'user'
  },
  async changePassword(userId, current, next, confirm) {
    const all = db.all('users'); const u = all.find((x) => x.id === userId)
    if (!u || u.password !== current) fail('Current password is incorrect.')
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) fail('Password needs 8+ characters with letters and numbers.')
    if (next !== confirm) fail('Passwords do not match.')
    u.password = next; db.save('users', all)
  },
  logout() { db.raw.del('session') },
}

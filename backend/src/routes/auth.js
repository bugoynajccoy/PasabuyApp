import { Router } from 'express'; import bcrypt from 'bcryptjs'; import crypto from 'crypto'
import { q, one, fail, h } from '../db.js'; import { sign, cookieOpts, requireAuth } from '../middleware.js'
const r = Router(); const strong = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p)
const pub = (u) => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, verified: !!u.verified })
r.post('/register', h(async (req, res) => {
  const { name = '', username = '', email = '', phone = '', password = '', confirm = '', terms } = req.body; const v = (s) => String(s).trim()
  if (![name, username, email, phone, password, confirm].every((x) => v(x))) fail(400, 'Please fill in all required fields.')
  if (!/^[a-z0-9._]{3,20}$/i.test(v(username))) fail(400, 'Username must be 3-20 letters, numbers, dots or underscores.')
  if (!/^\S+@\S+\.\S+$/.test(v(email))) fail(400, 'Enter a valid email address.')
  if (!/^(09|\+639)\d{9}$/.test(v(phone))) fail(400, 'Enter a valid PH mobile number.')
  if (!strong(password)) fail(400, 'Password needs 8+ characters with letters and numbers.')
  if (password !== confirm) fail(400, 'Passwords do not match.'); if (!terms) fail(400, 'You must accept the terms and conditions.')
  if (await one('SELECT id FROM users WHERE username=?', [v(username)])) fail(409, 'Username is already taken.')
  if (await one('SELECT id FROM users WHERE email=?', [v(email)])) fail(409, 'Email is already registered.')
  const id = crypto.randomUUID() // role is hard-coded: nobody can register as admin
  await q('INSERT INTO users (id,name,username,email,phone,password_hash,role) VALUES (?,?,?,?,?,?,"user")', [id, v(name), v(username), v(email).toLowerCase(), v(phone), await bcrypt.hash(password, 12)])
  res.status(201).json({ ok: true })
}))
r.post('/login', h(async (req, res) => {
  const { identifier = '', password = '', remember = false, adminOnly = false } = req.body; if (!identifier.trim() || !password) fail(400, 'Please enter your email/username and password.')
  const u = await one('SELECT * FROM users WHERE email=? OR username=?', [identifier.trim().toLowerCase(), identifier.trim()])
  if (!u || !(await bcrypt.compare(password, u.password_hash))) fail(401, 'Invalid email/username or password.')
  if (adminOnly && u.role !== 'admin') fail(403, 'This account is not an administrator.'); if (u.account_status === 'suspended') fail(403, 'This account has been suspended.')
  res.cookie('token', sign(u), cookieOpts(remember)).json({ user: pub(u) })
}))
r.post('/logout', (_req, res) => res.clearCookie('token').json({ ok: true }))
r.get('/me', requireAuth, (req, res) => res.json({ user: pub(req.user) }))
r.post('/change-password', requireAuth, h(async (req, res) => {
  const { current = '', next = '', confirm = '' } = req.body; const u = await one('SELECT password_hash FROM users WHERE id=?', [req.user.id])
  if (!(await bcrypt.compare(current, u.password_hash))) fail(400, 'Current password is incorrect.'); if (!strong(next)) fail(400, 'Password needs 8+ characters with letters and numbers.'); if (next !== confirm) fail(400, 'Passwords do not match.')
  await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(next, 12), req.user.id]); res.json({ ok: true })
}))
export default r

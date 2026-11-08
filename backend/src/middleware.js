import jwt from 'jsonwebtoken'
import { one, fail } from './db.js'
export const sign = (u) => jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
export const cookieOpts = (remember) => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', ...(remember ? { maxAge: 7 * 864e5 } : {}) })
export const userFromToken = async (token) => { try { const { id } = jwt.verify(token, process.env.JWT_SECRET); return await one('SELECT id,name,username,email,role,account_status,verified FROM users WHERE id=?', [id]) } catch { return null } }
// Authorization is re-checked against the DATABASE on every request: suspension and role changes apply immediately.
export const requireAuth = async (req, _res, next) => { try { const u = await userFromToken(req.cookies?.token); if (!u) fail(401, 'Please log in.'); if (u.account_status === 'suspended') fail(403, 'Your account is suspended.'); req.user = u; next() } catch (e) { next(e) } }
export const requireAdmin = (req, _res, next) => (req.user?.role === 'admin' ? next() : next(Object.assign(new Error('Administrator access required.'), { status: 403 })))
export const errorHandler = (err, _req, res, _next) => { if (!err.status) console.error(err); res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error.' }) }

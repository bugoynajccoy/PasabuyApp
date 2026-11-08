import { Router } from 'express'
import { q, one, fail, h } from '../db.js'; import { requireAuth, requireAdmin } from '../middleware.js'; import { notify, logAdmin } from '../notify.js'
import { TX_SQL, payEvent } from './market.js'
import { pool } from '../db.js'
const r = Router(); r.use(requireAuth, requireAdmin) // every /api/admin route: authenticated + role=admin, checked server-side
r.get('/stats', h(async (_q, res) => {
  const c = async (sql) => (await one(sql)).n; const today = new Date().toISOString().slice(0, 10)
  const byStatus = Object.fromEntries((await q('SELECT transaction_status s, COUNT(*) n FROM transactions GROUP BY transaction_status')).map((x) => [x.s, x.n]))
  const byMonth = Object.fromEntries((await q("SELECT DATE_FORMAT(created_at,'%Y-%m') m, COUNT(*) n FROM users WHERE role='user' GROUP BY m ORDER BY m")).map((x) => [x.m, x.n]))
  res.json({ totalUsers: await c("SELECT COUNT(*) n FROM users WHERE role='user'"), travelers: await c("SELECT COUNT(DISTINCT u) n FROM (SELECT user_id u FROM posts WHERE type='trip' UNION SELECT traveler_id FROM transactions) x"),
    requesters: await c("SELECT COUNT(DISTINCT u) n FROM (SELECT user_id u FROM posts WHERE type='request' UNION SELECT requester_id FROM transactions) x"),
    activePosts: await c(`SELECT COUNT(*) n FROM posts WHERE status='active' AND COALESCE(needed_date,travel_date)>='${today}'`), totalTransactions: await c('SELECT COUNT(*) n FROM transactions'), byStatus, byMonth,
    postsByType: { 'Traveler offers': await c("SELECT COUNT(*) n FROM posts WHERE type='trip' AND status<>'removed'"), 'Requester posts': await c("SELECT COUNT(*) n FROM posts WHERE type='request' AND status<>'removed'") },
    activity: { Offers: await c('SELECT COUNT(*) n FROM offers'), Messages: await c('SELECT COUNT(*) n FROM messages'), Reviews: await c('SELECT COUNT(*) n FROM reviews'), Reports: await c('SELECT COUNT(*) n FROM reports') } })
}))
r.get('/users', h(async (_q, res) => res.json(await q('SELECT id,name,username,email,phone,role,account_status AS accountStatus,verified,created_at AS createdAt FROM users'))))
r.post('/users/:id/verify', h(async (req, res) => { const flag = req.body.verified ? 1 : 0; const u = await one('SELECT username FROM users WHERE id=?', [req.params.id]); if (!u) fail(404, 'User not found.')
  await q('UPDATE users SET verified=? WHERE id=?', [flag, req.params.id]); await logAdmin(req.user.id, `${flag ? 'Verified' : 'Removed verification from'} ${u.username}`); if (flag) await notify(req.params.id, 'verification', 'Your account received a verification badge.', null, '/profile'); res.json({ ok: true }) }))
r.post('/users/:id/suspend', h(async (req, res) => { const u = await one('SELECT username,role FROM users WHERE id=?', [req.params.id]); if (!u || u.role === 'admin') fail(403, 'This account cannot be suspended.'); const s = req.body.suspended
  await q('UPDATE users SET account_status=? WHERE id=?', [s ? 'suspended' : 'active', req.params.id]); await logAdmin(req.user.id, `${s ? 'Suspended' : 'Reactivated'} ${u.username}`); res.json({ ok: true }) }))
r.get('/posts', h(async (_q, res) => res.json(await q("SELECT p.id,p.title,p.type,p.origin,p.destination,p.status,p.created_at AS createdAt,u.username AS author FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC"))))
r.delete('/posts/:id', h(async (req, res) => { const p = await one('SELECT title,user_id FROM posts WHERE id=?', [req.params.id]); if (!p) fail(404, 'Post not found.'); await q("UPDATE posts SET status='removed' WHERE id=?", [req.params.id])
  await logAdmin(req.user.id, `Removed post "${p.title}"`); await notify(p.user_id, 'post_removed', `Your post "${p.title}" was removed by an administrator.`, req.params.id); res.json({ ok: true }) }))
r.get('/transactions', h(async (_q, res) => res.json(await q(`${TX_SQL} ORDER BY t.created_at DESC`))))
r.post('/transactions/:id/resolve', h(async (req, res) => { // simulated release/refund only
  const t = await one('SELECT * FROM transactions WHERE id=?', [req.params.id]); if (!t || t.transaction_status !== 'disputed') fail(400, 'Transaction is not disputed.'); const o = req.body.outcome; if (!['release', 'refund'].includes(o)) fail(400, 'Choose release or refund.')
  await q('UPDATE transactions SET transaction_status=?, payment_status=? WHERE id=?', o === 'release' ? ['completed', 'released', t.id] : ['cancelled', 'refunded', t.id]); await q('INSERT INTO transaction_history (transaction_id,status,actor_id) VALUES (?,?,?)', [t.id, o === 'release' ? 'completed' : 'cancelled', req.user.id])
  const c = await pool.getConnection(); try { const [[p]] = await c.execute('SELECT id FROM payments WHERE transaction_id=?', [t.id]); if (p) {
    await c.execute(o === 'release' ? "UPDATE payments SET status='released', released_at=NOW(), auto_release_at=NULL WHERE id=?" : "UPDATE payments SET status='refunded', refunded_at=NOW(), auto_release_at=NULL WHERE id=?", [p.id])
    await payEvent(c, p.id, o === 'release' ? 'released' : 'refunded', req.user.id, o === 'release' ? 'Admin ruled for the traveler' : 'Admin ruled for the requester') } } finally { c.release() }
  await logAdmin(req.user.id, `Resolved dispute ${t.id} (${o}, simulated)`); for (const id of [t.requester_id, t.traveler_id]) await notify(id, 'transaction', `Dispute for "${t.item_details}" resolved by admin: ${o === 'release' ? 'payment released (simulated)' : 'refunded (simulated)'}.`, t.id, '/transactions'); res.json({ ok: true }) }))
r.get('/payments', h(async (_q, res) => res.json(await q('SELECT p.id, p.transaction_id AS transactionId, p.reference, p.amount, p.method, p.status, p.held_at AS heldAt, p.auto_release_at AS autoReleaseAt, rq.username AS requester, tr.username AS traveler FROM payments p JOIN users rq ON rq.id=p.payer_id JOIN users tr ON tr.id=p.payee_id ORDER BY p.held_at DESC'))))
r.get('/reports', h(async (_q, res) => res.json(await q('SELECT id, reporter_id AS reporterId, target_id AS targetId, target_type AS targetType, reason, status, decision, created_at AS createdAt FROM reports ORDER BY created_at DESC'))))
for (const [path, status] of [['resolve', 'resolved'], ['dismiss', 'dismissed']]) r.post(`/reports/:id/${path}`, h(async (req, res) => { const d = String(req.body.decision || '').trim(); if (!d) fail(400, 'Record your decision.')
  const rep = await one("SELECT * FROM reports WHERE id=? AND status='open'", [req.params.id]); if (!rep) fail(400, 'Report is not open.'); await q('UPDATE reports SET status=?, decision=? WHERE id=?', [status, d, rep.id]); await logAdmin(req.user.id, `${status === 'resolved' ? 'Resolved' : 'Dismissed'} report ${rep.target_type} ${rep.target_id}: ${d}`); res.json({ ok: true }) }))
r.get('/logs', h(async (_q, res) => res.json(await q('SELECT l.id, l.action AS text, l.created_at AS time, u.username AS actor FROM admin_logs l JOIN users u ON u.id=l.admin_id ORDER BY l.id DESC LIMIT 500'))))
// ---- identity verification review (admin only: this whole router is behind requireAuth + requireAdmin) ----
r.get('/verifications', h(async (_q, res) => res.json(await q(`SELECT v.id, v.user_id AS userId, u.username, u.name AS accountName, v.id_type AS idType, v.name_on_id AS nameOnId,
  v.id_image AS idImage, v.selfie_image AS selfieImage, v.status, v.reason, v.created_at AS createdAt, v.reviewed_at AS reviewedAt
  FROM verification_requests v JOIN users u ON u.id=v.user_id
  ORDER BY (v.status='pending') DESC, IF(v.status='pending', v.created_at, NULL) ASC, v.reviewed_at DESC LIMIT 200`))))
// The UPDATE ... WHERE status='pending' is the guard: two admins cannot decide the same request, and the photos are erased in the same statement.
r.post('/verifications/:id/approve', h(async (req, res) => {
  const v = await one('SELECT v.id, v.user_id, u.username FROM verification_requests v JOIN users u ON u.id=v.user_id WHERE v.id=?', [req.params.id]); if (!v) fail(404, 'Verification request not found.')
  const done = await q("UPDATE verification_requests SET status='approved', id_image=NULL, selfie_image=NULL, reviewed_by=?, reviewed_at=NOW() WHERE id=? AND status='pending'", [req.user.id, v.id])
  if (!done.affectedRows) fail(400, 'This request was already reviewed.')
  await q('UPDATE users SET verified=1 WHERE id=?', [v.user_id]); await logAdmin(req.user.id, `Approved identity verification for ${v.username}`)
  await notify(v.user_id, 'verification', 'Your identity was verified. Your account now has a verification badge.', v.id, '/profile'); res.json({ ok: true })
}))
r.post('/verifications/:id/reject', h(async (req, res) => {
  const why = String(req.body.reason || '').trim(); if (why.length < 3) fail(400, 'Tell the user why, so they know what to fix.'); if (why.length > 255) fail(400, 'Keep the reason under 255 characters.')
  const v = await one('SELECT v.id, v.user_id, u.username FROM verification_requests v JOIN users u ON u.id=v.user_id WHERE v.id=?', [req.params.id]); if (!v) fail(404, 'Verification request not found.')
  const done = await q("UPDATE verification_requests SET status='rejected', reason=?, id_image=NULL, selfie_image=NULL, reviewed_by=?, reviewed_at=NOW() WHERE id=? AND status='pending'", [why, req.user.id, v.id])
  if (!done.affectedRows) fail(400, 'This request was already reviewed.')
  await logAdmin(req.user.id, `Rejected identity verification for ${v.username}: ${why}`)
  await notify(v.user_id, 'verification', `We could not verify your ID: ${why}. You can submit it again from your profile.`, v.id, '/profile'); res.json({ ok: true })
}))
export default r

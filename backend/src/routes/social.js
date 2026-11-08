import { Router } from 'express'; import crypto from 'crypto'
import { q, one, fail, h } from '../db.js'; import { requireAuth } from '../middleware.js'; import { notify } from '../notify.js'
const r = Router(); r.use(requireAuth)
export const convId = (a, b) => [a, b].sort().join('__')
// ---------- USERS / PROFILE ----------
const profile = async (id) => one(`SELECT u.id, u.name, u.username, u.bio, u.avatar, u.verified, u.account_status AS accountStatus, u.created_at AS createdAt,
  (SELECT ROUND(AVG(rating),1) FROM reviews WHERE reviewed_user_id=u.id) AS rating, (SELECT COUNT(*) FROM reviews WHERE reviewed_user_id=u.id) AS reviewCount FROM users u WHERE u.id=?`, [id])
r.get('/users/:id', h(async (req, res) => { const u = await profile(req.params.id === 'me' ? req.user.id : req.params.id); if (!u) fail(404, 'User not found.'); res.json({ ...u, verified: !!u.verified, rating: u.rating || 0 }) })) // public: no email/phone/password
r.put('/users/me', h(async (req, res) => {
  const { name = '', phone = '', bio = '', avatar } = req.body; if (!name.trim()) fail(400, 'Name is required.'); if (phone && !/^(09|\+639)\d{9}$/.test(phone)) fail(400, 'Enter a valid PH mobile number.')
  if (avatar && (!/^data:image\/(png|jpe?g|webp);base64,/.test(avatar) || avatar.length > 700000)) fail(400, 'Profile picture must be a PNG/JPG/WebP under ~500 KB.')
  await q('UPDATE users SET name=?, phone=?, bio=?, avatar=COALESCE(?,avatar) WHERE id=?', [name.trim(), phone, bio.trim().slice(0, 255), avatar || null, req.user.id]); res.json(await profile(req.user.id))
}))
r.get('/users/:id/reviews', h(async (req, res) => res.json(await q('SELECT r.id, r.transaction_id AS transactionId, r.rating, r.comment, r.created_at AS createdAt, u.username AS reviewer FROM reviews r JOIN users u ON u.id=r.reviewer_id WHERE r.reviewed_user_id=? ORDER BY r.created_at DESC', [req.params.id]))))
// ---------- MESSAGES (REST; Socket.IO pushes new messages live) ----------
r.get('/conversations', h(async (req, res) => res.json(await q(`SELECT m.conversation_id AS id, IF(m.sender_id=?, m.receiver_id, m.sender_id) AS otherId, u.username AS otherUsername, m.content AS lastContent, m.created_at AS lastAt,
  (SELECT COUNT(*) FROM messages x WHERE x.conversation_id=m.conversation_id AND x.receiver_id=? AND x.is_read=0) AS unread
  FROM messages m JOIN users u ON u.id=IF(m.sender_id=?, m.receiver_id, m.sender_id)
  WHERE m.id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at DESC) rn FROM messages WHERE sender_id=? OR receiver_id=?) z WHERE rn=1) ORDER BY m.created_at DESC`, Array(5).fill(req.user.id)))))
r.get('/conversations/:otherId/messages', h(async (req, res) => { // only participants can read; opening marks received messages read
  const id = convId(req.user.id, req.params.otherId); await q('UPDATE messages SET is_read=1 WHERE conversation_id=? AND receiver_id=?', [id, req.user.id])
  res.json(await q('SELECT id, conversation_id AS conversationId, sender_id AS senderId, receiver_id AS receiverId, content, is_read AS `read`, created_at AS createdAt FROM messages WHERE conversation_id=? ORDER BY created_at', [id]))
}))
r.post('/messages', h(async (req, res) => {
  const { receiverId, content = '', relatedId = null } = req.body; const text = content.trim(); if (!text) fail(400, 'Message cannot be empty.'); if (text.length > 2000) fail(400, 'Message is too long.')
  if (receiverId === req.user.id || !(await one("SELECT id FROM users WHERE id=? AND account_status='active'", [receiverId]))) fail(400, 'Choose a valid recipient.')
  const m = { id: crypto.randomUUID(), conversationId: convId(req.user.id, receiverId), senderId: req.user.id, receiverId, content: text, relatedId, read: false, createdAt: new Date().toISOString() }
  await q('INSERT INTO messages (id,conversation_id,sender_id,receiver_id,content,related_id) VALUES (?,?,?,?,?,?)', [m.id, m.conversationId, m.senderId, m.receiverId, m.content, relatedId])
  req.app.get('io')?.to(`user:${receiverId}`).to(`user:${req.user.id}`).emit('message:new', m); await notify(receiverId, 'message', `New message from ${req.user.username}.`, m.conversationId, '/messages/chat'); res.status(201).json(m)
}))
// ---------- NOTIFICATIONS ----------
r.get('/notifications', h(async (req, res) => res.json(await q('SELECT id, type, message, related_id AS relatedId, link, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100', [req.user.id]))))
r.post('/notifications/read-all', h(async (req, res) => { await q('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]); res.json({ ok: true }) }))
r.post('/notifications/:id/read', h(async (req, res) => { await q('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]); res.json({ ok: true }) }))
export default r

import { Router } from 'express'; import crypto from 'crypto'
import { q, one, fail, h } from '../db.js'; import { requireAuth } from '../middleware.js'; import { notify } from '../notify.js'
const r = Router(); r.use(requireAuth); const MAX = 500
const livePost = async (id) => { const p = await one("SELECT id, user_id, type, title, origin, destination FROM posts WHERE id=? AND status<>'removed'", [id]); if (!p) fail(404, 'This post is no longer available.'); return p }
const label = (p) => (p.type === 'request' ? p.title : `${p.origin} to ${p.destination}`)
// like counts + comment counts for many posts at once: GET /post-stats?ids=a,b,c
r.get('/post-stats', h(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 100); if (!ids.length) return res.json({}); const ph = ids.map(() => '?').join(',')
  const likes = await q(`SELECT target_id id, COUNT(*) n, MAX(user_id=?) liked FROM reactions WHERE target_type='post' AND target_id IN (${ph}) GROUP BY target_id`, [req.user.id, ...ids])
  const comments = await q(`SELECT post_id id, COUNT(*) n FROM comments WHERE post_id IN (${ph}) GROUP BY post_id`, ids)
  res.json(Object.fromEntries(ids.map((id) => [id, { likes: likes.find((x) => x.id === id)?.n || 0, liked: !!likes.find((x) => x.id === id)?.liked, comments: comments.find((x) => x.id === id)?.n || 0 }])))
}))
// toggle: POST /reactions {targetType:'post'|'comment', targetId}. The UNIQUE key stops double likes even under races.
r.post('/reactions', h(async (req, res) => {
  const { targetType, targetId } = req.body; if (!['post', 'comment'].includes(targetType)) fail(400, 'Nothing to react to.')
  let post, owner, text
  if (targetType === 'post') { post = await livePost(targetId); owner = post.user_id; text = `${req.user.username} liked your post "${label(post)}".` }
  else { const c = await one('SELECT id, post_id, user_id FROM comments WHERE id=?', [targetId]); if (!c) fail(404, 'Comment not found.'); post = await livePost(c.post_id); owner = c.user_id; text = `${req.user.username} liked your comment.` }
  const gone = await q('DELETE FROM reactions WHERE target_type=? AND target_id=? AND user_id=?', [targetType, targetId, req.user.id]); let liked = false
  if (!gone.affectedRows) { await q('INSERT INTO reactions (id,target_type,target_id,user_id) VALUES (?,?,?,?)', [crypto.randomUUID(), targetType, targetId, req.user.id]); liked = true; if (owner !== req.user.id) await notify(owner, 'like', text, post.id, '/') }
  res.json({ liked, likes: (await one('SELECT COUNT(*) n FROM reactions WHERE target_type=? AND target_id=?', [targetType, targetId])).n })
}))
r.get('/posts/:id/comments', h(async (req, res) => {
  await livePost(req.params.id)
  const rows = await q(`SELECT c.id, c.post_id AS postId, c.user_id AS userId, c.parent_id AS parentId, c.content, c.created_at AS createdAt, u.username, u.verified, u.avatar,
    (SELECT COUNT(*) FROM reactions x WHERE x.target_type='comment' AND x.target_id=c.id) AS likes, EXISTS(SELECT 1 FROM reactions x WHERE x.target_type='comment' AND x.target_id=c.id AND x.user_id=?) AS liked
    FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.created_at`, [req.user.id, req.params.id])
  const shape = (c) => ({ id: c.id, postId: c.postId, userId: c.userId, parentId: c.parentId, content: c.content, createdAt: c.createdAt, likes: c.likes, liked: !!c.liked, author: { id: c.userId, username: c.username, verified: !!c.verified, avatar: c.avatar } })
  res.json(rows.filter((c) => !c.parentId).map((c) => ({ ...shape(c), replies: rows.filter((x) => x.parentId === c.id).map(shape) })))
}))
r.post('/posts/:id/comments', h(async (req, res) => {
  const post = await livePost(req.params.id); const text = String(req.body.content || '').trim(); if (!text) fail(400, 'Write something first.'); if (text.length > MAX) fail(400, `Comments can be up to ${MAX} characters.`)
  let parent = null; if (req.body.parentId) { parent = await one('SELECT id, user_id, parent_id FROM comments WHERE id=? AND post_id=?', [req.body.parentId, post.id]); if (!parent) fail(404, 'The comment you are replying to was removed.'); if (parent.parent_id) parent = await one('SELECT id, user_id, parent_id FROM comments WHERE id=?', [parent.parent_id]) || parent }
  const id = crypto.randomUUID(); await q('INSERT INTO comments (id,post_id,user_id,parent_id,content) VALUES (?,?,?,?,?)', [id, post.id, req.user.id, parent?.id || null, text])
  const told = new Set([req.user.id])
  if (parent && !told.has(parent.user_id)) { told.add(parent.user_id); await notify(parent.user_id, 'comment', `${req.user.username} replied to your comment.`, post.id, '/') }
  if (!told.has(post.user_id)) await notify(post.user_id, 'comment', `${req.user.username} commented on your post "${label(post)}".`, post.id, '/')
  res.status(201).json({ id })
}))
// the commenter, the post owner or an admin can delete; replies (FK cascade) and the comment's likes go with it
r.delete('/comments/:id', h(async (req, res) => {
  const c = await one('SELECT c.id, c.user_id, p.user_id AS owner FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=?', [req.params.id]); if (!c) fail(404, 'Comment not found.')
  if (![c.user_id, c.owner].includes(req.user.id) && req.user.role !== 'admin') fail(403, 'You cannot delete this comment.')
  await q("DELETE FROM reactions WHERE target_type='comment' AND (target_id=? OR target_id IN (SELECT id FROM comments WHERE parent_id=?))", [c.id, c.id]); await q('DELETE FROM comments WHERE id=?', [c.id]); res.json({ ok: true })
}))
export default r

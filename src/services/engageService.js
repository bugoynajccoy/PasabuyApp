import { db, newId, now, fail, requireActive } from './db.js'
import { notificationService as notify } from './notificationService.js'
// Likes ("reactions") and comments on posts, Instagram style: like a post, comment, reply (one level), like a comment.
// reactions: { id, targetType: 'post' | 'comment', targetId, userId, createdAt }
// comments:  { id, postId, userId, parentId (null for top level), content, createdAt }
export const MAX_COMMENT = 500
const user = (id) => db.all('users').find((u) => u.id === id)
const slim = (u) => (u ? { id: u.id, username: u.username, verified: !!u.verified, avatar: u.avatar } : null)
const post = (id) => { const p = db.all('posts').find((x) => x.id === id); if (!p || p.status === 'removed') fail('This post is no longer available.', 'NOT_FOUND'); return p }
const blocked = (a, b) => db.all('blocks').some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a))
const title = (p) => (p.type === 'request' ? p.title : `${p.origin} to ${p.destination}`)
export const engageService = {
  // One call for the whole feed: { [postId]: { likes, liked, comments } }
  async getStats(postIds, actorId) {
    const set = new Set(postIds); const out = Object.fromEntries(postIds.map((id) => [id, { likes: 0, liked: false, comments: 0 }]))
    for (const r of db.all('reactions')) if (r.targetType === 'post' && set.has(r.targetId)) { out[r.targetId].likes++; if (r.userId === actorId) out[r.targetId].liked = true }
    for (const c of db.all('comments')) if (set.has(c.postId)) out[c.postId].comments++
    return out
  },
  // Like / unlike. Returns the new state for that target.
  async toggleLike(actorId, targetType, targetId) {
    const me = requireActive(actorId); if (!['post', 'comment'].includes(targetType)) fail('Nothing to react to.')
    let p, owner, text
    if (targetType === 'post') { p = post(targetId); owner = p.userId; text = `${me.username} liked your post "${title(p)}".` }
    else { const c = db.all('comments').find((x) => x.id === targetId); if (!c) fail('Comment not found.', 'NOT_FOUND'); p = post(c.postId); owner = c.userId; text = `${me.username} liked your comment.` }
    if (blocked(actorId, p.userId)) fail('You cannot react to this post.', 'FORBIDDEN')
    const all = db.all('reactions'); const had = all.find((r) => r.targetType === targetType && r.targetId === targetId && r.userId === actorId)
    if (had) db.save('reactions', all.filter((r) => r !== had))
    else { db.save('reactions', [...all, { id: newId('rx'), targetType, targetId, userId: actorId, createdAt: now() }]); if (owner !== actorId) await notify.create({ userId: owner, type: 'like', message: text, relatedId: p.id, link: '/' }) }
    const likes = db.all('reactions').filter((r) => r.targetType === targetType && r.targetId === targetId).length
    return { liked: !had, likes }
  },
  // Top-level comments oldest first, each with its replies (oldest first).
  async getComments(postId, actorId) {
    post(postId); const rx = db.all('reactions').filter((r) => r.targetType === 'comment')
    const shape = (c) => ({ ...c, author: slim(user(c.userId)), likes: rx.filter((r) => r.targetId === c.id).length, liked: rx.some((r) => r.targetId === c.id && r.userId === actorId) })
    const mine = db.all('comments').filter((c) => c.postId === postId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(shape)
    return mine.filter((c) => !c.parentId).map((c) => ({ ...c, replies: mine.filter((r) => r.parentId === c.id) }))
  },
  async addComment(actorId, postId, content, parentId = null) {
    const me = requireActive(actorId); const p = post(postId); const text = (content || '').trim()
    if (!text) fail('Write something first.'); if (text.length > MAX_COMMENT) fail(`Comments can be up to ${MAX_COMMENT} characters.`)
    if (blocked(actorId, p.userId)) fail('You cannot comment on this post.', 'FORBIDDEN')
    let parent = null
    if (parentId) { parent = db.all('comments').find((c) => c.id === parentId && c.postId === postId); if (!parent) fail('The comment you are replying to was removed.', 'NOT_FOUND'); if (parent.parentId) parent = db.all('comments').find((c) => c.id === parent.parentId) || parent }
    const c = { id: newId('c'), postId, userId: actorId, parentId: parent?.id || null, content: text, createdAt: now() }
    db.save('comments', [...db.all('comments'), c])
    const told = new Set([actorId])
    if (parent && !told.has(parent.userId)) { told.add(parent.userId); await notify.create({ userId: parent.userId, type: 'comment', message: `${me.username} replied to your comment.`, relatedId: postId, link: '/' }) }
    if (!told.has(p.userId)) await notify.create({ userId: p.userId, type: 'comment', message: `${me.username} commented on your post "${title(p)}".`, relatedId: postId, link: '/' })
    return { ...c, author: slim(me), likes: 0, liked: false, replies: [] }
  },
  // The commenter, the post owner or an admin can delete. Deleting a top-level comment removes its replies and their likes.
  async deleteComment(actorId, commentId) {
    const me = requireActive(actorId); const all = db.all('comments'); const c = all.find((x) => x.id === commentId); if (!c) fail('Comment not found.', 'NOT_FOUND')
    const p = db.all('posts').find((x) => x.id === c.postId)
    if (c.userId !== actorId && p?.userId !== actorId && me.role !== 'admin') fail('You cannot delete this comment.', 'FORBIDDEN')
    const gone = new Set([c.id, ...all.filter((x) => x.parentId === c.id).map((x) => x.id)])
    db.save('comments', all.filter((x) => !gone.has(x.id))); db.save('reactions', db.all('reactions').filter((r) => !(r.targetType === 'comment' && gone.has(r.targetId))))
  },
}

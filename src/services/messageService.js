import { db, newId, now, fail, requireActive } from './db.js'
import { notificationService as notify } from './notificationService.js'
export const conversationId = (a, b) => [a, b].sort().join('__')
const otherOf = (convId, uid) => convId.split('__').find((x) => x !== uid)
const prefOf = (uid, convId) => db.all('chatPrefs').find((p) => p.userId === uid && p.conversationId === convId) || { userId: uid, conversationId: convId, muted: false, pinned: false, clearedAt: '' }
const isBlocked = (a, b) => db.all('blocks').some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a))
const ACTIVE_PAID = ['paid', 'in_transit', 'delivered']
export const messageService = {
  async getConversations(uid) {
    const mine = db.all('messages').filter((m) => m.senderId === uid || m.receiverId === uid); const by = {}
    for (const m of mine) (by[m.conversationId] ||= []).push(m)
    const txs = db.all('transactions'); const posts = db.all('posts'); const users = db.all('users')
    return Object.entries(by).map(([id, all]) => {
      const pref = prefOf(uid, id); const ms = all.filter((m) => !pref.clearedAt || m.createdAt > pref.clearedAt)
      if (!ms.length) return null
      ms.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); const last = ms.at(-1); const otherId = otherOf(id, uid); const o = users.find((u) => u.id === otherId)
      const tx = txs.filter((t) => [t.requesterId, t.travelerId].every((x) => [uid, otherId].includes(x)) && t.transactionStatus !== 'cancelled').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
      const relId = [...ms].reverse().find((m) => m.relatedId)?.relatedId; const post = relId ? posts.find((p) => p.id === relId) || null : null
      return { id, otherId, otherUsername: o?.username, other: o ? { id: o.id, username: o.username, verified: o.verified, avatar: o.avatar } : null, last, tx, post, pinned: pref.pinned, muted: pref.muted,
        unread: ms.filter((m) => m.receiverId === uid && !m.read).length }
    }).filter(Boolean).sort((a, b) => (b.pinned - a.pinned) || b.last.createdAt.localeCompare(a.last.createdAt))
  },
  async getThread(uid, convId) { // marks received messages as read
    if (!convId.split('__').includes(uid)) fail('You cannot open this conversation.', 'FORBIDDEN')
    const all = db.all('messages'); let changed = false
    for (const m of all) if (m.conversationId === convId && m.receiverId === uid && !m.read) { m.read = true; changed = true }
    if (changed) db.save('messages', all)
    const cleared = prefOf(uid, convId).clearedAt
    return all.filter((m) => m.conversationId === convId && (!cleared || m.createdAt > cleared)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },
  async send(actorId, receiverId, content, relatedId = null) {
    const me = requireActive(actorId); const text = (content || '').trim(); if (!text) fail('Message cannot be empty.')
    if (text.length > 1000) fail('Message is too long (1000 characters max).')
    if (receiverId === actorId || !db.all('users').some((u) => u.id === receiverId)) fail('Choose a valid recipient.')
    if (isBlocked(actorId, receiverId)) fail('You can no longer message this user.', 'FORBIDDEN')
    const convId = conversationId(actorId, receiverId)
    const m = { id: newId('m'), conversationId: convId, senderId: actorId, receiverId, content: text, relatedId, read: false, createdAt: now() }
    db.save('messages', [...db.all('messages'), m])
    if (!prefOf(receiverId, convId).muted) await notify.create({ userId: receiverId, type: 'message', message: `New message from ${me.username}.`, relatedId: convId, link: `/messages/chat?with=${actorId}` })
    return m
  },
  async unreadCount(uid) { return db.all('messages').filter((m) => m.receiverId === uid && !m.read).length },
  // --- per-user chat settings
  async getPrefs(uid, convId) { const o = otherOf(convId, uid); return { ...prefOf(uid, convId), blocked: isBlocked(uid, o), blockedByMe: db.all('blocks').some((b) => b.blockerId === uid && b.blockedId === o) } },
  async setPref(uid, convId, patch) {
    if (!convId.split('__').includes(uid)) fail('You cannot change this conversation.', 'FORBIDDEN')
    const rows = db.all('chatPrefs'); const cur = rows.find((p) => p.userId === uid && p.conversationId === convId)
    if (cur) Object.assign(cur, patch); else rows.push({ ...prefOf(uid, convId), ...patch }); db.save('chatPrefs', rows)
  },
  async clear(uid, convId) { // hides history for this user only: everything up to the latest existing message
    const latest = db.all('messages').filter((m) => m.conversationId === convId).map((m) => m.createdAt).sort().at(-1) || now()
    await this.setPref(uid, convId, { clearedAt: latest, pinned: false })
  },
  async block(uid, otherId) {
    requireActive(uid); if (db.all('blocks').some((b) => b.blockerId === uid && b.blockedId === otherId)) return
    const live = db.all('transactions').some((t) => [t.requesterId, t.travelerId].every((x) => [uid, otherId].includes(x)) && ACTIVE_PAID.includes(t.transactionStatus))
    if (live) fail("You can't block while a payment is held for an active transaction.", 'CONFLICT')
    db.save('blocks', [...db.all('blocks'), { id: newId('b'), blockerId: uid, blockedId: otherId, createdAt: now() }])
  },
  async unblock(uid, otherId) { db.save('blocks', db.all('blocks').filter((b) => !(b.blockerId === uid && b.blockedId === otherId))) },
  async isBlocked(a, b) { return isBlocked(a, b) },
}

import { db, newId, now, fail, requireAdmin, requireActive } from './db.js'
import { notificationService as notify } from './notificationService.js'
import { transactionService } from './transactionService.js'
import { patchLegacyUser } from './actor.js'
const log = (adminId, text) => db.save('logs', [{ id: newId('l'), adminId, time: now(), text }, ...db.all('logs')])
export const reportService = {
  async create(actorId, { targetId, targetType, reason }) {
    requireActive(actorId); if (!['post', 'user', 'transaction'].includes(targetType) || !targetId) fail('Choose what you are reporting.')
    if (!(reason || '').trim()) fail('Please describe the reason.')
    const r = { id: newId('r'), reporterId: actorId, targetId, targetType, reason: reason.trim(), status: 'open', decision: '', createdAt: now() }; db.save('reports', [r, ...db.all('reports')]); return r
  },
  async getAll(adminId) { requireAdmin(adminId); return db.all('reports') },
  async resolve(id, adminId, decision, status = 'resolved') {
    requireAdmin(adminId); if (!(decision || '').trim()) fail('Record your decision.'); const all = db.all('reports'); const r = all.find((x) => x.id === id)
    if (!r || r.status !== 'open') fail('Report is not open.', 'INVALID_TRANSITION'); Object.assign(r, { status, decision: decision.trim() }); db.save('reports', all); log(adminId, `${status === 'resolved' ? 'Resolved' : 'Dismissed'} report ${r.targetType} ${r.targetId}: ${r.decision}`); return r
  },
}
export const adminService = {
  async stats(adminId) {
    requireAdmin(adminId); const users = db.all('users').filter((u) => u.role === 'user'); const tx = db.all('transactions'); const posts = db.all('posts'); const today = new Date().toISOString().slice(0, 10)
    const active = posts.filter((p) => p.status === 'active' && (p.type === 'request' ? p.neededDate : p.travelDate) >= today)
    const byStatus = {}; for (const t of tx) byStatus[t.transactionStatus] = (byStatus[t.transactionStatus] || 0) + 1
    const byMonth = {}; for (const u of users) { const k = u.createdAt.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + 1 }
    const actorIds = new Set(); posts.forEach((p) => actorIds.add(p.userId))
    return { totalUsers: users.length, travelers: new Set([...posts.filter((p) => p.type === 'trip').map((p) => p.userId), ...tx.map((t) => t.travelerId)]).size,
      requesters: new Set([...posts.filter((p) => p.type === 'request').map((p) => p.userId), ...tx.map((t) => t.requesterId)]).size, activePosts: active.length, totalTransactions: tx.length, byStatus, byMonth,
      postsByType: { 'Traveler offers': posts.filter((p) => p.type === 'trip' && p.status !== 'removed').length, 'Requester posts': posts.filter((p) => p.type === 'request' && p.status !== 'removed').length },
      activity: { Offers: db.all('offers').length, Messages: db.all('messages').length, Reviews: db.all('reviews').length, Reports: db.all('reports').length } }
  },
  async getLogs(adminId) { requireAdmin(adminId); return db.all('logs') },
  async setVerified(userId, flag, adminId) {
    requireAdmin(adminId); const all = db.all('users'); const u = all.find((x) => x.id === userId); if (!u) fail('User not found.', 'NOT_FOUND')
    const hasPending = db.all('verifications').some((v) => v.userId === userId && v.status === 'pending')
    const patch = { verified: flag, verificationStatus: flag ? 'verified' : hasPending ? 'pending' : 'unverified' }
    Object.assign(u, patch); db.save('users', all); patchLegacyUser(u.username, patch) // manual override: same result as an approved request
    log(adminId, `${flag ? 'Verified' : 'Removed verification from'} ${u.username}`)
    if (flag) await notify.create({ userId, type: 'verification', message: 'Your account received a verification badge.', link: '/profile' })
  },
  async setSuspended(userId, flag, adminId) {
    requireAdmin(adminId); const all = db.all('users'); const u = all.find((x) => x.id === userId); if (!u || u.role === 'admin') fail('This account cannot be suspended.', 'FORBIDDEN')
    u.accountStatus = flag ? 'suspended' : 'active'; db.save('users', all); log(adminId, `${flag ? 'Suspended' : 'Reactivated'} ${u.username}`)
  },
  async removePost(postId, adminId) {
    requireAdmin(adminId); const all = db.all('posts'); const p = all.find((x) => x.id === postId); if (!p) fail('Post not found.', 'NOT_FOUND'); p.status = 'removed'; db.save('posts', all)
    log(adminId, `Removed post "${p.title}"`); await notify.create({ userId: p.userId, type: 'post_removed', message: `Your post "${p.title}" was removed by an administrator.`, relatedId: p.id })
  },
  async resolveDispute(txId, outcome, adminId) { const t = await transactionService.resolveDispute(txId, adminId, outcome); log(adminId, `Resolved dispute ${txId} (${outcome}, simulated)`); return t },
  async getAllUsers(adminId) { requireAdmin(adminId); return db.all('users').map(({ password, ...u }) => u) },
  async getAllPosts(adminId) { requireAdmin(adminId); const { postService } = await import('./postService.js'); return postService.getAll({ status: 'all' }) },
  async getAllTransactions(adminId) { requireAdmin(adminId); return transactionService.getAll() },
}

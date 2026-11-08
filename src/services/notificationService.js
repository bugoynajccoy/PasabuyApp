import { db, newId, now, fail } from './db.js'
export const notificationService = {
  async create({ userId, type, message, relatedId = null, link = '' }) {
    const n = { id: newId('n'), userId, type, message, relatedId, link, isRead: false, createdAt: now() }
    db.save('notifications', [n, ...db.all('notifications')]); return n
  },
  async getForUser(userId) { return db.all('notifications').filter((n) => n.userId === userId) },
  async unreadCount(userId) { return db.all('notifications').filter((n) => n.userId === userId && !n.isRead).length },
  async markRead(id, userId) {
    const all = db.all('notifications'); const n = all.find((x) => x.id === id)
    if (!n || n.userId !== userId) fail('Notification not found.', 'NOT_FOUND')
    n.isRead = true; db.save('notifications', all); return n
  },
  async markAllRead(userId) { db.save('notifications', db.all('notifications').map((n) => (n.userId === userId ? { ...n, isRead: true } : n))) },
}

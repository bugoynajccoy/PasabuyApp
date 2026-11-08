import crypto from 'crypto'
import { q } from './db.js'
let io = null; export const setIo = (i) => { io = i }
export const notify = async (userId, type, message, relatedId = null, link = '') => {
  const id = crypto.randomUUID(); await q('INSERT INTO notifications (id,user_id,type,message,related_id,link) VALUES (?,?,?,?,?,?)', [id, userId, type, message, relatedId, link])
  io?.to(`user:${userId}`).emit('notification:new', { id, type, message, relatedId, link, isRead: false })
}
export const logAdmin = (adminId, action) => q('INSERT INTO admin_logs (admin_id,action) VALUES (?,?)', [adminId, action])

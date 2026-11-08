import { syncPush } from '../services/sync.js'
// Tiny localStorage "database" so a Node/Express API can replace it later (see services/ in a real backend).
export const load = (key, seed) => {
  try { const v = JSON.parse(localStorage.getItem(key)); if (v) return v } catch { /* ignore */ }
  localStorage.setItem(key, JSON.stringify(seed)); return seed
}
export const save = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); syncPush(key) }
export const logAction = (text) => {
  const logs = load('pb_logs', [])
  save('pb_logs', [{ id: Date.now(), time: new Date().toLocaleString(), actor: 'admin', text }, ...logs])
}

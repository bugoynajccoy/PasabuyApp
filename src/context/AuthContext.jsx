import { createContext, useContext, useState } from 'react'
import { load, save } from '../data/store.js'
import { seedUsers } from '../data/mockData.js'
import { syncActors } from '../services/actor.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pb_session') || sessionStorage.getItem('pb_session')) } catch { return null }
  })
  const users = () => load('pb_users', seedUsers)
  const persist = (user, remember) => {
    const s = { id: user.id, name: user.name, username: user.username, role: user.role }
    ;(remember ? localStorage : sessionStorage).setItem('pb_session', JSON.stringify(s)); setSession(s); return s
  }
  // Each returns { ok, error?, user? } so a real authService can replace these with fetch() calls.
  const login = (identifier, password, remember, adminOnly = false) => {
    const id = identifier.trim().toLowerCase()
    const user = users().find((u) => u.email.toLowerCase() === id || u.username.toLowerCase() === id)
    if (!user || user.password !== password) return { ok: false, error: 'Invalid email/username or password.' }
    if (adminOnly && user.role !== 'admin') return { ok: false, error: 'This account is not an administrator.' }
    if (user.status === 'suspended') return { ok: false, error: 'This account has been suspended.' }
    return { ok: true, user: persist(user, remember) }
  }
  const register = (f) => {
    const name = f.name.trim(); const username = f.username.trim(); const email = f.email.trim(); const phone = f.phone.trim()
    const FULL = { ok: false, error: "Could not save your account: this browser's storage is full or blocked. Free up space (or remove the profile picture) and try again." }
    let all; try { all = users() } catch { return FULL }
    if (all.some((u) => u.username.toLowerCase() === username.toLowerCase())) return { ok: false, error: 'Username is already taken.' }
    if (all.some((u) => u.email.toLowerCase() === email.toLowerCase())) return { ok: false, error: 'Email is already registered.' }
    const user = { id: Date.now(), name, username, email, password: f.password, phone, role: 'user', status: 'active', verified: false, type: 'Traveler', rating: 0, avatar: f.avatar || '', bio: '', createdAt: new Date().toISOString() }
    try { save('pb_users', [...all, user]) } catch { return FULL }
    try { syncActors() } catch { /* the account is saved; the service layer mirrors it on next use */ }
    return { ok: true }
  }
  const logout = () => { localStorage.removeItem('pb_session'); sessionStorage.removeItem('pb_session'); setSession(null) }
  return <AuthContext.Provider value={{ session, login, register, logout }}>{children}</AuthContext.Provider>
}

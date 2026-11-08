import { useEffect, useState } from 'react'
import useLive from './useLive.js'

const KEY = (id) => `pb_seen_${id}`
// Heartbeat: marks the logged-in user as "active now" while a tab is open.
export function useHeartbeat(userId) {
  useEffect(() => {
    if (!userId) return undefined
    const beat = () => { try { localStorage.setItem(KEY(userId), String(Date.now())) } catch { /* ignore */ } }
    beat(); const iv = setInterval(beat, 15000); window.addEventListener('focus', beat)
    return () => { clearInterval(iv); window.removeEventListener('focus', beat) }
  }, [userId])
}
const read = (id) => { try { return Number(localStorage.getItem(KEY(id))) || 0 } catch { return 0 } }
export function usePresence(otherId) {
  const [seen, setSeen] = useState(() => read(otherId))
  useEffect(() => { setSeen(read(otherId)) }, [otherId])
  useLive(() => setSeen(read(otherId)), { poll: 5000 })
  const [, tick] = useState(0); useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 15000); return () => clearInterval(i) }, [])
  if (!seen) return 'Offline'
  const mins = Math.floor((Date.now() - seen) / 60000)
  if (Date.now() - seen < 40000) return 'Active now'
  if (mins < 60) return `Active ${Math.max(mins, 1)}m ago`
  if (mins < 1440) return `Active ${Math.floor(mins / 60)}h ago`
  return 'Offline'
}

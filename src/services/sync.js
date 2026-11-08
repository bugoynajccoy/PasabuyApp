// Shares the localStorage "database" between browsers/devices through server/sync-server.mjs.
// localStorage stays the fast local cache; changes are sent as small deltas and pulled back every 2s.
// Off by default outside dev; set VITE_SYNC_URL (e.g. http://192.168.1.5:4000) to point at the server.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const BASE = String(env.VITE_SYNC_URL ?? (env.DEV && typeof location !== 'undefined' ? `http://${location.hostname}:4000` : '')).replace(/\/$/, '')
export const SYNC_ON = Boolean(BASE) && typeof localStorage !== 'undefined' && typeof window !== 'undefined' && typeof fetch === 'function'
const KEYS = ['pb2_users', 'pb2_posts', 'pb2_offers', 'pb2_transactions', 'pb2_reactions', 'pb2_comments', 'pb2_payments', 'pb2_messages', 'pb2_reviews', 'pb2_reports', 'pb2_verifications', 'pb2_notifications', 'pb2_logs', 'pb2_chatPrefs', 'pb2_blocks', 'pb_users']
const BY_USERNAME = new Set(['pb2_users', 'pb_users'])
const rowKey = (key, r) => BY_USERNAME.has(key) ? `u:${String(r.username || '').toLowerCase()}` : key === 'pb2_chatPrefs' ? `${r.userId}|${r.conversationId}` : String(r.id ?? JSON.stringify(r))
const readLocal = (key) => { try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : [] } catch { return [] } }
const snapshot = (key, rows) => new Map(rows.map((r) => [rowKey(key, r), JSON.stringify(r)]))
const seen = {} // key -> Map(rowKey -> json) as last known to be on the server
let rev = 0; let inflight = 0; let chain = Promise.resolve(); let started = false
const emit = (key) => { try { window.dispatchEvent(new CustomEvent('pb:data', { detail: key })) } catch { /* ignore */ } }
const call = async (path, opts, ms = 4000) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); try { const r = await fetch(BASE + path, { ...opts, signal: c.signal }); if (!r.ok) throw new Error(String(r.status)); return await r.json() } finally { clearTimeout(t) } }

export function syncPush(key) {
  if (!SYNC_ON || !started || !KEYS.includes(key)) return
  const rows = readLocal(key); const was = seen[key] || new Map(); const now = snapshot(key, rows)
  const upserts = rows.filter((r) => was.get(rowKey(key, r)) !== now.get(rowKey(key, r)))
  const deletes = [...was.keys()].filter((k) => !now.has(k))
  if (!upserts.length && !deletes.length) return
  seen[key] = now; inflight++
  chain = chain.then(() => call(`/store/${key}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upserts, deletes }) }, 8000))
    .catch(() => { seen[key] = was }) // server unreachable: next save/poll retries the same delta
    .finally(() => { inflight-- })
}

function apply(data) {
  for (const key of KEYS) {
    if (!data[key]) continue
    const json = JSON.stringify(data[key])
    if (json !== JSON.stringify(readLocal(key))) { localStorage.setItem(key, json); emit(key) }
    seen[key] = snapshot(key, data[key])
  }
}
async function pull() {
  if (inflight > 0) return
  try {
    const r = await call(`/store?since=${rev}`); if (r.unchanged || inflight > 0) return
    rev = r.rev; apply(r.data)
  } catch { /* offline: keep working locally */ }
}

// Call once before the app renders: adopts what the server already has, then uploads anything only this browser has.
export async function initSync() {
  if (!SYNC_ON || started) return
  try {
    const r = await call('/store', {}, 2500); rev = r.rev
    for (const key of KEYS) {
      const server = r.data[key]; const local = readLocal(key)
      if (!server) { if (local.length) { seen[key] = new Map(); started = true; syncPush(key) } continue }
      const have = new Set(server.map((x) => rowKey(key, x))); const extra = local.filter((x) => !have.has(rowKey(key, x)))
      localStorage.setItem(key, JSON.stringify([...server, ...extra])); seen[key] = snapshot(key, server); started = true
      if (extra.length) syncPush(key)
    }
    started = true
  } catch { return } // server not running: stay local-only
  setInterval(pull, 2000); window.addEventListener('focus', pull); document.addEventListener('visibilitychange', pull)
}

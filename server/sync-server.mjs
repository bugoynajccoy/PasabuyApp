// Tiny shared data server so different browsers/devices see the same users, messages and notifications.
// Run: npm run sync   (listens on :4000, stores data in server/data.json). No dependencies.
import http from 'http'; import fs from 'fs'
const PORT = process.env.SYNC_PORT || 4000
const FILE = new URL('./data.json', import.meta.url)
const KEYS = new Set(['pb2_users', 'pb2_posts', 'pb2_offers', 'pb2_transactions', 'pb2_reactions', 'pb2_comments', 'pb2_payments', 'pb2_messages', 'pb2_reviews', 'pb2_reports', 'pb2_verifications', 'pb2_notifications', 'pb2_logs', 'pb2_chatPrefs', 'pb2_blocks', 'pb_users'])
const BY_USERNAME = new Set(['pb2_users', 'pb_users'])
let state = { rev: 1, keys: {} } // keys[key] = { rows: { rowKey: row } }
try { state = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { /* first run */ }
let timer = null
const persist = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFile(FILE, JSON.stringify(state), () => {}), 300) }
const rowKey = (key, r) => BY_USERNAME.has(key) ? `u:${String(r.username || '').toLowerCase()}` : key === 'pb2_chatPrefs' ? `${r.userId}|${r.conversationId}` : String(r.id ?? JSON.stringify(r))
const list = (key) => { const rows = Object.values(state.keys[key]?.rows || {}); return key === 'pb2_notifications' ? rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) : rows }
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(body === undefined ? '' : JSON.stringify(body)) }
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') return send(res, 204)
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true })
  if (req.method === 'GET' && url.pathname === '/store') {
    if (Number(url.searchParams.get('since')) === state.rev) return send(res, 200, { rev: state.rev, unchanged: true })
    const data = {}; for (const k of Object.keys(state.keys)) data[k] = list(k)
    return send(res, 200, { rev: state.rev, data })
  }
  const m = url.pathname.match(/^\/store\/([\w]+)$/)
  if (req.method === 'PATCH' && m && KEYS.has(m[1])) {
    let body = ''; req.on('data', (c) => { body += c; if (body.length > 8e6) req.destroy() })
    req.on('end', () => {
      try {
        const { upserts = [], deletes = [] } = JSON.parse(body); const key = m[1]; const rows = (state.keys[key] ||= { rows: {} }).rows
        for (const r of upserts) {
          const k = rowKey(key, r); const old = rows[k]; const next = { ...r }
          if (old) { if (BY_USERNAME.has(key)) next.id = old.id; if (old.read && 'read' in next) next.read = true; if (old.isRead && 'isRead' in next) next.isRead = true } // never un-read, never change an account's id
          rows[k] = next
        }
        for (const k of deletes) delete rows[k]
        state.rev++; persist(); send(res, 200, { rev: state.rev })
      } catch { send(res, 400, { error: 'Bad request' }) }
    }); return
  }
  send(res, 404, { error: 'Not found' })
}).listen(PORT, '0.0.0.0', () => console.log(`Pasabuy sync server on :${PORT}`))

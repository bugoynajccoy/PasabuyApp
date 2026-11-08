import useUnread from '../hooks/useUnread.js'

// Small red count on the bell / chat icons. kind: 'notifications' | 'messages'. `inline` = sits after a text label (desktop sidebar).
export default function UnreadBadge({ kind, inline = false }) {
  const n = useUnread()[kind]
  if (!n) return null
  const label = n > 9 ? '9+' : String(n)
  return inline
    ? <span className="badge rounded-pill bg-danger ms-2" aria-label={`${n} unread`}>{label}</span>
    : <span className="position-absolute badge rounded-pill bg-danger" style={{ top: 2, right: 0, fontSize: '0.6rem', padding: '0.25em 0.45em' }} aria-label={`${n} unread`}>{label}</span>
}

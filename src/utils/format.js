export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH')}`
export const initial = (name) => (name || '?').trim().charAt(0).toUpperCase()
export const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso); return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }) }
export function timeAgo(iso) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
// Shrinks a chosen photo to a small JPEG data URL so it fits in localStorage.
export function readImage(file, max = 800) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Could not read that image.'))
    r.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a valid image.'))
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.72))
      }
      img.src = r.result
    }
    r.readAsDataURL(file)
  })
}
export const POSTS_CHANGED = 'pb:posts-changed'
export const notifyPostsChanged = () => window.dispatchEvent(new Event(POSTS_CHANGED))

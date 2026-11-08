import { useEffect, useRef } from 'react'

// Runs `refresh` whenever stored data changes: in this tab (db.save emits 'pb:data') or in another tab/window (native 'storage' event).
// A slow poll is a safety net for browsers that miss storage events.
export default function useLive(refresh, { poll = 4000 } = {}) {
  const ref = useRef(refresh); ref.current = refresh
  useEffect(() => {
    let t = null
    const run = () => { clearTimeout(t); t = setTimeout(() => ref.current(), 30) }
    const onStorage = (e) => { if (!e.key || e.key.startsWith('pb2_') || e.key.startsWith('pb_')) run() }
    window.addEventListener('pb:data', run); window.addEventListener('storage', onStorage)
    const iv = poll ? setInterval(run, poll) : null
    return () => { clearTimeout(t); clearInterval(iv); window.removeEventListener('pb:data', run); window.removeEventListener('storage', onStorage) }
  }, [poll])
}

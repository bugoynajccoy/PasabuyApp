import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { postService, userService } from '../services/index.js'
import useActor from '../hooks/useActor.js'
import { initial, peso, POSTS_CHANGED } from '../utils/format.js'

const SearchContext = createContext({ query: '', setQuery: () => {}, openSearch: () => {} })
export const useSearch = () => useContext(SearchContext)

const MAX_RECENT = 6

function Sheet({ onClose, onApply }) {
  const actor = useActor(); const navigate = useNavigate()
  const key = `pb_recent_${actor}`
  const [text, setText] = useState('')
  const [posts, setPosts] = useState([])
  const [people, setPeople] = useState([])
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] } })
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  useEffect(() => { let on = true; postService.getAll({}).then((p) => on && setPosts(p)); return () => { on = false } }, [])
  useEffect(() => { let on = true; if (actor) userService.search(actor, text).then((p) => on && setPeople(p)); return () => { on = false } }, [actor, text])
  const go = (path) => { onClose(); navigate(path) }

  const saveRecent = (list) => { setRecent(list); try { localStorage.setItem(key, JSON.stringify(list)) } catch { /* ignore */ } }
  const apply = (q) => {
    const v = q.trim()
    if (v) saveRecent([v, ...recent.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, MAX_RECENT))
    onApply(v)
  }

  const s = text.trim().toLowerCase()
  const results = useMemo(() => !s ? [] : posts.filter((p) => [p.title, p.origin, p.destination, p.description, p.author?.username].some((x) => (x || '').toLowerCase().includes(s))), [posts, s])
  const popular = useMemo(() => {
    const c = {}; posts.forEach((p) => { c[p.destination] = (c[p.destination] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([d]) => d)
  }, [posts])

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-end align-items-md-center justify-content-center" style={{ zIndex: 2000, background: 'rgba(0,0,0,.45)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Search">
      <div className="bg-white rounded-top-4 rounded-bottom-md-4 w-100 d-flex flex-column" style={{ maxWidth: 520, maxHeight: '85vh' }}>
        <div className="d-flex justify-content-between align-items-center p-3 pb-2">
          <h1 className="fw-bold navbar-brand text-black m-0">Search<span className="text-warning">.</span></h1>
          <button type="button" className="btn btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="p-3 pt-1 overflow-auto">
          <form onSubmit={(e) => { e.preventDefault(); apply(text) }}>
            <input ref={inputRef} type="search" className="form-control rounded-5 mb-3" placeholder="Search items, places, people" value={text} onChange={(e) => setText(e.target.value)} style={{ border: '2px solid rgba(128,128,128,.13)' }} />
          </form>

          {people.length > 0 && (<>
            <h6 className="mb-2">{s ? 'People' : 'People on Pasabuy'}</h6>
            <div className="d-flex flex-column mb-3">
              {people.slice(0, s ? 5 : 4).map((u) => (
                <div key={u.id} className="d-flex gap-2 align-items-center px-1 py-2" style={{ borderBottom: '1px solid rgba(128,128,128,.13)' }}>
                  <button type="button" className="btn p-0 border-0 d-flex gap-2 align-items-center text-start flex-grow-1 min-w-0" onClick={() => go(`/profile?user=${u.id}`)}>
                    <div className="bg-primary text-light fw-bold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 overflow-hidden" style={{ width: 40, height: 40 }}>{u.avatar ? <img src={u.avatar} alt="" className="w-100 h-100" style={{ objectFit: 'cover' }} /> : initial(u.username)}</div>
                    <div className="d-flex flex-column min-w-0"><span className="fw-bold text-black text-truncate">{u.username}{u.verified && <span className="ms-1 text-primary"><svg className="bi bi-sm align-middle"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-patch-check`} /></svg></span>}</span><small className="text-secondary text-truncate">{u.name}{u.location ? ` · ${u.location}` : ''}</small></div>
                  </button>
                  <button type="button" className="btn btn-warning btn-sm fw-bold flex-shrink-0" onClick={() => go(`/messages/chat?with=${u.id}`)}>Message</button>
                </div>
              ))}
            </div>
          </>)}

          {s ? (<>
            {results.length === 0 ? (people.length === 0 ? <p className="text-secondary text-center my-4">No posts or people match “{text.trim()}”.</p> : null) : (<>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="m-0">{results.length} result{results.length === 1 ? '' : 's'}</h6>
                <button className="btn btn-warning btn-sm fw-bold" onClick={() => apply(text)}>Show in feed</button>
              </div>
              <div className="d-flex flex-column">
                {results.slice(0, 8).map((p) => (
                  <button key={p.id} type="button" onClick={() => apply(text)} className="btn text-start d-flex gap-2 align-items-center px-1 py-2 border-0 rounded-0" style={{ borderBottom: '1px solid rgba(128,128,128,.13)' }}>
                    <div className="bg-primary text-light fw-bold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40 }}>{initial(p.author?.username)}</div>
                    <div className="d-flex flex-column flex-grow-1 min-w-0">
                      <span className="fw-bold text-black text-truncate">{p.type === 'request' ? p.title : `${p.origin} ⟼ ${p.destination}`}</span>
                      <small className="text-secondary text-truncate">{p.author?.username} · {p.type === 'request' ? `Request · ${p.origin} ⟼ ${p.destination}` : `Trip · from ${peso(p.serviceFee)}`}</small>
                    </div>
                    <span className={`badge rounded-pill ${p.type === 'request' ? 'bg-primary' : 'bg-warning'} bg-opacity-25 ${p.type === 'request' ? 'text-primary' : 'text-warning'}`}>{p.type === 'request' ? 'Request' : 'Trip'}</span>
                  </button>
                ))}
              </div>
            </>)}
          </>) : (<>
            {recent.length > 0 && (<>
              <div className="d-flex justify-content-between mb-2 align-items-center">
                <h6 className="m-0">Recent searches</h6>
                <button className="btn text-warning btn-sm rounded-4" onClick={() => saveRecent([])}>Clear all</button>
              </div>
              <div className="row g-2 mb-3">
                {recent.map((r) => (
                  <div key={r} className="col-12 d-flex justify-content-between align-items-center">
                    <button type="button" className="btn p-0 border-0 d-flex gap-2 text-start" onClick={() => apply(r)}>
                      <svg className="bi bi-md align-middle text-secondary"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-clock`} /></svg>{r}
                    </button>
                    <button type="button" className="btn btn-close" aria-label={`Remove ${r}`} onClick={() => saveRecent(recent.filter((x) => x !== r))} />
                  </div>
                ))}
              </div>
            </>)}
            {popular.length > 0 ? (<>
              <h6>Popular destinations</h6>
              <div className="row g-1">
                {popular.map((d) => (
                  <div key={d} className="col-auto">
                    <button type="button" className="btn btn-dark btn-sm rounded-5" onClick={() => apply(d)}>
                      <svg className="bi bi-md align-middle"><use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-geo-alt`} /></svg> {d}
                    </button>
                  </div>
                ))}
              </div>
            </>) : (people.length === 0 && <p className="text-secondary text-center my-4">No posts to search yet.</p>)}
          </>)}
        </div>
      </div>
    </div>
  )
}

export function SearchProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate(); const { pathname } = useLocation()
  const openSearch = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  const onApply = (q) => { setQuery(q); setOpen(false); if (pathname !== '/' && pathname !== '/mobile') navigate('/') }

  // Any search trigger (sidebar link, bottom-nav icon) opens the sheet instead of the old Bootstrap panel.
  useEffect(() => {
    const h = (e) => {
      const t = e.target.closest?.('[data-bs-target="#SearchCanvas"],a[href="#search"]'); if (!t) return
      e.preventDefault(); e.stopPropagation(); setOpen(true)
    }
    document.addEventListener('click', h, true); return () => document.removeEventListener('click', h, true)
  }, [])
  useEffect(() => { setOpen(false) }, [pathname])
  return <SearchContext.Provider value={{ query, setQuery, openSearch }}>{children}{open && <Sheet onClose={close} onApply={onApply} />}</SearchContext.Provider>
}

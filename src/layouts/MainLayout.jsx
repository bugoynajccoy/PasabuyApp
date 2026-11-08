import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ComposerProvider } from '../components/PostComposer.jsx'
import { SearchProvider } from '../components/SearchSheet.jsx'
import SidebarNav from '../components/SidebarNav.jsx'
import useActor from '../hooks/useActor.js'
import { useHeartbeat } from '../hooks/usePresence.js'

// Clears leftover Bootstrap backdrops when navigating between converted pages.
export default function MainLayout() {
  const { pathname } = useLocation()
  useHeartbeat(useActor())
  useEffect(() => {
    document.querySelectorAll('.modal-backdrop,.offcanvas-backdrop').forEach((el) => el.remove())
    document.body.classList.remove('modal-open', 'offcanvas-backdrop'); document.body.removeAttribute('style')
  }, [pathname])
  // Home and /mobile draw the sidebar inside their own grid; every other page gets it here (hidden on phones, which use the bottom bar).
  const ownsSidebar = pathname === '/' || pathname === '/mobile'
  return (
    <SearchProvider><ComposerProvider>
      {ownsSidebar ? <Outlet /> : (
        <div className="container-fluid"><div className="row">
          <aside className="position-sticky top-0 vh-100 overflow-auto col-lg-2 list-group list-group-flush bg-white text-black p-2 d-none d-lg-block" id="sidebar" style={{ alignSelf: 'flex-start' }}><SidebarNav /></aside>
          <div className="col-12 col-lg-10 p-0"><Outlet /></div>
        </div></div>
      )}
    </ComposerProvider></SearchProvider>
  )
}

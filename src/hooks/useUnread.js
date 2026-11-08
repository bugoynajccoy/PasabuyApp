import { useCallback, useEffect, useState } from 'react'
import { notificationService, messageService } from '../services/index.js'
import useActor from './useActor.js'
import useLive from './useLive.js'

// Live unread counts for the bell and chat icons.
export default function useUnread() {
  const actor = useActor(); const [c, setC] = useState({ notifications: 0, messages: 0 })
  const load = useCallback(async () => {
    if (!actor) return
    const [notifications, messages] = await Promise.all([notificationService.unreadCount(actor), messageService.unreadCount(actor)])
    setC((p) => (p.notifications === notifications && p.messages === messages ? p : { notifications, messages }))
  }, [actor])
  useEffect(() => { load() }, [load])
  useLive(load)
  return c
}

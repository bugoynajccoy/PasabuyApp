import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { resolveActorId } from '../services/actor.js'

// Returns the service-layer user id of whoever is logged in (or null).
export default function useActor() {
  const { session } = useAuth()
  return useMemo(() => resolveActorId(session), [session])
}

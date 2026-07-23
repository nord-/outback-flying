import { useEffect, useState } from 'react'
import { useGame } from './game/store'

/**
 * Tracks whether the persisted game has finished rehydrating from storage.
 *
 * With the IndexedDB-backed store, rehydration is asynchronous: on first render
 * the store still holds its initial (empty) state. Components that branch on
 * "is there a saved game?" must wait for this to be true first.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useGame.persist.hasHydrated())

  useEffect(() => {
    // Cover the window between the initial render and this effect running.
    if (useGame.persist.hasHydrated()) setHydrated(true)
    const unsub = useGame.persist.onFinishHydration(() => setHydrated(true))
    return unsub
  }, [])

  return hydrated
}

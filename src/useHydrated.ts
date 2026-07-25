import { useEffect, useState } from 'react'
import { useGame, getHydrationError, onHydrationError } from './game/store'

/**
 * Tracks whether the persisted game has finished rehydrating from storage.
 *
 * With the IndexedDB-backed store, rehydration is asynchronous: on first render
 * the store still holds its initial (empty) state. Components that branch on
 * "is there a saved game?" must wait for `hydrated` first.
 *
 * `error` is set when rehydration failed (corrupt save, migration throw). In
 * that case `hydrated` never becomes true — persist's onFinishHydration does
 * not fire on failure — so callers must offer a recovery path instead of
 * waiting forever.
 */
export function useHydrated(): { hydrated: boolean; error: unknown } {
  const [hydrated, setHydrated] = useState(() => useGame.persist.hasHydrated())
  const [error, setError] = useState<unknown>(() => getHydrationError())

  useEffect(() => {
    // Cover the window between the initial render and this effect running.
    if (useGame.persist.hasHydrated()) setHydrated(true)
    setError(getHydrationError())
    const unsubHydration = useGame.persist.onFinishHydration(() => setHydrated(true))
    const unsubError = onHydrationError((err) => setError(err))
    return () => {
      unsubHydration()
      unsubError()
    }
  }, [])

  return { hydrated, error }
}

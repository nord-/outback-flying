import { useCallback, useEffect, useState } from 'react'
import type { SimConnStatus, SimConnectOptions, SimConnectResult, SimSample } from './types'

/**
 * React access to the SimConnect bridge. Feature-detects `window.outback.sim`:
 * in the web build (no bridge) `available` is false and status stays
 * 'unavailable', so callers can simply render nothing.
 */
export function useSim() {
  const sim = typeof window !== 'undefined' ? window.outback?.sim : undefined
  const available = !!sim

  const [status, setStatus] = useState<SimConnStatus>(available ? 'disconnected' : 'unavailable')
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [sample, setSample] = useState<SimSample | null>(null)

  useEffect(() => {
    if (!sim) return
    let eventReceived = false
    const offStatus = sim.onStatus((e) => {
      eventReceived = true
      setStatus(e.status)
      setMessage(e.message)
      if (e.status !== 'connected') setSample(null)
    })
    const offSample = sim.onSample((s) => setSample(s))
    // Sync the current status in case a connection predates this mount —
    // but skip it if a live onStatus event already landed first, since that
    // snapshot would otherwise overwrite a fresher status with a stale one.
    sim
      .getStatus()
      .then((s) => {
        if (!eventReceived) setStatus(s.status)
      })
      .catch(() => {})
    return () => {
      offStatus()
      offSample()
    }
  }, [sim])

  const connect = useCallback(
    (options?: SimConnectOptions): Promise<SimConnectResult> => {
      if (!sim) {
        return Promise.resolve({ ok: false, message: 'SimConnect is only available in the desktop app.' })
      }
      return sim.connect(options)
    },
    [sim]
  )

  const disconnect = useCallback(() => sim?.disconnect() ?? Promise.resolve({ ok: true }), [sim])

  return { available, status, message, sample, connect, disconnect }
}

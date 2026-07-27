import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { useSim } from './useSim'
import { useGame } from '../game/store'
import { useUI } from '../components/ui'
import { isOverAnyLimit, wouldBeOver } from '../game/duty'
import type { SimSample } from './types'
import {
  initSessionState,
  reduceSession,
  resolveChoice,
  type SimSessionState,
  type SessionCtx,
  type SessionEffect,
} from '../game/simSession'

// Session state lives in a tiny store of its own (not persisted) so any
// component can subscribe without threading props from App.
interface SessionStore {
  session: SimSessionState
  set: (s: SimSessionState) => void
}
const useSession = create<SessionStore>((set) => ({
  session: initSessionState(),
  set: (session) => set({ session }),
}))

export const useSessionState = () => useSession((s) => s.session)

/**
 * The one always-on wiring point (D15): folds live samples through the pure
 * session reducer and applies its effects to the store. Mounted ONCE in App.
 */
export function useSimSession(): { choose: (aircraftId: string) => void } {
  const { status, sample } = useSim()
  const { notify } = useUI()
  const busyRef = useRef(false) // one setFuel write at a time

  useEffect(() => {
    if (status !== 'connected') {
      // Disconnect: finalize the chain; warn if a leg was in flight (§8).
      const s = useSession.getState().session
      if (s.recorder?.currentLeg) notify("⚠ Tracking lost mid-leg — that leg won't count. Land, then reconnect on the ground.")
      if (s.phase !== 'UNMATCHED') useGame.getState().finalizeChain()
      useSession.getState().set(initSessionState())
    }
  }, [status, notify])

  useEffect(() => {
    if (status !== 'connected' || !sample) return
    const game = useGame.getState().game
    if (!game) return
    const ctx: SessionCtx = {
      fleet: game.fleet,
      regionId: game.regionId,
      pilotLocationIcao: game.pilotLocationIcao,
      pilotOffField: game.pilotOffField,
    }
    const prev = useSession.getState().session
    const { state, effects } = reduceSession(prev, sample, ctx)
    useSession.getState().set(state)
    for (const e of effects) applyEffect(e, state, sample, notify, busyRef)
  }, [sample, status, notify])

  return { choose: (aircraftId) => useSession.getState().set(resolveChoice(useSession.getState().session, aircraftId)) }
}

function applyEffect(
  e: SessionEffect,
  state: SimSessionState,
  sample: SimSample,
  notify: (m: string) => void,
  busyRef: { current: boolean }
) {
  const store = useGame.getState()
  switch (e.kind) {
    case 'WARN':
      notify(`⚠ ${e.message}`)
      // A mid-session aircraft swap ends the chain the same way a disconnect
      // does — the OpenChain doc comment promises finalization on re-match.
      if (e.code === 'aircraft-swapped') store.finalizeChain()
      break
    case 'NEED_CHOICE':
      break // rendered by AircraftChoiceDialog off session.pendingChoice
    case 'OFF_BLOCK': {
      if (!state.aircraftId || !sample) break
      store.beginChain(state.aircraftId, sample.title, sample.atcModel)
      if (e.icao) {
        const { messages } = store.armMissions(state.aircraftId, e.icao, sample.t)
        messages.forEach(notify)
      }
      // D13: the pre-flight duty warnings lived in the removed modals — warn at
      // departure both when already over a limit and when a typical leg
      // (~90 min duty) would cross one.
      const g = useGame.getState().game
      if (g) {
        if (isOverAnyLimit(g.dutyLog, g.day))
          notify('⚠ You are over a duty limit — completing missions now forfeits their reward.')
        else if (wouldBeOver(g.dutyLog, g.day, 90))
          notify('⚠ Close to a duty limit — this flight may push you over.')
      }
      break
    }
    case 'STOP_AT': {
      if (!state.aircraftId) break
      const { messages } = store.stopAt(state.aircraftId, e.icao, sample.t)
      messages.forEach(notify)
      break
    }
    case 'ON_BLOCK': {
      if (!state.aircraftId) break
      const { messages } = store.commitLeg({
        aircraftId: state.aircraftId,
        atT: sample.t,
        leg: e.leg,
        simFuelL: e.simFuelL,
        pos: e.pos,
        externalFuelL: e.externalFuelL,
        landings: e.landings,
        track: e.track,
        simTitle: e.simTitle,
        simAtcModel: e.simAtcModel,
      })
      messages.forEach(notify)
      break
    }
    case 'SYNC_TO_SIM': {
      if (busyRef.current) break
      const setFuel = window.outback?.sim?.setFuel
      if (!setFuel) break // web build / bridge not injected — nothing to sync
      busyRef.current = true
      void setFuel(e.fuelL)
        .then((r) => {
          if (r && !r.ok) notify(`⚠ Fuel sync failed: ${r.message ?? 'unknown error'} — set fuel in the sim manually.`)
        })
        .catch(() => notify('⚠ Fuel sync call failed — set fuel in the sim manually.'))
        .finally(() => {
          busyRef.current = false
        })
      break
    }
  }
}

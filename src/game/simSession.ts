// Pure always-on sim-session state machine (#20). Interprets the live sample
// stream — matching (D1/D2), fuel authority (D3/D7), block events (D8) — and
// emits effects; ALL mutation happens in the store via those effects. Same
// reducer style as flightlog.ts: no React, no I/O, unit-testable.
import type { GeoPos, OwnedAircraft, FlightLeg, TrackPoint } from './types'
import type { SimSample } from '../sim/types'
import { getSpec } from '../data/aircraft'
import { distanceNm } from './geo'
import {
  nearestAirport,
  matchesAircraft,
  simCapacityL,
  initRecorderState,
  recordSample,
  simplifyTrack,
  isPlausibleSample,
  GALLONS_TO_LITRES,
  STATIONARY_KTS,
  type RecorderState,
} from './flightlog'

export type SessionPhase = 'UNMATCHED' | 'GROUND_SECURE' | 'SIM_ACTIVE'

export type WarnCode =
  | 'wrong-position'
  | 'no-matching-aircraft'
  | 'engines-running-divergence'
  | 'mid-air-attach'
  | 'aircraft-swapped'
  | 'sync-failed'
  | 'mid-leg-disconnect'

export interface SessionCtx {
  fleet: OwnedAircraft[]
  regionId: string
  pilotLocationIcao: string
  pilotOffField?: GeoPos
}

export interface SimSessionState {
  phase: SessionPhase
  aircraftId: string | null
  pendingChoice: string[] | null
  recorder: RecorderState | null
  seedExternalL: number // pre-connect sim-menu fuel, billed at on-block (D11)
  stopArmed: boolean // STOP_AT fires once per stop; re-armed by getting airborne
  syncInFlight: boolean // one SYNC_TO_SIM per divergence episode (D3)
  warned: Partial<Record<WarnCode, true>> // one warning per condition per session
  lastSample: SimSample | null
}

export type SessionEffect =
  | { kind: 'SYNC_TO_SIM'; fuelL: number }
  | { kind: 'OFF_BLOCK'; icao: string | null }
  | { kind: 'STOP_AT'; icao: string }
  | {
      kind: 'ON_BLOCK'
      leg: FlightLeg
      simFuelL: number
      pos: { icao: string } | GeoPos
      externalFuelL: number
      landings: number
      track: TrackPoint[]
      simTitle: string
      simAtcModel: string
    }
  | { kind: 'NEED_CHOICE'; candidateIds: string[] }
  | { kind: 'WARN'; code: WarnCode; message: string }

export const OFF_FIELD_TOLERANCE_NM = 5

export function initSessionState(): SimSessionState {
  return {
    phase: 'UNMATCHED',
    aircraftId: null,
    pendingChoice: null,
    recorder: null,
    seedExternalL: 0,
    stopArmed: false,
    syncInFlight: false,
    warned: {},
    lastSample: null,
  }
}

/** Divergence tolerance in litres: max(0.5 gal, 2% of capacity) — D6. */
export function fuelToleranceL(ac: OwnedAircraft, sample: SimSample): number {
  const capL = simCapacityL(getSpec(ac.specId), sample) ?? getSpec(ac.specId).fuelCapacityL
  return Math.max(0.5 * GALLONS_TO_LITRES, capL * 0.02)
}

/** Positive divergence to seed as billable external fuel when SIM_ACTIVE
 *  starts measuring (D11) — shared by a fresh UNMATCHED attach and an
 *  ordinary GROUND_SECURE off-block. Any outstanding excess the sim is
 *  carrying over the game's tank gets billed here instead of leaking in for
 *  free — including excess left over from a SYNC_TO_SIM write that failed
 *  (#22 review: a modern [FUEL_SYSTEM] aircraft ignores that write, so the
 *  divergence is otherwise never resolved and never billed). */
function seedFromDivergence(ac: OwnedAircraft, sample: SimSample): number {
  const simFuelL = sample.fuelGal * GALLONS_TO_LITRES
  return Math.max(0, simFuelL - ac.fuelL - fuelToleranceL(ac, sample))
}

/** Is the sim where the game says the pilot is? (D1/D2) */
function simAtPilotPosition(sample: SimSample, ctx: SessionCtx): boolean {
  if (ctx.pilotOffField) return distanceNm(sample, ctx.pilotOffField) <= OFF_FIELD_TOLERANCE_NM
  return nearestAirport(sample.lat, sample.lon, ctx.regionId)?.icao === ctx.pilotLocationIcao
}

/** Fleet aircraft co-located with the pilot whose spec matches the sim's report. */
function candidates(sample: SimSample, ctx: SessionCtx): OwnedAircraft[] {
  return ctx.fleet.filter((ac) => {
    const colocated = ctx.pilotOffField
      ? !!ac.offField && distanceNm(ac.offField, ctx.pilotOffField) <= OFF_FIELD_TOLERANCE_NM
      : !ac.offField && ac.locationIcao === ctx.pilotLocationIcao
    return colocated && matchesAircraft(getSpec(ac.specId), sample)
  })
}

function warnOnce(
  state: SimSessionState,
  effects: SessionEffect[],
  code: WarnCode,
  message: string
): SimSessionState {
  if (state.warned[code]) return state
  effects.push({ kind: 'WARN', code, message })
  return { ...state, warned: { ...state.warned, [code]: true } }
}

/** Enter the matched phases from an UNMATCHED state (or after resolveChoice). */
function enterMatched(
  state: SimSessionState,
  sample: SimSample,
  ctx: SessionCtx,
  ac: OwnedAircraft,
  effects: SessionEffect[]
): SimSessionState {
  if (sample.enginesOn || !sample.onGround) {
    // SIM_ACTIVE attach: sim is truth. Positive divergence = pre-connect
    // sim-menu fuel — seed it for billing (D11); negative = warn (D3).
    const simFuelL = sample.fuelGal * GALLONS_TO_LITRES
    const tol = fuelToleranceL(ac, sample)
    const seed = seedFromDivergence(ac, sample)
    let next: SimSessionState = {
      ...state,
      phase: 'SIM_ACTIVE',
      aircraftId: ac.id,
      pendingChoice: null,
      recorder: recordSample(initRecorderState(ctx.regionId), sample),
      seedExternalL: seed,
      stopArmed: false,
    }
    if (simFuelL < ac.fuelL - tol) {
      next = warnOnce(next, effects, 'engines-running-divergence',
        'The sim has less fuel than your tank — shut down on the ground to sync, or the difference is lost.')
    }
    if (!sample.onGround) {
      next = warnOnce(next, effects, 'mid-air-attach',
        'Connected mid-air — the departure field is unknown, so no mission was armed for this flight.')
    } else {
      effects.push({ kind: 'OFF_BLOCK', icao: nearestAirport(sample.lat, sample.lon, ctx.regionId)?.icao ?? null })
    }
    return next
  }
  return {
    ...state,
    phase: 'GROUND_SECURE',
    aircraftId: ac.id,
    pendingChoice: null,
    recorder: null,
    seedExternalL: 0,
    stopArmed: false,
  }
}

export function resolveChoice(state: SimSessionState, aircraftId: string): SimSessionState {
  if (!state.pendingChoice?.includes(aircraftId)) return state
  // aircraftId is remembered; the next sample completes the entry via reduceSession.
  return { ...state, aircraftId, pendingChoice: null }
}

export function reduceSession(
  state: SimSessionState,
  sample: SimSample,
  ctx: SessionCtx
): { state: SimSessionState; effects: SessionEffect[] } {
  // A sample the simulator cannot really have produced — in practice the
  // all-zero read that arrives while it unloads the aircraft (#28). Drop it
  // whole: the state is returned untouched, INCLUDING lastSample, so it always
  // holds the most recent trustworthy position for the UI to plot.
  if (!isPlausibleSample(sample)) return { state, effects: [] }

  const effects: SessionEffect[] = []
  let next: SimSessionState = { ...state, lastSample: sample }

  if (next.phase === 'UNMATCHED') {
    if (next.pendingChoice) return { state: next, effects } // waiting on the dialog
    if (next.aircraftId) {
      // A choice was just resolved — finish the entry with this sample.
      const ac = ctx.fleet.find((a) => a.id === next.aircraftId)
      if (ac) return { state: enterMatched(next, sample, ctx, ac, effects), effects }
      next = { ...next, aircraftId: null }
    }
    if (!simAtPilotPosition(sample, ctx)) {
      const expected = ctx.pilotOffField
        ? `your off-field position (${ctx.pilotOffField.lat.toFixed(2)}, ${ctx.pilotOffField.lon.toFixed(2)})`
        : ctx.pilotLocationIcao
      next = warnOnce(next, effects, 'wrong-position',
        `The sim is not where you last ended. Move the aircraft to ${expected} to pick up where you left off.`)
      return { state: next, effects }
    }
    const cands = candidates(sample, ctx)
    if (cands.length === 0) {
      next = warnOnce(next, effects, 'no-matching-aircraft',
        'No owned aircraft of this type at your location — check the loaded aircraft, or buy/reposition one.')
      return { state: next, effects }
    }
    if (cands.length > 1) {
      effects.push({ kind: 'NEED_CHOICE', candidateIds: cands.map((a) => a.id) })
      return { state: { ...next, pendingChoice: cands.map((a) => a.id) }, effects }
    }
    return { state: enterMatched(next, sample, ctx, cands[0], effects), effects }
  }

  const ac = ctx.fleet.find((a) => a.id === next.aircraftId)
  if (!ac) return { state: initSessionState(), effects } // aircraft sold/gone — drop the match

  // Sim aircraft swapped mid-session (§8): drop the match, warn, re-run
  // matching from scratch on subsequent samples. The open leg is abandoned
  // (same consequence as a mid-leg disconnect).
  if (!matchesAircraft(getSpec(ac.specId), sample)) {
    const fresh = initSessionState()
    effects.push({
      kind: 'WARN',
      code: 'aircraft-swapped',
      message: `The sim aircraft changed (now "${sample.atcModel || sample.title}") — tracking for ${ac.registration} stopped.`,
    })
    return { state: { ...fresh, lastSample: sample }, effects }
  }

  if (next.phase === 'GROUND_SECURE') {
    if (sample.enginesOn) {
      // Off-block (D7/D8): a fresh recorder starts this engine-leg. Seed any
      // outstanding positive divergence (e.g. a failed SYNC_TO_SIM write) as
      // external fuel so it gets billed instead of leaking in for free.
      effects.push({ kind: 'OFF_BLOCK', icao: nearestAirport(sample.lat, sample.lon, ctx.regionId)?.icao ?? null })
      return {
        state: {
          ...next,
          phase: 'SIM_ACTIVE',
          recorder: recordSample(initRecorderState(ctx.regionId), sample),
          seedExternalL: seedFromDivergence(ac, sample),
          stopArmed: false,
        },
        effects,
      }
    }
    // Game is truth on the ground with engines off (D3): push the game's tank
    // back over any sim-side edit — one write per divergence episode.
    const simFuelL = sample.fuelGal * GALLONS_TO_LITRES
    const diverged = Math.abs(simFuelL - ac.fuelL) > fuelToleranceL(ac, sample)
    if (diverged && !next.syncInFlight) {
      effects.push({ kind: 'SYNC_TO_SIM', fuelL: ac.fuelL })
      return { state: { ...next, syncInFlight: true }, effects }
    }
    if (!diverged && next.syncInFlight) next = { ...next, syncInFlight: false }
    return { state: next, effects }
  }

  // SIM_ACTIVE: sim is truth — measure, never write.
  const recorder = recordSample(next.recorder ?? initRecorderState(ctx.regionId), sample)
  next = { ...next, recorder }

  if (!sample.onGround) {
    if (!next.stopArmed) next = { ...next, stopArmed: true }
    return { state: next, effects }
  }

  // Full stop after a landing, engines running or not → STOP_AT (D8), once per stop.
  const landedThisLeg = recorder.currentLeg?.landedOnce === true || recorder.legs.length > 0
  if (next.stopArmed && landedThisLeg && sample.groundKts <= STATIONARY_KTS) {
    const icao = nearestAirport(sample.lat, sample.lon, ctx.regionId)?.icao
    if (icao) effects.push({ kind: 'STOP_AT', icao })
    next = { ...next, stopArmed: false }
  }

  // On-block: recordSample closed the leg (engines off on ground) → commit it.
  if (!sample.enginesOn && recorder.legs.length > 0) {
    const leg = recorder.legs[recorder.legs.length - 1]
    const airport = nearestAirport(sample.lat, sample.lon, ctx.regionId)
    effects.push({
      kind: 'ON_BLOCK',
      leg,
      simFuelL: sample.fuelGal * GALLONS_TO_LITRES,
      pos: airport ? { icao: airport.icao } : { lat: sample.lat, lon: sample.lon },
      externalFuelL: next.seedExternalL + recorder.externalFuelGal * GALLONS_TO_LITRES,
      landings: recorder.landings,
      track: simplifyTrack(recorder.fullTrack),
      simTitle: sample.title,
      simAtcModel: sample.atcModel,
    })
    return {
      state: { ...next, phase: 'GROUND_SECURE', recorder: null, seedExternalL: 0, stopArmed: false, syncInFlight: false },
      effects,
    }
  }

  return { state: next, effects }
}

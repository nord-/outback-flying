// Pure derivation layer for SimConnect flight tracking (issue #9, evolved by
// the always-on session in issue #20).
//
// Folds a stream of live `SimSample`s (src/sim/types.ts, produced by the
// Electron bridge) into `RecorderState` — legs (block/flight time, distance,
// fuel used) bounded by engine events, landings, and external-fuel
// accumulation — with no side effects and no dependency on the sim, Electron,
// or React. `recordSample` is a pure reducer: the always-on session
// (src/sim/useSimSession.ts) folds live samples one at a time, committing each
// closed leg to the store via `commitLeg` (src/game/store.ts) as it lands —
// there is no separate offline "finish recording" step (D15).
import type { Airport, FlightLeg, FlightLogSummary, TrackPoint, AircraftSpec } from './types'
import type { SimSample } from '../sim/types'
import { airportsInRegion } from '../data/airports'
import { distanceNm, bearingDeg, toRad, EARTH_RADIUS_NM, type LatLon } from './geo'

export const STATIONARY_KTS = 2 // at/under this groundspeed, on the ground, counts as stopped
export const EXTERNAL_FUEL_SLOP_GAL = 0.5 // per-sample fuel increase below this is float noise, not a refuel
export const GALLONS_TO_LITRES = 3.785411784
const DEFAULT_NEAREST_TOLERANCE_NM = 5
const DEFAULT_SIMPLIFY_EPSILON_NM = 0.05 // ~90 m — invisible at map scale
// No real aircraft covers ground anywhere near this fast between consecutive
// live ~1s samples — a jump implying more is a slew/teleport or an in-sim
// "reset flight", not flight (#22 review). Set far above any real aircraft's
// speed deliberately: this codebase's own test fixtures (legSamples et al.)
// compress an entire cross-country leg into a handful of 1-second-apart
// samples to keep tests fast, which already implies speeds in the hundreds of
// thousands of knots for perfectly ordinary synthetic legs. A lower threshold
// would flag those as false positives. This still catches any real slew/reset
// that relocates the aircraft by more than a couple hundred nm within one
// real second — comfortably covering the "reset back near the departure
// field" scenario the guard exists for.
export const MAX_PLAUSIBLE_KTS = 1_000_000

// A simulator that unloads its aircraft (returning to the menu, shutting down)
// keeps streaming for a moment with every SimVar reading ~0 — a position in the
// Gulf of Guinea that no flight in any catalogued region can legitimately
// occupy. It is NOT exactly 0,0 (the real save that produced issue #28 recorded
// 0.000407, 0.013975), so this is a radius, not an equality check.
export const NULL_ISLAND_RADIUS_NM = 10

/** False for a coordinate that cannot describe a real aircraft position. */
export function isPlausiblePosition(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false
  return distanceNm({ lat, lon }, { lat: 0, lon: 0 }) > NULL_ISLAND_RADIUS_NM
}

/** False for a live sample that cannot describe a real aircraft state — the
 *  gate `reduceSession` applies before a sample is allowed to touch anything. */
export function isPlausibleSample(s: SimSample): boolean {
  return (
    Number.isFinite(s.t) &&
    Number.isFinite(s.fuelGal) &&
    Number.isFinite(s.groundKts) &&
    Number.isFinite(s.altFt) &&
    // headingTrue is copied into every TrackPoint, and fuelCapacityGal feeds
    // simCapacityL — which the fleet card and the refuel modal both divide by.
    Number.isFinite(s.headingTrue) &&
    Number.isFinite(s.fuelCapacityGal) &&
    isPlausiblePosition(s.lat, s.lon)
  )
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** True when the position implied by `sample` could not plausibly have been
 *  reached from `prev` by real flight in the elapsed time. */
function isImplausibleJump(prev: SimSample, sample: SimSample): boolean {
  const dtHours = (sample.t - prev.t) / 3_600_000
  if (dtHours <= 0) return false
  return distanceNm(prev, sample) / dtHours > MAX_PLAUSIBLE_KTS
}

/** Whichever airport in the given region is closest, if within tolerance —
 *  otherwise null (an off-catalogue field; the leg still records raw facts,
 *  just no ICAO). Scoped to one region since a station operates in one world
 *  region at a time (data/regions.ts). */
export function nearestAirport(
  lat: number,
  lon: number,
  regionId: string,
  toleranceNm = DEFAULT_NEAREST_TOLERANCE_NM
): Airport | null {
  let best: Airport | null = null
  let bestDist = Infinity
  for (const a of airportsInRegion(regionId)) {
    const d = distanceNm({ lat, lon }, a)
    if (d < bestDist) {
      bestDist = d
      best = a
    }
  }
  return best && bestDist <= toleranceNm ? best : null
}

/**
 * Does this spec plausibly match what the sim reports? Checks the spec's
 * `simMatch` keywords against ATC MODEL first (already a clean family name —
 * confirmed against a real MSFS 2020 aircraft in the Phase 0 spike) and TITLE
 * as a fallback for addons that leave ATC MODEL blank or generic. A spec with
 * no `simMatch` keywords never matches — callers should warn, not block, on
 * 'none' so an unrecognised addon doesn't strand the player.
 */
export function matchesAircraft(spec: AircraftSpec, sim: { title: string; atcModel: string }): boolean {
  const keywords = spec.simMatch ?? []
  if (keywords.length === 0) return false
  const haystacks = [sim.atcModel.toLowerCase(), sim.title.toLowerCase()]
  return keywords.some((kw) => {
    const needle = kw.toLowerCase()
    return haystacks.some((h) => h.includes(needle))
  })
}

/** SimConnect-derived tank capacity in litres for a spec/sample pair, or
 *  `undefined` when there's no live sample or it doesn't plausibly match this
 *  spec (see `matchesAircraft`) — callers fall back to `spec.fuelCapacityL`.
 *  Shared by the Fleet card and the refuel dialog so both cap refuelling at
 *  the actually loaded model's capacity, not a mismatched spec's. */
export function simCapacityL(spec: AircraftSpec, sample: SimSample | null): number | undefined {
  return sample && spec.simMatch?.length && matchesAircraft(spec, sample)
    ? sample.fuelCapacityGal * GALLONS_TO_LITRES
    : undefined
}

/** Duty time: block time plus 30 min turnaround for each stop (start + every
 *  landing). One leg → 2 stops → +60 min; two legs → 3 stops → +90 min. */
export function computeDutyMinutes(blockMinutes: number, legCount: number): number {
  return blockMinutes + 30 * (legCount + 1)
}

// No aircraft in the catalogue cruises anywhere near this. A leg claiming to
// have covered ground faster was not flown — it is the position discontinuity
// left by a sim unloading its aircraft (#28), recorded before the sample guard
// above existed.
export const MAX_LOG_LEG_KTS = 1000

function isFlyableLeg(l: FlightLeg): boolean {
  if (l.distanceNm === 0) return true // standing still is not a teleport
  if (!(l.distanceNm > 0)) return false // non-finite or negative distance is corrupt, not flight
  if (!(l.blockMinutes > 0)) return false // distance covered in no time at all
  return l.distanceNm / (l.blockMinutes / 60) <= MAX_LOG_LEG_KTS
}

/**
 * Remove legs that cannot describe real flight from a recorded summary and
 * re-derive the totals from what is left. Returns the SAME object when nothing
 * was dropped (so a migration can skip untouched entries), and `null` when no
 * leg survives — the caller should then drop the entry entirely.
 *
 * `landings`, `dutyMinutes` and `earnings` are deliberately preserved: none of
 * them can be re-derived from leg data, and guessing would be worse than
 * leaving a slightly generous figure in a historical record.
 */
export function scrubFlightLog(log: FlightLogSummary): FlightLogSummary | null {
  const legs = log.legs.filter(isFlyableLeg)
  if (legs.length === log.legs.length) return log
  if (legs.length === 0) return null
  const sum = (f: (l: FlightLeg) => number) => +legs.reduce((t, l) => t + f(l), 0).toFixed(2)
  return {
    ...log,
    legs,
    startIcao: legs[0].fromIcao,
    endIcao: legs[legs.length - 1].toIcao,
    intermediates: legs
      .slice(0, -1)
      .map((l) => l.toIcao)
      .filter((i): i is string => i !== null),
    blockMinutes: sum((l) => l.blockMinutes),
    flightMinutes: sum((l) => l.flightMinutes),
    distanceNm: sum((l) => l.distanceNm),
    fuelUsedL: sum((l) => l.fuelUsedL),
  }
}

function sumTrackDistanceNm(points: LatLon[]): number {
  let sum = 0
  for (let i = 1; i < points.length; i++) sum += distanceNm(points[i - 1], points[i])
  return sum
}

/** Great-circle cross-track distance of `p` from the line through `a`/`b`, in nm. */
function crossTrackDistanceNm(a: LatLon, b: LatLon, p: LatLon): number {
  if (a.lat === b.lat && a.lon === b.lon) return distanceNm(a, p)
  const d13 = distanceNm(a, p) / EARTH_RADIUS_NM
  const brng13 = toRad(bearingDeg(a, p))
  const brng12 = toRad(bearingDeg(a, b))
  return Math.abs(Math.asin(Math.sin(d13) * Math.sin(brng13 - brng12)) * EARTH_RADIUS_NM)
}

/**
 * Ramer–Douglas–Peucker track simplification. A cross-country track compresses
 * enormously with negligible visual loss (§7 of the brainstorm) — this is what
 * keeps recorded tracks small enough to persist alongside the rest of the save.
 */
export function simplifyTrack(points: TrackPoint[], epsilonNm = DEFAULT_SIMPLIFY_EPSILON_NM): TrackPoint[] {
  if (points.length <= 2) return points
  const first = points[0]
  const last = points[points.length - 1]

  let maxDist = 0
  let splitAt = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = crossTrackDistanceNm(first, last, points[i])
    if (d > maxDist) {
      maxDist = d
      splitAt = i
    }
  }

  if (maxDist > epsilonNm) {
    const left = simplifyTrack(points.slice(0, splitAt + 1), epsilonNm)
    const right = simplifyTrack(points.slice(splitAt), epsilonNm)
    return left.slice(0, -1).concat(right)
  }
  return [first, last]
}

function toTrackPoint(s: SimSample): TrackPoint {
  return { t: s.t, lat: s.lat, lon: s.lon, hdg: s.headingTrue, gs: s.groundKts, alt: s.altFt, onGround: s.onGround }
}

/** A leg still being recorded — internal bookkeeping only; closeLeg() below
 *  reduces it to the persisted `FlightLeg` shape. */
interface OpenLeg {
  startT: number
  startLat: number
  startLon: number
  startFuelGal: number
  airborneMs: number // accumulated duration of every airborne segment closed so far this leg
  flightStartT: number | null // start of the CURRENT airborne segment; null while grounded
  landedOnce: boolean // true once at least one touchdown has occurred this leg
  endT: number
  endLat: number
  endLon: number
  endFuelGal: number
  track: TrackPoint[]
}

export interface RecorderState {
  regionId: string
  legs: FlightLeg[]
  landings: number
  currentLeg: OpenLeg | null
  fullTrack: TrackPoint[]
  lastSample: SimSample | null
  firstSample: SimSample | null
  externalFuelGal: number
  // Fuel level just before an unconfirmed rise began, or null when there is
  // none outstanding — held for one sample before being billed so a transient
  // slosh/unporting spike that reverts on the next sample is dropped instead
  // of committed (#22 review).
  pendingExternalBaselineGal: number | null
}

/** A recording session always belongs to one world region — the station's
 *  current one (GameState.regionId) — since airport matching is region-scoped. */
export function initRecorderState(regionId: string): RecorderState {
  return {
    regionId,
    legs: [],
    landings: 0,
    currentLeg: null,
    fullTrack: [],
    lastSample: null,
    firstSample: null,
    externalFuelGal: 0,
    pendingExternalBaselineGal: null,
  }
}

function closeLeg(leg: OpenLeg, regionId: string): FlightLeg {
  const blockMinutes = (leg.endT - leg.startT) / 60000
  // Sum of every completed airborne segment — a running turnaround (land,
  // taxi with engines on, take off again) must not count the parked interval
  // between segments as flight time (#22 review).
  const flightMinutes = leg.airborneMs / 60000
  // Fuel only ever decreases within a leg by construction: a refuel happens
  // while grounded and stationary, which is the gap *between* legs, not inside
  // one — but clamp to 0 anyway as a defensive floor.
  const fuelUsedGal = Math.max(0, leg.startFuelGal - leg.endFuelGal)

  return {
    fromIcao: nearestAirport(leg.startLat, leg.startLon, regionId)?.icao ?? null,
    toIcao: nearestAirport(leg.endLat, leg.endLon, regionId)?.icao ?? null,
    blockMinutes: round2(blockMinutes),
    flightMinutes: round2(flightMinutes),
    distanceNm: round2(sumTrackDistanceNm(leg.track)),
    fuelUsedL: round2(fuelUsedGal * GALLONS_TO_LITRES),
  }
}

/**
 * Fold one live sample into the recorder state. Leg boundaries are inferred
 * from engine state (`SimSample.enginesOn`): off-block is engine start (or the
 * recorder attaching to an aircraft that's already running or airborne), and
 * on-block is engines going off while on the ground. A running stop — engines
 * still on — stays inside the leg, which is what lets a running turnaround
 * (land, taxi, take off again without shutting down) count as one leg rather
 * than closing at every stop.
 */
export function recordSample(state: RecorderState, sample: SimSample): RecorderState {
  const point = toTrackPoint(sample)
  const fullTrack = [...state.fullTrack, point]
  let { legs, landings, externalFuelGal } = state
  let currentLeg = state.currentLeg

  // A slew/teleport or in-sim "reset flight" (SimConnect stays connected) can
  // put the aircraft down far from where the last sample had it. Otherwise
  // this is indistinguishable from a real landing: it would mark a touchdown,
  // sum the jump into distanceNm, and could fire a stop at the departure
  // field (#22 review). Fuel accumulation is skipped too, since a reset can
  // also snap fuel back to a default load.
  const discontinuity = state.lastSample != null && isImplausibleJump(state.lastSample, sample)

  // Fuel the game didn't sell: a sustained sample-to-sample increase beyond
  // slop is a sim-menu refill — accumulated here, billed by the store at
  // on-block (D14). Held one sample as `pendingExternalBaselineGal` before
  // being committed: a transient slosh/unporting spike that reverts on the
  // very next sample is dropped instead of billed (#22 review).
  let pendingExternalBaselineGal = state.pendingExternalBaselineGal
  if (discontinuity) {
    pendingExternalBaselineGal = null
  } else if (state.lastSample) {
    if (pendingExternalBaselineGal !== null) {
      if (sample.fuelGal > state.lastSample.fuelGal + EXTERNAL_FUEL_SLOP_GAL) {
        // Still rising — keep holding, wait for it to settle.
      } else if (sample.fuelGal > pendingExternalBaselineGal + EXTERNAL_FUEL_SLOP_GAL) {
        externalFuelGal += sample.fuelGal - pendingExternalBaselineGal // settled higher — confirmed refill
        pendingExternalBaselineGal = null
      } else {
        pendingExternalBaselineGal = null // reverted close to baseline — was noise
      }
    } else if (sample.fuelGal > state.lastSample.fuelGal + EXTERNAL_FUEL_SLOP_GAL) {
      pendingExternalBaselineGal = state.lastSample.fuelGal // candidate rise begins
    }
  }

  if (!currentLeg) {
    // Off-block: engines come on — or the recorder attaches to an aircraft
    // that is already running or airborne (engines-running connect, §8).
    if (sample.enginesOn || !sample.onGround) {
      currentLeg = {
        startT: sample.t,
        startLat: sample.lat,
        startLon: sample.lon,
        startFuelGal: sample.fuelGal,
        airborneMs: 0,
        flightStartT: sample.onGround ? null : sample.t,
        landedOnce: false,
        endT: sample.t,
        endLat: sample.lat,
        endLon: sample.lon,
        endFuelGal: sample.fuelGal,
        track: [point],
      }
    }
  } else if (discontinuity) {
    // Re-baseline at the new position: keep the leg's already-accumulated
    // timing/fuel bookkeeping, but drop the jump itself from the track (so it
    // is never summed into distanceNm) and don't evaluate touchdown for this
    // sample — flightStartT re-derives from the sample's (post-jump) ground
    // state so a later ordinary sample doesn't measure flight time across the
    // discontinuity.
    currentLeg = {
      ...currentLeg,
      endT: sample.t,
      endLat: sample.lat,
      endLon: sample.lon,
      endFuelGal: sample.fuelGal,
      flightStartT: sample.onGround ? null : sample.t,
      track: [point],
    }
  } else {
    currentLeg = {
      ...currentLeg,
      track: [...currentLeg.track, point],
      endT: sample.t,
      endLat: sample.lat,
      endLon: sample.lon,
      endFuelGal: sample.fuelGal,
    }

    if (!sample.onGround) {
      if (currentLeg.flightStartT === null) currentLeg.flightStartT = sample.t
    } else {
      if (currentLeg.flightStartT !== null) {
        // Touchdown: fold this airborne segment's duration in and re-arm for a
        // possible further segment (bounce/touch-and-go/running turnaround) —
        // ground time between segments is never counted as flight time.
        currentLeg.airborneMs += sample.t - currentLeg.flightStartT
        currentLeg.flightStartT = null
        currentLeg.landedOnce = true
        landings += 1
      }
      // On-block: engines off on the ground closes the leg — a running stop
      // (engines on) stays inside the leg (D8/§6).
      if (!sample.enginesOn) {
        legs = [...legs, closeLeg(currentLeg, state.regionId)]
        currentLeg = null
      }
    }
  }

  const firstSample = state.firstSample ?? sample

  return {
    regionId: state.regionId,
    legs,
    landings,
    currentLeg,
    fullTrack,
    lastSample: sample,
    firstSample,
    externalFuelGal,
    pendingExternalBaselineGal,
  }
}


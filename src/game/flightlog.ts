// Pure derivation layer for SimConnect flight recording (issue #9, Phase 2).
//
// Turns a stream of live `SimSample`s (src/sim/types.ts, produced by the
// Phase 1 Electron bridge) into a `DerivedFlight` — legs, block/flight/duty
// time, distance, fuel used, and a simplified track — with no side effects and
// no dependency on the sim, Electron, or React. `recordSample` is a reducer,
// so both a live recorder (folding samples one at a time as they arrive) and a
// test (folding a whole synthetic array at once via `deriveFlightFromSamples`)
// exercise the exact same logic.
import type { Airport, FlightLeg, TrackPoint, AircraftSpec } from './types'
import type { SimSample } from '../sim/types'
import { airportsInRegion } from '../data/airports'
import { distanceNm, bearingDeg, toRad, EARTH_RADIUS_NM, type LatLon } from './geo'

const STATIONARY_KTS = 2 // at/under this groundspeed, on the ground, counts as stopped
const GALLONS_TO_LITRES = 3.785411784
const DEFAULT_NEAREST_TOLERANCE_NM = 5
const DEFAULT_SIMPLIFY_EPSILON_NM = 0.05 // ~90 m — invisible at map scale

const round2 = (n: number): number => Math.round(n * 100) / 100

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

/** Duty time: block time plus 30 min turnaround for each stop (start + every
 *  landing). One leg → 2 stops → +60 min; two legs → 3 stops → +90 min. */
export function computeDutyMinutes(blockMinutes: number, legCount: number): number {
  return blockMinutes + 30 * (legCount + 1)
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
  flightStartT: number | null // set once airborne
  flightEndT: number | null // set on touchdown; cleared again by a touch-and-go
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
}

/** A recording session always belongs to one world region — the station's
 *  current one (GameState.regionId) — since airport matching is region-scoped. */
export function initRecorderState(regionId: string): RecorderState {
  return { regionId, legs: [], landings: 0, currentLeg: null, fullTrack: [], lastSample: null }
}

function closeLeg(leg: OpenLeg, regionId: string): FlightLeg {
  const blockMinutes = (leg.endT - leg.startT) / 60000
  const flightMinutes =
    leg.flightStartT !== null && leg.flightEndT !== null ? (leg.flightEndT - leg.flightStartT) / 60000 : 0
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
 * purely from `onGround`/`groundKts` (Phase 1 doesn't stream an engine SimVar):
 * a leg opens the moment the aircraft starts moving from a stop (taxi-out —
 * "chocks off"), and closes once it has flown, landed, and come to a stop
 * again ("chocks on"). Time spent parked between legs (a fuel/overnight stop)
 * therefore falls in neither leg, which is exactly what makes the block-time
 * split correct without needing to special-case a refuel.
 */
export function recordSample(state: RecorderState, sample: SimSample): RecorderState {
  const point = toTrackPoint(sample)
  const fullTrack = [...state.fullTrack, point]
  const moving = sample.groundKts > STATIONARY_KTS
  let { legs, landings } = state
  let currentLeg = state.currentLeg

  if (!currentLeg) {
    if (!sample.onGround || moving) {
      currentLeg = {
        startT: sample.t,
        startLat: sample.lat,
        startLon: sample.lon,
        startFuelGal: sample.fuelGal,
        flightStartT: sample.onGround ? null : sample.t,
        flightEndT: null,
        endT: sample.t,
        endLat: sample.lat,
        endLon: sample.lon,
        endFuelGal: sample.fuelGal,
        track: [point],
      }
    }
    // else: stationary on the ground with no leg open — still idle.
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
      // Airborne again before a ground stop closed the leg (a bounce/touch-and-
      // go) — still the same leg, so the earlier landing mark doesn't stand.
      if (currentLeg.flightEndT !== null) currentLeg.flightEndT = null
    } else {
      if (currentLeg.flightStartT !== null && currentLeg.flightEndT === null) {
        currentLeg.flightEndT = sample.t // first grounded sample after flight = touchdown
        landings += 1
      }
      if (currentLeg.flightEndT !== null && !moving) {
        legs = [...legs, closeLeg(currentLeg, state.regionId)]
        currentLeg = null
      }
    }
  }

  return { regionId: state.regionId, legs, landings, currentLeg, fullTrack, lastSample: sample }
}

/** Everything a `FlightLog` needs except the persistence/game-state fields
 *  (id, day, missionId, aircraftId, earnings) that only the store can supply. */
export interface DerivedFlight {
  legs: FlightLeg[]
  startIcao: string | null
  endIcao: string | null
  intermediates: string[]
  blockMinutes: number
  flightMinutes: number
  dutyMinutes: number
  distanceNm: number
  fuelUsedL: number
  landings: number
  track: TrackPoint[]
  simAircraftTitle: string
  simAtcModel: string
}

/**
 * Finalise a recording. Returns null if nothing flyable was recorded (no
 * completed leg — e.g. the aircraft never left the ground). A leg that has
 * landed but not yet rolled to a full stop is force-closed at its last sample,
 * so ending the recording while still taxiing to the ramp doesn't lose it; a
 * leg that's still airborne (or never took off) is simply dropped — callers
 * should gate "complete flight" on having landed, same as the existing manual
 * flyMission check (`landings >= 1`).
 */
export function closeFlight(state: RecorderState): DerivedFlight | null {
  let legs = state.legs
  const { currentLeg, landings, fullTrack, lastSample } = state

  if (currentLeg && currentLeg.flightEndT !== null) {
    legs = [...legs, closeLeg(currentLeg, state.regionId)]
  }
  if (legs.length === 0 || landings === 0) return null

  const blockMinutes = round2(legs.reduce((sum, l) => sum + l.blockMinutes, 0))
  const flightMinutes = round2(legs.reduce((sum, l) => sum + l.flightMinutes, 0))
  const distanceTotal = round2(legs.reduce((sum, l) => sum + l.distanceNm, 0))
  const fuelUsedL = round2(legs.reduce((sum, l) => sum + l.fuelUsedL, 0))
  const intermediates = legs
    .slice(0, -1)
    .map((l) => l.toIcao)
    .filter((icao): icao is string => icao !== null)

  return {
    legs,
    startIcao: legs[0].fromIcao,
    endIcao: legs[legs.length - 1].toIcao,
    intermediates,
    blockMinutes,
    flightMinutes,
    dutyMinutes: computeDutyMinutes(blockMinutes, legs.length),
    distanceNm: distanceTotal,
    fuelUsedL,
    landings,
    track: simplifyTrack(fullTrack),
    simAircraftTitle: lastSample?.title ?? '',
    simAtcModel: lastSample?.atcModel ?? '',
  }
}

/** Convenience for tests/offline analysis: fold a whole sample array at once. */
export function deriveFlightFromSamples(samples: SimSample[], regionId: string): DerivedFlight | null {
  return closeFlight(samples.reduce(recordSample, initRecorderState(regionId)))
}

/** A live-recording summary for the UI — deliberately not the raw `RecorderState`
 *  so callers never reach into `OpenLeg` internals directly. */
export interface RecorderSnapshot {
  legsCompleted: number
  landings: number
  isOnLeg: boolean
  isAirborne: boolean
}

export function recorderSnapshot(state: RecorderState): RecorderSnapshot {
  const leg = state.currentLeg
  return {
    legsCompleted: state.legs.length,
    landings: state.landings,
    isOnLeg: leg !== null,
    isAirborne: leg !== null && leg.flightStartT !== null && leg.flightEndT === null,
  }
}

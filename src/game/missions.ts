import { airportsInRegionOfTypes, getAirport } from '../data/airports'
import { distanceNm } from './geo'
import {
  computeReward,
  timeCriticalWindowMinutes,
  TIME_CRITICAL_MAX_DISTANCE_NM,
  TIME_CRITICAL_REWARD_MULT,
} from './economy'
import type { AircraftSpec, Airport, FieldType, Mission, MissionType, Urgency } from './types'

let seq = 0
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface EndpointRule {
  from: readonly FieldType[] // allowed origin tiers
  to: readonly FieldType[] // allowed destination tiers
  originBias?: FieldType // tier favoured when picking the origin (70%)
  destBias?: FieldType // tier favoured when picking the destination (70%)
}

interface TypeConfig {
  type: MissionType
  label: string
  seats: [number, number] // inclusive range
  weight: number
  endpoints: EndpointRule
  narratives: readonly { text: string; tiers?: readonly FieldType[] }[]
}

const TYPE_CONFIG: TypeConfig[] = [
  {
    type: 'MEDEVAC',
    label: 'Medical evacuation',
    seats: [1, 2],
    weight: 3,
    endpoints: { from: ['regional', 'strip'], to: ['hub', 'regional'], originBias: 'strip' },
    narratives: [
      { text: 'A serious workplace injury at a remote site needs urgent evacuation to hospital.' },
      { text: 'A road accident on an isolated route has left a patient in a critical condition.' },
      {
        text: 'A child in a remote community has suspected appendicitis and must reach a hospital.',
      },
    ],
  },
  {
    type: 'DOCTOR_TRANSPORT',
    label: 'Doctor transport',
    seats: [1, 3],
    weight: 2,
    endpoints: {
      from: ['hub', 'regional'],
      to: ['hub', 'regional', 'strip'],
      originBias: 'hub',
      destBias: 'strip',
    },
    narratives: [
      {
        text: 'A doctor must be flown out to assess an unwell patient in an isolated settlement.',
        tiers: ['regional', 'strip'],
      },
      {
        text: 'An emergency physician is needed at a small community clinic overnight.',
        tiers: ['regional', 'strip'],
      },
      {
        text: 'A specialist doctor is needed to consult on a case at the regional hospital.',
        tiers: ['hub'],
      },
    ],
  },
  {
    type: 'PATIENT_TRANSFER',
    label: 'Patient transfer',
    seats: [1, 4],
    weight: 2,
    endpoints: { from: ['hub', 'regional'], to: ['hub', 'regional'] },
    narratives: [
      {
        text: 'A stable patient needs transfer to a larger hospital for specialist care.',
        tiers: ['hub'],
      },
      { text: 'A recovering patient is being repatriated closer to family.', tiers: ['regional'] },
    ],
  },
  {
    type: 'SUPPLY_RUN',
    label: 'Supply run',
    seats: [0, 2],
    weight: 2,
    endpoints: {
      from: ['hub', 'regional'],
      to: ['hub', 'regional', 'strip'],
      originBias: 'hub',
      destBias: 'strip',
    },
    narratives: [
      {
        text: 'Medical supplies and vaccines must be delivered to a remote clinic.',
        tiers: ['regional', 'strip'],
      },
      {
        text: 'Blood products are urgently required at a regional hospital.',
        tiers: ['hub', 'regional'],
      },
    ],
  },
  {
    type: 'CLINIC_FLIGHT',
    label: 'Clinic flight',
    seats: [2, 5],
    weight: 1,
    endpoints: {
      from: ['hub', 'regional'],
      to: ['hub', 'regional', 'strip'],
      originBias: 'hub',
      destBias: 'strip',
    },
    narratives: [
      {
        text: 'A routine fly-in clinic run: transport a small health team to a remote settlement.',
        tiers: ['regional', 'strip'],
      },
      { text: 'A scheduled immunisation clinic needs its team flown out and back.' },
    ],
  },
  {
    type: 'ORGAN_TRANSPORT',
    label: 'Organ transport',
    seats: [0, 1],
    weight: 1,
    // Hospital to hospital: a regional hospital can transplant either way, so
    // both ends are hub | regional and neither end is biased.
    endpoints: { from: ['hub', 'regional'], to: ['hub', 'regional'] },
    // No `tiers` hints needed: `to` is already hub | regional, so no narrative
    // can contradict the destination's tier.
    narratives: [
      {
        text: 'A donor organ has been matched — it must reach the transplant team before it perishes.',
      },
      {
        text: 'A time-critical tissue transfer: a courier and an esky, and a clock that started at retrieval.',
      },
    ],
  },
  {
    type: 'EMERGENCY_MEDEVAC',
    label: 'Emergency medevac',
    seats: [4, 6],
    weight: 1,
    // A medevac does not begin at a major hub — the hospital is already there.
    // Same shape as MEDEVAC: out in the region, in to a hospital.
    endpoints: { from: ['regional', 'strip'], to: ['hub', 'regional'], originBias: 'strip' },
    narratives: [
      {
        text: 'A critical patient must be stretchered out with a medical escort — every minute counts.',
      },
      {
        text: 'A remote-clinic emergency needs a fast evacuation with room for a stretcher and a medic.',
      },
    ],
  },
]

export const TIME_CRITICAL_TYPES: ReadonlySet<MissionType> = new Set(['ORGAN_TRANSPORT', 'EMERGENCY_MEDEVAC'])

/** True for a mission that carries a live delivery countdown. */
export function isTimeCritical(m: Mission): boolean {
  return m.windowMinutes !== undefined
}

function weightedType(fleetSpecs: AircraftSpec[]): TypeConfig {
  const maxSeats = maxSeatsForFleet(fleetSpecs)
  const eligible = TYPE_CONFIG.filter((c) => c.seats[0] <= maxSeats)
  const total = eligible.reduce((s, c) => s + c.weight, 0)
  let r = Math.random() * total
  for (const c of eligible) {
    r -= c.weight
    if (r <= 0) return c
  }
  return eligible[0]
}

function rollUrgency(type: MissionType): Urgency {
  if (type === 'ORGAN_TRANSPORT' || type === 'EMERGENCY_MEDEVAC') return 'EMERGENCY'
  if (type === 'MEDEVAC') return Math.random() < 0.6 ? 'EMERGENCY' : 'PRIORITY'
  if (type === 'DOCTOR_TRANSPORT') return Math.random() < 0.5 ? 'PRIORITY' : 'ROUTINE'
  if (type === 'SUPPLY_RUN') return Math.random() < 0.25 ? 'PRIORITY' : 'ROUTINE'
  return Math.random() < 0.15 ? 'PRIORITY' : 'ROUTINE'
}

const DEADLINE_DAYS: Record<Urgency, [number, number]> = {
  EMERGENCY: [1, 2],
  PRIORITY: [2, 4],
  ROUTINE: [4, 8],
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export const MIN_DISTANCE_NM = 40
export const MAX_DISTANCE_NM = 350
const TARGET_MAX_FLIGHT_HOURS = 2

/**
 * Upper distance bound for a mission, so a leg stays flyable in roughly
 * `TARGET_MAX_FLIGHT_HOURS` — capped further by the fastest aircraft actually
 * owned, so a fleet of slow piston aircraft doesn't get missions only a
 * turboprop could complete in reasonable time.
 */
function maxDistanceForFleet(fleetSpecs: AircraftSpec[]): number {
  if (fleetSpecs.length === 0) return MAX_DISTANCE_NM
  const fastestCruiseKts = Math.max(...fleetSpecs.map((s) => s.cruiseKts))
  return Math.min(MAX_DISTANCE_NM, Math.round(fastestCruiseKts * TARGET_MAX_FLIGHT_HOURS))
}

/**
 * Upper bound for a mission's seat requirement: the largest cabin actually
 * owned, so a small-cabin fleet (e.g. a 2-seat Cessna 152) doesn't get missions
 * it structurally cannot fly. Falls back to the largest seat count any mission
 * type asks for when the fleet is empty.
 */
const MAX_SEATS_ANY_MISSION = Math.max(...TYPE_CONFIG.map((c) => c.seats[1]))
function maxSeatsForFleet(fleetSpecs: AircraftSpec[]): number {
  if (fleetSpecs.length === 0) return MAX_SEATS_ANY_MISSION
  return Math.max(...fleetSpecs.map((s) => s.seats))
}

interface DestinationCandidate {
  airport: Airport
  distance: number
}

/** Candidates of the allowed tiers, nearest first. */
function candidatesByDistance(
  from: Airport,
  regionId: string,
  tiers: readonly FieldType[]
): DestinationCandidate[] {
  return airportsInRegionOfTypes(regionId, tiers)
    .filter((a) => a.icao !== from.icao)
    .map((airport) => ({ airport, distance: distanceNm(from, airport) }))
    .sort((a, b) => a.distance - b.distance)
}

/**
 * Picks a destination of an allowed tier within [MIN_DISTANCE_NM, maxDist],
 * favouring `destBias` when that tier has candidates in the window. Falls
 * back to the candidate closest to the window (smallest overshoot past
 * maxDist, or smallest shortfall below MIN_DISTANCE_NM) when the window
 * itself is empty — which the origin feasibility filter below makes rare.
 */
function pickDestination(
  from: Airport,
  maxDist: number,
  regionId: string,
  rule: EndpointRule
): DestinationCandidate {
  const byDistance = candidatesByDistance(from, regionId, rule.to)
  const inWindow = byDistance.filter((c) => c.distance >= MIN_DISTANCE_NM && c.distance <= maxDist)
  if (inWindow.length > 0) {
    const biased = rule.destBias ? inWindow.filter((c) => c.airport.type === rule.destBias) : []
    if (biased.length > 0 && Math.random() < 0.7) return pick(biased)
    return pick(inWindow)
  }
  // The window is empty, so candidates split into a too-close prefix and a
  // too-far suffix (sorted ascending, nothing lands in between) — pick
  // whichever edge is nearer the window rather than blindly preferring
  // "beyond MIN" and risking a leg arbitrarily longer than maxDist allows.
  const tooClose = byDistance.filter((c) => c.distance < MIN_DISTANCE_NM)
  const tooFar = byDistance.filter((c) => c.distance > maxDist)
  const nearestClose = tooClose[tooClose.length - 1]
  const nearestFar = tooFar[0]
  if (nearestClose && nearestFar) {
    const shortfall = MIN_DISTANCE_NM - nearestClose.distance
    const overshoot = nearestFar.distance - maxDist
    return shortfall <= overshoot ? nearestClose : nearestFar
  }
  return nearestClose ?? nearestFar ?? byDistance[0]
}

/**
 * Origins that can actually be served: at least one allowed destination inside
 * the distance window. Without this, pickDestination's fallback quietly hands
 * out legs far longer than the type's cap allows.
 */
function feasibleOrigins(
  regionId: string,
  maxDist: number,
  rule: EndpointRule,
  cache?: Map<string, Airport[]>
): Airport[] {
  const key = `${regionId}|${maxDist}|${rule.from.join(',')}|${rule.to.join(',')}`
  const cached = cache?.get(key)
  if (cached) return cached

  const candidates = airportsInRegionOfTypes(regionId, rule.from)
  const destinations = airportsInRegionOfTypes(regionId, rule.to)
  const servable = candidates.filter((from) =>
    destinations.some((to) => {
      if (to.icao === from.icao) return false
      const d = distanceNm(from, to)
      return d >= MIN_DISTANCE_NM && d <= maxDist
    })
  )
  // Never strand generation: a pathologically sparse region falls back to the
  // unfiltered set, and pickDestination's own fallback then applies.
  const origins = servable.length > 0 ? servable : candidates
  cache?.set(key, origins)
  return origins
}

function pickOrigin(
  regionId: string,
  maxDist: number,
  rule: EndpointRule,
  cache?: Map<string, Airport[]>
): Airport {
  const origins = feasibleOrigins(regionId, maxDist, rule, cache)
  if (origins.length === 0) throw new Error(`No usable origin in region: ${regionId}`)
  const biased = rule.originBias ? origins.filter((a) => a.type === rule.originBias) : []
  if (biased.length > 0 && Math.random() < 0.7) return pick(biased)
  return pick(origins)
}

/** Generate a single mission valid on the given day, scaled by reputation and current fleet. */
export function generateMission(
  day: number,
  reputation: number,
  fleetSpecs: AircraftSpec[] = [],
  regionId: string,
  originCache?: Map<string, Airport[]>
): Mission {
  const cfg = weightedType(fleetSpecs)
  const timeCritical = TIME_CRITICAL_TYPES.has(cfg.type)
  const fleetMax = maxDistanceForFleet(fleetSpecs)
  const maxDist = timeCritical ? Math.min(fleetMax, TIME_CRITICAL_MAX_DISTANCE_NM) : fleetMax

  // Both endpoints stay inside the tiers the mission type allows, and the origin
  // must have at least one allowed destination inside the distance window.
  const from = pickOrigin(regionId, maxDist, cfg.endpoints, originCache)
  const { airport: to, distance: dist } = pickDestination(from, maxDist, regionId, cfg.endpoints)

  const maxSeats = maxSeatsForFleet(fleetSpecs)
  const hi = Math.min(cfg.seats[1], maxSeats)
  const lo = Math.min(cfg.seats[0], hi)
  const seats = randInt(lo, hi)
  const urgency = rollUrgency(cfg.type)
  const [dMin, dMax] = DEADLINE_DAYS[urgency]
  const reward = computeReward(dist, seats, urgency, reputation, timeCritical ? TIME_CRITICAL_REWARD_MULT : 1)

  const repReward =
    urgency === 'EMERGENCY' ? randInt(3, 5) : urgency === 'PRIORITY' ? randInt(2, 3) : randInt(1, 2)

  // The narrative is chosen after the destination, so its wording matches the
  // tier actually flown to; an empty filter falls back to the whole list.
  const fitting = cfg.narratives.filter((n) => !n.tiers || n.tiers.includes(to.type))
  const narrative = pick(fitting.length > 0 ? [...fitting] : [...cfg.narratives])

  return {
    id: uid('m'),
    type: cfg.type,
    title: `${cfg.label}: ${from.name} → ${to.name}`,
    description: narrative.text,
    fromIcao: from.icao,
    toIcao: to.icao,
    distanceNm: Math.round(dist),
    seatsRequired: seats,
    urgency,
    reward,
    penalty: Math.round(reward * 0.25),
    postedDay: day,
    expiresDay: day + randInt(dMin, dMax),
    reputationReward: repReward,
    windowMinutes: timeCritical ? timeCriticalWindowMinutes(Math.round(dist)) : undefined,
  }
}

/** Generate a batch of missions for the mission board. */
export function generateMissions(
  count: number,
  day: number,
  reputation: number,
  fleetSpecs: AircraftSpec[] = [],
  regionId: string
): Mission[] {
  // The feasibility filter is O(origins × destinations); one cache per board refill.
  const originCache = new Map<string, Airport[]>()
  return Array.from({ length: count }, () =>
    generateMission(day, reputation, fleetSpecs, regionId, originCache)
  )
}

export const missionTypeLabel = (t: MissionType): string =>
  TYPE_CONFIG.find((c) => c.type === t)?.label ?? t

export function routeSummary(m: Mission): string {
  const from = getAirport(m.fromIcao)
  const to = getAirport(m.toIcao)
  return `${from.icao} ${from.name} → ${to.icao} ${to.name}`
}

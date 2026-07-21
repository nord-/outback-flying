import { AIRPORTS, BASES, getAirport } from '../data/airports'
import { distanceNm } from './geo'
import { computeReward } from './economy'
import type { Mission, MissionType, Urgency } from './types'

let seq = 0
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface TypeConfig {
  type: MissionType
  label: string
  seats: [number, number] // inclusive range
  weight: number
  narratives: string[]
}

const TYPE_CONFIG: TypeConfig[] = [
  {
    type: 'MEDEVAC',
    label: 'Medical evacuation',
    seats: [1, 2],
    weight: 3,
    narratives: [
      'A stockman has been thrown from a horse on a remote station and needs urgent evacuation.',
      'A road accident on an isolated highway has left a patient in a critical condition.',
      'A child at a remote community has suspected appendicitis and must reach a hospital.',
    ],
  },
  {
    type: 'DOCTOR_TRANSPORT',
    label: 'Doctor transport',
    seats: [1, 3],
    weight: 2,
    narratives: [
      'A doctor must be flown out to assess an unwell patient at a cattle station.',
      'An emergency physician is needed at a small community clinic overnight.',
    ],
  },
  {
    type: 'PATIENT_TRANSFER',
    label: 'Patient transfer',
    seats: [1, 4],
    weight: 2,
    narratives: [
      'A stable patient needs transfer to a larger hospital for specialist care.',
      'A recovering patient is being repatriated closer to family.',
    ],
  },
  {
    type: 'SUPPLY_RUN',
    label: 'Supply run',
    seats: [0, 2],
    weight: 2,
    narratives: [
      'Medical supplies and vaccines must be delivered to an outback clinic.',
      'Blood products are urgently required at a regional hospital.',
    ],
  },
  {
    type: 'CLINIC_FLIGHT',
    label: 'Clinic flight',
    seats: [2, 5],
    weight: 1,
    narratives: [
      'A routine fly-in clinic run: transport a small health team to a remote settlement.',
      'A scheduled immunisation clinic needs its team flown out and back.',
    ],
  },
]

function weightedType(): TypeConfig {
  const total = TYPE_CONFIG.reduce((s, c) => s + c.weight, 0)
  let r = Math.random() * total
  for (const c of TYPE_CONFIG) {
    r -= c.weight
    if (r <= 0) return c
  }
  return TYPE_CONFIG[0]
}

function rollUrgency(type: MissionType): Urgency {
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

/** Generate a single mission valid on the given day, scaled by reputation. */
export function generateMission(day: number, reputation: number): Mission {
  const cfg = weightedType()

  // Origin favours bases; destination is any other airport within a sensible range.
  const from = Math.random() < 0.7 ? pick(BASES) : pick(AIRPORTS)
  let to = pick(AIRPORTS)
  let dist = distanceNm(from, to)
  let guard = 0
  while ((to.icao === from.icao || dist < 60 || dist > 1500) && guard++ < 40) {
    to = pick(AIRPORTS)
    dist = distanceNm(from, to)
  }

  const seats = randInt(cfg.seats[0], cfg.seats[1])
  const urgency = rollUrgency(cfg.type)
  const [dMin, dMax] = DEADLINE_DAYS[urgency]
  const reward = computeReward(dist, seats, urgency, reputation)

  const repReward =
    urgency === 'EMERGENCY' ? randInt(3, 5) : urgency === 'PRIORITY' ? randInt(2, 3) : randInt(1, 2)

  return {
    id: uid('m'),
    type: cfg.type,
    title: `${cfg.label}: ${from.name} → ${to.name}`,
    description: pick(cfg.narratives),
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
  }
}

/** Generate a batch of missions for the mission board. */
export function generateMissions(count: number, day: number, reputation: number): Mission[] {
  return Array.from({ length: count }, () => generateMission(day, reputation))
}

export const missionTypeLabel = (t: MissionType): string =>
  TYPE_CONFIG.find((c) => c.type === t)?.label ?? t

export function routeSummary(m: Mission): string {
  const from = getAirport(m.fromIcao)
  const to = getAirport(m.toIcao)
  return `${from.icao} ${from.name} → ${to.icao} ${to.name}`
}

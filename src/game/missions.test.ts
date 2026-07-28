import { describe, it, expect } from 'vitest'
import {
  generateMission,
  generateMissions,
  isTimeCritical,
  MIN_DISTANCE_NM,
  MAX_DISTANCE_NM,
  MAX_ORIGIN_DISTANCE_NM,
} from './missions'
import { distanceNm } from './geo'
import { getAirport, airportsInRegion } from '../data/airports'
import { getSpec } from '../data/aircraft'
import { REGIONS } from '../data/regions'
import { TIME_CRITICAL_MAX_DISTANCE_NM, EMERGENCY_MEDEVAC_MIN_SEATS } from './economy'
import type { AircraftSpec, FieldType, MissionType } from './types'

const SAMPLE_SIZE = 300
const PILOT = getAirport('YBAS') // Alice Springs — the default home base

const slowPistonSpec: AircraftSpec = {
  id: 'c172',
  name: 'Cessna 172 Skyhawk',
  category: 'Light piston',
  seats: 3,
  cruiseKts: 120,
  rangeNm: 640,
  minRunwayM: 400,
  fuelType: 'AVGAS',
  fuelCapacityL: 200,
  burnLph: 32,
  purchaseCost: 220000,
  maintPerHour: 45,
  dailyFixedCost: 60,
}

function averageDistance(fleetSpecs: AircraftSpec[]): number {
  const missions = generateMissions(SAMPLE_SIZE, 1, 50, fleetSpecs, 'outback', PILOT)
  const total = missions.reduce((sum, m) => sum + m.distanceNm, 0)
  return total / missions.length
}

describe('generateMissions distance rules', () => {
  it('always routes between two distinct airports within the global distance window', () => {
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [], 'outback', PILOT)
    for (const m of missions) {
      expect(m.fromIcao).not.toBe(m.toIcao)
      expect(m.distanceNm).toBeGreaterThanOrEqual(MIN_DISTANCE_NM)
      expect(m.distanceNm).toBeLessThanOrEqual(MAX_DISTANCE_NM)
      expect(distanceNm(getAirport(m.fromIcao), getAirport(m.toIcao))).toBeCloseTo(m.distanceNm, 0)
    }
  })

  it('still returns distinct, in-window airports for a slow-piston-only fleet', () => {
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [slowPistonSpec], 'outback', PILOT)
    for (const m of missions) {
      expect(m.fromIcao).not.toBe(m.toIcao)
      expect(m.distanceNm).toBeGreaterThanOrEqual(MIN_DISTANCE_NM)
      expect(m.distanceNm).toBeLessThanOrEqual(MAX_DISTANCE_NM)
    }
  })

  it('caps legs shorter on average for a slow fleet than for an uncapped one', () => {
    const uncapped = averageDistance([])
    const slowFleetCapped = averageDistance([slowPistonSpec])
    expect(slowFleetCapped).toBeLessThan(uncapped)
  })
})

const twoSeatSpec: AircraftSpec = { ...slowPistonSpec, id: 'c152', name: 'Cessna 152', seats: 2 }

describe('generateMissions seat rules', () => {
  it('never asks for more seats than the largest cabin in the fleet', () => {
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [twoSeatSpec], 'outback', PILOT)
    for (const m of missions) expect(m.seatsRequired).toBeLessThanOrEqual(2)
  })

  it('still allows larger seat counts when a bigger aircraft is owned', () => {
    const bigSpec: AircraftSpec = { ...slowPistonSpec, id: 'c208', seats: 9 }
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [twoSeatSpec, bigSpec], 'outback', PILOT)
    expect(Math.max(...missions.map((m) => m.seatsRequired))).toBeGreaterThan(2)
  })
})

// All seven types now that #11's time-critical pair has merged in — a full
// Record, so adding a mission type without an endpoint rule fails type-check.
const TIERS_BY_TYPE: Record<MissionType, { from: FieldType[]; to: FieldType[] }> = {
  MEDEVAC: { from: ['regional', 'strip'], to: ['hub', 'regional'] },
  PATIENT_TRANSFER: { from: ['hub', 'regional'], to: ['hub', 'regional'] },
  DOCTOR_TRANSPORT: { from: ['hub', 'regional'], to: ['hub', 'regional', 'strip'] },
  SUPPLY_RUN: { from: ['hub', 'regional'], to: ['hub', 'regional', 'strip'] },
  CLINIC_FLIGHT: { from: ['hub', 'regional'], to: ['hub', 'regional', 'strip'] },
  EMERGENCY_MEDEVAC: { from: ['regional', 'strip'], to: ['hub', 'regional'] },
  ORGAN_TRANSPORT: { from: ['hub', 'regional'], to: ['hub', 'regional'] },
}

describe('mission endpoint tiers', () => {
  it('keeps both endpoints inside the allowed tiers for every generated mission', () => {
    for (let i = 0; i < 400; i++) {
      const m = generateMission(1, 50, [], 'outback', PILOT)
      const rule = TIERS_BY_TYPE[m.type]
      expect(rule.from).toContain(getAirport(m.fromIcao).type)
      expect(rule.to).toContain(getAirport(m.toIcao).type)
    }
  })

  it('never ends a time-critical mission at a strip', () => {
    for (let i = 0; i < 400; i++) {
      const m = generateMission(1, 50, [], 'outback', PILOT)
      if (m.type !== 'EMERGENCY_MEDEVAC' && m.type !== 'ORGAN_TRANSPORT') continue
      expect(getAirport(m.toIcao).type).not.toBe('strip')
    }
  })

  it('never ends a MEDEVAC or PATIENT_TRANSFER at a strip', () => {
    for (let i = 0; i < 400; i++) {
      const m = generateMission(1, 50, [], 'outback', PILOT)
      if (m.type !== 'MEDEVAC' && m.type !== 'PATIENT_TRANSFER') continue
      expect(getAirport(m.toIcao).type).not.toBe('strip')
    }
  })

  it('does send outbound types to strips', () => {
    const outbound = new Set<MissionType>(['DOCTOR_TRANSPORT', 'SUPPLY_RUN', 'CLINIC_FLIGHT'])
    let sawStrip = false
    for (let i = 0; i < 600 && !sawStrip; i++) {
      const m = generateMission(1, 50, [], 'outback', PILOT)
      if (outbound.has(m.type) && getAirport(m.toIcao).type === 'strip') sawStrip = true
    }
    expect(sawStrip).toBe(true)
  })

  it('never sends the "regional hospital" supply-run narrative to a strip', () => {
    // TYPE_CONFIG is module-private, so assert the behaviour rather than the
    // table: the tier hint must keep this narrative off unsealed strips.
    for (let i = 0; i < 600; i++) {
      const m = generateMission(1, 50, [], 'outback', PILOT)
      if (m.type !== 'SUPPLY_RUN' || getAirport(m.toIcao).type !== 'strip') continue
      expect(m.description).not.toContain('regional hospital')
    }
  })

  it('never repatriates a patient to a capital hub', () => {
    for (let i = 0; i < 600; i++) {
      const m = generateMission(1, 50, [], 'outback', PILOT)
      if (m.type !== 'PATIENT_TRANSFER' || getAirport(m.toIcao).type !== 'hub') continue
      expect(m.description).not.toContain('closer to family')
    }
  })

  it('never describes a doctor flown to a hub as heading to an isolated settlement', () => {
    for (let i = 0; i < 600; i++) {
      const m = generateMission(1, 50, [], 'outback', PILOT)
      if (m.type !== 'DOCTOR_TRANSPORT' || getAirport(m.toIcao).type !== 'hub') continue
      expect(m.description).not.toContain('isolated settlement')
      expect(m.description).not.toContain('small community clinic')
    }
  })

  it('picks an origin that can actually be served inside the distance window', () => {
    // A slow fleet caps maxDist hard: maxDistanceForFleet uses
    // min(MAX_DISTANCE_NM, round(fastestCruiseKts * TARGET_MAX_FLIGHT_HOURS)),
    // so a lone C152 at 105 kt gives min(350, 210) = 210 — NOT 350. Asserting
    // against 350 would pass before the feasibility filter exists and prove
    // nothing; 210 is the bound the filter actually has to hold.
    const slow = [getSpec('c152')]
    const maxDist = Math.min(350, Math.round(getSpec('c152').cruiseKts * 2))
    expect(maxDist).toBe(210)
    for (let i = 0; i < 200; i++) {
      const m = generateMission(1, 50, slow, 'outback', PILOT)
      expect(m.distanceNm).toBeLessThanOrEqual(maxDist)
    }
  })

  it('checks a time-critical origin against the 150 nm cap, not the fleet range', () => {
    // The whole point of the feasibility filter, and only assertable once #11's
    // constant exists on this branch: maxDist for a time-critical mission is
    // min(fleetMax, TIME_CRITICAL_MAX_DISTANCE_NM), and that capped value is
    // what reaches feasibleOrigins. Without the filter, pickDestination's
    // fallback would hand out a leg far past 150 nm at a 1.3x reward.
    const missions = generateMissions(600, 1, 50, [], 'outback', PILOT).filter(isTimeCritical)
    expect(missions.length).toBeGreaterThan(0)
    for (const m of missions) {
      expect(m.distanceNm).toBeLessThanOrEqual(TIME_CRITICAL_MAX_DISTANCE_NM)
    }
  })

  it.each(REGIONS.map((r) => r.id))(
    'stays inside [MIN_DISTANCE_NM, MAX_DISTANCE_NM] and within the region for every field, not just outback (%s)',
    (regionId) => {
      // The endpoint rules, feasibility filter and narrative fallbacks above
      // are only ever exercised against 'outback' elsewhere in this file;
      // africa and namerica have sparser catalogues and were previously
      // unverified — a future data change stranding either would have passed
      // CI unnoticed.
      const home = getAirport(REGIONS.find((r) => r.id === regionId)!.homeBaseIcao)
      for (let i = 0; i < 150; i++) {
        const m = generateMission(1, 50, [], regionId, home)
        expect(m.distanceNm).toBeGreaterThanOrEqual(MIN_DISTANCE_NM)
        expect(m.distanceNm).toBeLessThanOrEqual(MAX_DISTANCE_NM)
        expect(getAirport(m.fromIcao).region).toBe(regionId)
        expect(getAirport(m.toIcao).region).toBe(regionId)
      }
    }
  )
})

const bigFleet = [getSpec('b200')]   // King Air, 8 seats — supports medevac
const lightFleet = [getSpec('c172')] // 3 seats — must never see a medevac

describe('time-critical mission generation', () => {
  it('stamps windowMinutes on time-critical types only', () => {
    const missions = generateMissions(400, 1, 50, bigFleet, 'outback', PILOT)
    for (const m of missions) {
      if (m.type === 'ORGAN_TRANSPORT' || m.type === 'EMERGENCY_MEDEVAC') {
        expect(m.windowMinutes).toBeGreaterThan(0)
        expect(isTimeCritical(m)).toBe(true)
      } else {
        expect(m.windowMinutes).toBeUndefined()
        expect(isTimeCritical(m)).toBe(false)
      }
    }
  })

  it('excludes EMERGENCY_MEDEVAC when the fleet cabin is below the floor', () => {
    const missions = generateMissions(400, 1, 50, lightFleet, 'outback', PILOT)
    expect(missions.some((m) => m.type === 'EMERGENCY_MEDEVAC')).toBe(false)
    // organ transport has no floor and can still appear
    expect(missions.some((m) => m.type === 'ORGAN_TRANSPORT')).toBe(true)
  })

  it('gives medevacs a cabin floor of at least the minimum', () => {
    const missions = generateMissions(400, 1, 50, bigFleet, 'outback', PILOT)
    for (const m of missions.filter((x) => x.type === 'EMERGENCY_MEDEVAC')) {
      expect(m.seatsRequired).toBeGreaterThanOrEqual(EMERGENCY_MEDEVAC_MIN_SEATS)
    }
  })

  it('keeps time-critical legs within the cap unless the origin has no closer neighbour', () => {
    const missions = generateMissions(400, 1, 50, bigFleet, 'outback', PILOT).filter(isTimeCritical)
    expect(missions.length).toBeGreaterThan(0)
    for (const m of missions) {
      if (m.distanceNm <= TIME_CRITICAL_MAX_DISTANCE_NM) continue
      // Over-cap is only permissible when the origin genuinely has no in-window
      // neighbour (pickDestination's documented fallback) — prove it.
      const from = getAirport(m.fromIcao)
      const hasCloser = airportsInRegion('outback').some((a) => {
        if (a.icao === from.icao) return false
        const d = distanceNm(from, a)
        return d >= MIN_DISTANCE_NM && d <= TIME_CRITICAL_MAX_DISTANCE_NM
      })
      expect(hasCloser).toBe(false)
    }
  })
})

describe('generateMissions origin proximity (#30)', () => {
  it('never starts a mission further than the origin radius from the pilot', () => {
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [], 'outback', PILOT)
    for (const m of missions) {
      expect(distanceNm(PILOT, getAirport(m.fromIcao))).toBeLessThanOrEqual(MAX_ORIGIN_DISTANCE_NM)
    }
  })

  it('starts a large share of missions at the pilot’s own field', () => {
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [], 'outback', PILOT)
    const here = missions.filter((m) => m.fromIcao === PILOT.icao).length
    // The ladder rolls 40% "at the pilot", and falls through when the pilot's
    // field is the wrong tier for the rolled mission type — YBAS is a hub, and
    // 5 of the 7 types allow a hub origin, so most rolls land. Measured over 40
    // trials of SAMPLE_SIZE missions: mean 0.434, min 0.383, sd 0.027. The 0.15
    // floor therefore sits ~10σ below the mean and well under the observed
    // minimum. This is the only stochastic assertion in the suite, and if it
    // ever flakes the floor is what should come down — a failure here does NOT
    // mean the ladder is wrong.
    expect(here / missions.length).toBeGreaterThan(0.15)
  })

  it('keeps origins near a pilot who has moved away from home', () => {
    const elsewhere = getAirport('YBHI') // Broken Hill, far from Alice Springs
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [], 'outback', elsewhere)
    for (const m of missions) {
      expect(distanceNm(elsewhere, getAirport(m.fromIcao))).toBeLessThanOrEqual(MAX_ORIGIN_DISTANCE_NM)
    }
    expect(missions.some((m) => m.fromIcao === 'YBHI')).toBe(true)
  })

  it('works from an off-field position, which has no icao to match', () => {
    const off = { lat: PILOT.lat + 0.4, lon: PILOT.lon + 0.4 }
    const missions = generateMissions(50, 1, 50, [], 'outback', off)
    for (const m of missions) {
      expect(distanceNm(off, getAirport(m.fromIcao))).toBeLessThanOrEqual(MAX_ORIGIN_DISTANCE_NM)
    }
  })

  it('still produces missions when the pilot is far from everything', () => {
    // Deep in the Indian Ocean: nothing is inside the radius, so the ladder
    // must fall back to a random feasible origin rather than throw.
    const remote = { lat: -30, lon: 100 }
    const missions = generateMissions(20, 1, 50, [], 'outback', remote)
    expect(missions).toHaveLength(20)
    for (const m of missions) expect(m.fromIcao).not.toBe(m.toIcao)
    // …and the board must not be degenerate. The fallback used to take the
    // *nearest* feasible origin, which is deterministic given the mission type,
    // so all 20 postings collapsed onto 2–3 fields (measured: min 2, max 3,
    // mean 2.79 over 200 trials). With a random pick: min 12, max 20, mean
    // 15.80, sd 1.54 over 200 trials. The floor of 6 sits ~6σ below the mean
    // and at half the observed minimum; if it ever flakes, lower the floor —
    // a failure here does NOT mean the fallback is wrong.
    expect(new Set(missions.map((m) => m.fromIcao)).size).toBeGreaterThanOrEqual(6)
  })
})

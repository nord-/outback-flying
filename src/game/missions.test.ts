import { describe, it, expect } from 'vitest'
import { generateMissions, isTimeCritical, MIN_DISTANCE_NM, MAX_DISTANCE_NM } from './missions'
import { distanceNm } from './geo'
import { getAirport, airportsInRegion } from '../data/airports'
import { getSpec } from '../data/aircraft'
import { TIME_CRITICAL_MAX_DISTANCE_NM, EMERGENCY_MEDEVAC_MIN_SEATS } from './economy'
import type { AircraftSpec } from './types'

const SAMPLE_SIZE = 300

const slowPistonSpec: AircraftSpec = {
  id: 'c172',
  name: 'Cessna 172 Skyhawk',
  category: 'Light piston',
  seats: 3,
  cruiseKts: 120,
  rangeNm: 640,
  fuelType: 'AVGAS',
  fuelCapacityL: 200,
  burnLph: 32,
  purchaseCost: 220000,
  maintPerHour: 45,
  dailyFixedCost: 60,
}

function averageDistance(fleetSpecs: AircraftSpec[]): number {
  const missions = generateMissions(SAMPLE_SIZE, 1, 50, fleetSpecs, 'outback')
  const total = missions.reduce((sum, m) => sum + m.distanceNm, 0)
  return total / missions.length
}

describe('generateMissions distance rules', () => {
  it('always routes between two distinct airports within the global distance window', () => {
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [], 'outback')
    for (const m of missions) {
      expect(m.fromIcao).not.toBe(m.toIcao)
      expect(m.distanceNm).toBeGreaterThanOrEqual(MIN_DISTANCE_NM)
      expect(m.distanceNm).toBeLessThanOrEqual(MAX_DISTANCE_NM)
      expect(distanceNm(getAirport(m.fromIcao), getAirport(m.toIcao))).toBeCloseTo(m.distanceNm, 0)
    }
  })

  it('still returns distinct, in-window airports for a slow-piston-only fleet', () => {
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [slowPistonSpec], 'outback')
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
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [twoSeatSpec], 'outback')
    for (const m of missions) expect(m.seatsRequired).toBeLessThanOrEqual(2)
  })

  it('still allows larger seat counts when a bigger aircraft is owned', () => {
    const bigSpec: AircraftSpec = { ...slowPistonSpec, id: 'c208', seats: 9 }
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [twoSeatSpec, bigSpec], 'outback')
    expect(Math.max(...missions.map((m) => m.seatsRequired))).toBeGreaterThan(2)
  })
})

const bigFleet = [getSpec('b200')]   // King Air, 8 seats — supports medevac
const lightFleet = [getSpec('c172')] // 3 seats — must never see a medevac

describe('time-critical mission generation', () => {
  it('stamps windowMinutes on time-critical types only', () => {
    const missions = generateMissions(400, 1, 50, bigFleet, 'outback')
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
    const missions = generateMissions(400, 1, 50, lightFleet, 'outback')
    expect(missions.some((m) => m.type === 'EMERGENCY_MEDEVAC')).toBe(false)
    // organ transport has no floor and can still appear
    expect(missions.some((m) => m.type === 'ORGAN_TRANSPORT')).toBe(true)
  })

  it('gives medevacs a cabin floor of at least the minimum', () => {
    const missions = generateMissions(400, 1, 50, bigFleet, 'outback')
    for (const m of missions.filter((x) => x.type === 'EMERGENCY_MEDEVAC')) {
      expect(m.seatsRequired).toBeGreaterThanOrEqual(EMERGENCY_MEDEVAC_MIN_SEATS)
    }
  })

  it('keeps time-critical legs within the cap unless the origin has no closer neighbour', () => {
    const missions = generateMissions(400, 1, 50, bigFleet, 'outback').filter(isTimeCritical)
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

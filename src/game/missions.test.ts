import { describe, it, expect } from 'vitest'
import { generateMissions, MIN_DISTANCE_NM, MAX_DISTANCE_NM } from './missions'
import { distanceNm } from './geo'
import { getAirport } from '../data/airports'
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
  const missions = generateMissions(SAMPLE_SIZE, 1, 50, fleetSpecs)
  const total = missions.reduce((sum, m) => sum + m.distanceNm, 0)
  return total / missions.length
}

describe('generateMissions distance rules', () => {
  it('always routes between two distinct airports within the global distance window', () => {
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [])
    for (const m of missions) {
      expect(m.fromIcao).not.toBe(m.toIcao)
      expect(m.distanceNm).toBeGreaterThanOrEqual(MIN_DISTANCE_NM)
      expect(m.distanceNm).toBeLessThanOrEqual(MAX_DISTANCE_NM)
      expect(distanceNm(getAirport(m.fromIcao), getAirport(m.toIcao))).toBeCloseTo(m.distanceNm, 0)
    }
  })

  it('still returns distinct, in-window airports for a slow-piston-only fleet', () => {
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [slowPistonSpec])
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
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [twoSeatSpec])
    for (const m of missions) expect(m.seatsRequired).toBeLessThanOrEqual(2)
  })

  it('still allows larger seat counts when a bigger aircraft is owned', () => {
    const bigSpec: AircraftSpec = { ...slowPistonSpec, id: 'c208', seats: 9 }
    const missions = generateMissions(SAMPLE_SIZE, 1, 50, [twoSeatSpec, bigSpec])
    expect(Math.max(...missions.map((m) => m.seatsRequired))).toBeGreaterThan(2)
  })
})

import { describe, it, expect } from 'vitest'
import { REGIONS, getRegion } from './regions'
import { AIRPORTS, airportsInRegion, basesInRegion, getAirport } from './airports'

describe('regions', () => {
  it('every airport is tagged with a known region', () => {
    const ids = new Set(REGIONS.map((r) => r.id))
    for (const a of AIRPORTS) expect(ids.has(a.region)).toBe(true)
  })

  it('each region has airports, at least one base, and a valid home base in-region', () => {
    for (const r of REGIONS) {
      expect(airportsInRegion(r.id).length).toBeGreaterThan(0)
      expect(basesInRegion(r.id).length).toBeGreaterThan(0)
      const home = getAirport(r.homeBaseIcao)
      expect(home.region).toBe(r.id)
      expect(home.isBase).toBe(true)
    }
  })

  it('airport icaos are globally unique across regions', () => {
    const icaos = AIRPORTS.map((a) => a.icao)
    expect(new Set(icaos).size).toBe(icaos.length)
  })

  it('getRegion throws for an unknown id', () => {
    expect(() => getRegion('atlantis')).toThrow()
  })
})

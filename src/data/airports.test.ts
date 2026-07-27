import { describe, it, expect } from 'vitest'
import { AIRPORTS, airportOffersFuel, airportsInRegionOfTypes, classifyFuel, hubsInRegion } from './airports'
import { distanceNm } from '../game/geo'
import { REGIONS } from './regions'

describe('airport tiers', () => {
  it('every airport has a valid tier', () => {
    for (const a of AIRPORTS) {
      expect(['hub', 'regional', 'strip']).toContain(a.type)
    }
  })

  it('prices fuel by tier: hub 1.0, regional 1.1, strip 1.35', () => {
    const expected = { hub: 1.0, regional: 1.1, strip: 1.35 } as const
    for (const a of AIRPORTS) {
      expect(a.fuelPriceMult).toBe(expected[a.type])
    }
  })

  it('hubsInRegion returns only hubs, scoped to the region', () => {
    const hubs = hubsInRegion('outback')
    expect(hubs.length).toBeGreaterThan(0)
    for (const h of hubs) {
      expect(h.type).toBe('hub')
      expect(h.region).toBe('outback')
    }
  })

  it('airportsInRegionOfTypes filters on the given tiers', () => {
    const got = airportsInRegionOfTypes('outback', ['hub'])
    expect(got).toEqual(hubsInRegion('outback'))
  })
})

describe('airportOffersFuel', () => {
  it('is true for a type the field offers', () => {
    expect(airportOffersFuel('YBAS', 'AVGAS')).toBe(true)
  })
  it('is false for an unknown field', () => {
    expect(airportOffersFuel('ZZZZ', 'AVGAS')).toBe(false)
  })
})

describe('classifyFuel', () => {
  it('returns no-fuel for an empty offering', () => {
    expect(classifyFuel([], 'AVGAS')).toBe('no-fuel')
  })
  it('returns wrong-type when the needed type is absent', () => {
    expect(classifyFuel(['JETA'], 'AVGAS')).toBe('wrong-type')
  })
  it('returns ok when the needed type is offered', () => {
    expect(classifyFuel(['AVGAS', 'JETA'], 'AVGAS')).toBe('ok')
  })
})

describe('airport physical data', () => {
  it('every airport has a positive runway length', () => {
    for (const a of AIRPORTS) {
      expect(a.runwayM).toBeGreaterThan(0)
    }
  })

  it('every airport has a known surface', () => {
    for (const a of AIRPORTS) {
      expect(['sealed', 'gravel', 'dirt', 'grass', 'sand']).toContain(a.surface)
    }
  })

  it('hubs and regional fields still offer both fuel types', () => {
    // Guards against the curation script silently blanking fuelTypes on an
    // existing field while enriching it — the removed "both fuel types" test
    // was the only thing catching that.
    for (const a of AIRPORTS) {
      if (a.type === 'strip') continue
      expect(a.fuelTypes).toEqual(['AVGAS', 'JETA'])
    }
  })
})

describe('bush strips', () => {
  const strips = AIRPORTS.filter((a) => a.type === 'strip')

  it('every region has strips', () => {
    for (const r of REGIONS) {
      expect(AIRPORTS.filter((a) => a.region === r.id && a.type === 'strip').length).toBeGreaterThan(0)
    }
  })

  it('no strip offers Jet A', () => {
    for (const s of strips) {
      expect(s.fuelTypes).not.toContain('JETA')
    }
  })

  it('every strip sits at least 12 nm from every other field in its region', () => {
    // nearestAirport() in flightlog.ts matches landings within 5 nm; a denser
    // catalogue would start attributing landings to the wrong field.
    for (const s of strips) {
      for (const other of AIRPORTS) {
        if (other.icao === s.icao || other.region !== s.region) continue
        expect(distanceNm(s, other)).toBeGreaterThanOrEqual(12)
      }
    }
  })

  it('every strip has a hub or regional field within 350 nm', () => {
    // Otherwise it can never be a mission destination (MAX_DISTANCE_NM), and a
    // medevac originating there would have nowhere to go.
    for (const s of strips) {
      const reachable = AIRPORTS.filter(
        (a) => a.region === s.region && a.type !== 'strip' && distanceNm(s, a) <= 350
      )
      expect(reachable.length).toBeGreaterThan(0)
    }
  })
})

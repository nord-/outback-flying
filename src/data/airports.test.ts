import { describe, it, expect } from 'vitest'
import { AIRPORTS, airportOffersFuel, classifyFuel } from './airports'

describe('airport fuel data', () => {
  it('every catalogue airport offers both fuel types today', () => {
    for (const a of AIRPORTS) {
      expect(a.fuelTypes).toEqual(['AVGAS', 'JETA'])
    }
  })

  it('bases price fuel at 1.0 and non-bases at 1.1', () => {
    for (const a of AIRPORTS) {
      expect(a.fuelPriceMult).toBe(a.isBase ? 1.0 : 1.1)
    }
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

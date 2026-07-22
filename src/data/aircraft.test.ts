import { describe, it, expect } from 'vitest'
import { AIRCRAFT_SPECS, STARTER_OPTIONS, getSpec } from './aircraft'

describe('aircraft catalogue', () => {
  it('includes the issue-required Bonanza and Kodiak 100', () => {
    const ids = AIRCRAFT_SPECS.map((s) => s.id)
    expect(ids).toContain('bonanza')
    expect(ids).toContain('kodiak')
    expect(getSpec('bonanza').name).toMatch(/Bonanza/)
    expect(getSpec('kodiak').name).toMatch(/Kodiak/)
  })

  it('drops the removed Cessna 210 and PA-31 ids', () => {
    const ids = AIRCRAFT_SPECS.map((s) => s.id)
    expect(ids).not.toContain('c210')
    expect(ids).not.toContain('pa31')
  })

  it('has unique ids and only valid categories', () => {
    const ids = AIRCRAFT_SPECS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    const valid = new Set(['Light piston', 'High-performance piston', 'Turboprop', 'Jet'])
    for (const s of AIRCRAFT_SPECS) expect(valid.has(s.category)).toBe(true)
  })

  it('exposes four starter options that all resolve to real specs', () => {
    expect(STARTER_OPTIONS.map((o) => o.specId)).toEqual(['c152', 'c172', 'bonanza', 'pc6'])
    for (const o of STARTER_OPTIONS) expect(() => getSpec(o.specId)).not.toThrow()
  })

  it('sets the documented starting balances', () => {
    const bal = Object.fromEntries(STARTER_OPTIONS.map((o) => [o.specId, o.startingBalance]))
    expect(bal).toEqual({ c152: 30000, c172: 20000, bonanza: 1000, pc6: -20000 })
  })
})

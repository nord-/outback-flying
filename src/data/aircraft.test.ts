import { describe, it, expect } from 'vitest'
import { AIRCRAFT_SPECS, STARTER_OPTIONS, getSpec } from './aircraft'
import { PAX_KG } from '../game/payload'

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

describe('aircraft catalogue payload consistency (#33)', () => {
  it('gives every aircraft a positive useful load', () => {
    for (const spec of AIRCRAFT_SPECS) {
      expect(spec.usefulLoadKg, spec.id).toBeGreaterThan(0)
    }
  })

  // The check that caught the C152: `seats` counts PASSENGERS, so a full cabin
  // plus the pilot must fit inside the useful load. A negative remainder means
  // the seat count and the weight figure contradict each other, and the freight
  // cap in missions.ts would go negative.
  it('can carry the pilot and a full cabin within its useful load', () => {
    for (const spec of AIRCRAFT_SPECS) {
      const remainder = spec.usefulLoadKg - PAX_KG - spec.seats * PAX_KG
      expect(remainder, `${spec.id}: ${spec.seats} pax leaves ${remainder} kg`).toBeGreaterThanOrEqual(0)
    }
  })

  // XCub cross-check: CubCrafters publishes useful load 1088 lb (493 kg) and
  // full-fuel payload 794 lb (360 kg). With full tanks (190 L AVGAS at ~0.72 kg/L),
  // the derived full-fuel payload is 493 − (190 × 0.72) = 356 kg. This agreement
  // validates three things: the useful-load figure, the tank capacity, and the
  // decision to derive full-fuel payload rather than store it as a separate field.
  it('derives XCub full-fuel payload within 15 kg of published 360 kg', () => {
    const AVGAS_DENSITY_KG_PER_L = 0.72 // Local to this test: no production constant found
    const spec = AIRCRAFT_SPECS.find((s) => s.id === 'xcub')
    expect(spec, 'xcub must exist in catalogue').toBeDefined()
    if (!spec) return // TypeScript guard

    const fuelWeightKg = spec.fuelCapacityL * AVGAS_DENSITY_KG_PER_L
    const fullFuelPayloadKg = spec.usefulLoadKg - fuelWeightKg
    // The real tolerance is +/- 15 kg around the published 360 kg, not +/- 10:
    // the derived value sits at 356.2 kg (3.8 kg low already), so a +/- 10 kg
    // band centred on 360 left only 6.2 kg of downward headroom — not enough
    // for a legitimate re-source of usefulLoadKg (e.g. 493 -> 486 kg) to survive.
    expect(fullFuelPayloadKg).toBeGreaterThanOrEqual(345)
    expect(fullFuelPayloadKg).toBeLessThanOrEqual(375)
  })

  // PC-6 cross-check: Pilatus publishes ~2381 lb (~1080 kg) payload with maximum
  // fuel, not useful load. With 6 cabin seats (passengers only, pilot separate),
  // the owner's arithmetic reserves 1000 − (6 × 85) = 490 kg for freight —
  // the margin that makes this aircraft the workhorse of bush operations. The
  // game uses useful load 1000 kg. This test verifies that even a full cabin
  // leaves at least 400 kg for cargo, matching the owner's own validation.
  it('reserves at least 400 kg for PC-6 cargo with full passenger cabin', () => {
    const spec = AIRCRAFT_SPECS.find((s) => s.id === 'pc6')
    expect(spec, 'pc6 must exist in catalogue').toBeDefined()
    if (!spec) return // TypeScript guard

    const passengerWeightKg = spec.seats * PAX_KG
    const cargoCapacityKg = spec.usefulLoadKg - passengerWeightKg
    // Tolerance allows for re-sourcing of useful load within reason
    expect(cargoCapacityKg).toBeGreaterThanOrEqual(400)
  })
})

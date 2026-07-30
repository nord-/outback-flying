import { describe, it, expect } from 'vitest'
import {
  SURFACE_FACTOR,
  fieldSuitability,
  landingWear,
  requiredRunwayM,
  runwayMargin,
} from './fields'
import { getSpec } from '../data/aircraft'
import type { Airport, Surface } from './types'

/** A field with only the properties the rules are allowed to read (B6). */
const field = (runwayM: number | null, surface: Surface): Airport => ({
  icao: 'TEST',
  name: 'Test Field',
  state: 'NT',
  region: 'outback',
  lat: 0,
  lon: 0,
  type: 'strip',
  runwayM,
  surface,
  lighted: false,
  fuelTypes: [],
  fuelPriceMult: 1.35,
})

describe('requiredRunwayM', () => {
  it('is the spec minimum on a sealed runway', () => {
    expect(requiredRunwayM(getSpec('b200'), 'sealed')).toBe(750)
  })

  it('scales by the surface factor on unsealed ground', () => {
    expect(requiredRunwayM(getSpec('b200'), 'dirt')).toBeCloseTo(862.5, 1)
  })

  it('sealed has factor 1.0 exactly', () => {
    expect(SURFACE_FACTOR.sealed).toBe(1.0)
  })
})

describe('runwayMargin', () => {
  it('is runway length over the surface-adjusted requirement', () => {
    expect(runwayMargin(field(915, 'dirt'), getSpec('b200'))).toBeCloseTo(1.061, 3)
  })

  it('is NaN when the runway length is unverified', () => {
    expect(runwayMargin(field(null, 'unknown'), getSpec('b200'))).toBeNaN()
  })
})

describe('fieldSuitability', () => {
  it('is short below 1.0', () => {
    expect(fieldSuitability(field(700, 'dirt'), getSpec('b200'))).toBe('short')
  })

  it('is marginal just inside the lower bound', () => {
    // b200 on dirt needs 750 * 1.15 ≈ 862.5 m, so 863 m is margin ~1.0006.
    // Deliberately NOT testing the exact boundary: 750 * 1.15 evaluates to
    // 862.4999999999999 in IEEE 754, so an "exactly 1.0" or "exactly 1.15"
    // input only lands on the intended side of the comparison by luck.
    expect(fieldSuitability(field(863, 'dirt'), getSpec('b200'))).toBe('marginal')
  })

  it('is marginal just below the upper bound', () => {
    expect(fieldSuitability(field(991, 'dirt'), getSpec('b200'))).toBe('marginal')
  })

  it('is ok just above the upper bound', () => {
    // 862.5 * 1.15 ≈ 991.9, so 992 m clears it
    expect(fieldSuitability(field(992, 'dirt'), getSpec('b200'))).toBe('ok')
  })

  it('is unknown when the runway length is unverified', () => {
    expect(fieldSuitability(field(null, 'unknown'), getSpec('b200'))).toBe('unknown')
  })
})

describe('landingWear', () => {
  it('is zero on a sealed runway with room to spare', () => {
    expect(landingWear(field(2000, 'sealed'), getSpec('b200'))).toBe(0)
  })

  it('charges only the surface baseline once margin reaches 1.15', () => {
    // PC-6 needs 250 * 1.15 = 287.5 m on dirt; 1240 m is margin 4.3
    expect(landingWear(field(1240, 'dirt'), getSpec('pc6'))).toBe(0.15)
  })

  it('matches the real-world King Air case: 915 m dirt costs a third of a point', () => {
    // The calibration anchor from the design spec (B7): a 350 lifting pax out
    // of a 3000 ft dirt strip is an operating cost, not a penalty.
    expect(landingWear(field(915, 'dirt'), getSpec('b200'))).toBe(0.33)
  })

  it('bites hard when the runway is genuinely too short', () => {
    expect(landingWear(field(700, 'dirt'), getSpec('b200'))).toBe(1.96)
  })

  it('caps the margin penalty at 4.0, with the surface baseline on top', () => {
    // 100 m of dirt for a King Air is margin 0.116 → raw penalty
    // 0.3 + 0.884 * 8 = 7.37, capped to 4.0; dirt adds 0.15 → 4.15
    expect(landingWear(field(100, 'dirt'), getSpec('b200'))).toBe(4.15)
  })

  it('is trivial for a light piston on grass', () => {
    // C172 needs 400 * 1.10 = 440 m; 700 m is margin 1.59
    expect(landingWear(field(700, 'grass'), getSpec('c172'))).toBe(0.05)
  })

  it('peaks the marginal-band penalty at the lower boundary, margin exactly 1.0', () => {
    // pc6 needs 250 * 1.15 = 287.5 m on dirt; runway == required is margin
    // exactly 1.0 (both are exact doubles, no rounding). At the boundary the
    // marginal branch is used (not the short branch), giving its max: 0.3 +
    // the dirt surface baseline (0.15).
    expect(landingWear(field(287.5, 'dirt'), getSpec('pc6'))).toBe(0.45)
  })

  it('collapses to just the surface baseline at the upper boundary, margin exactly 1.15', () => {
    // 287.5 * 1.15 = 330.625, an exact double (verified: 330.625 / 287.5 === 1.15).
    expect(landingWear(field(330.625, 'dirt'), getSpec('pc6'))).toBe(0.15)
  })

  it('charges the worst-case penalty when the runway length is unverified', () => {
    expect(landingWear(field(null, 'unknown'), getSpec('b200'))).toBe(4.25)
  })
})

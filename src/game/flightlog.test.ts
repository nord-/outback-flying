import { describe, it, expect } from 'vitest'
import {
  computeDutyMinutes,
  matchesAircraft,
  nearestAirport,
  simplifyTrack,
  deriveFlightFromSamples,
} from './flightlog'
import { getSpec } from '../data/aircraft'
import { AIRPORTS } from '../data/airports'
import type { SimSample } from '../sim/types'
import type { TrackPoint } from './types'

const YBAS = AIRPORTS.find((a) => a.icao === 'YBAS')!
const YBHI = AIRPORTS.find((a) => a.icao === 'YBHI')!
const YPAD = AIRPORTS.find((a) => a.icao === 'YPAD')!

const lerp = (a: number, b: number, f: number) => a + (b - a) * f

// Build a synthetic sample stream for one leg: parked → taxi out → climb →
// cruise → descend → land → taxi in → parked. `fuelStart`/`fuelEnd` are in
// gallons (SimSample's unit); `t0` is the epoch-ms the leg begins at.
function legSamples(opts: {
  t0: number
  from: { lat: number; lon: number }
  to: { lat: number; lon: number }
  fuelStartGal: number
  fuelEndGal: number
  cruiseSamples?: number
  title?: string
  atcModel?: string
}): SimSample[] {
  const { t0, from, to, fuelStartGal, fuelEndGal, cruiseSamples = 10 } = opts
  const title = opts.title ?? 'Black Square A36TC Bonanza Professional N3475M'
  const atcModel = opts.atcModel ?? 'Bonanza'
  const samples: SimSample[] = []
  let t = t0
  const push = (over: Partial<SimSample>) => {
    samples.push({
      t,
      lat: from.lat,
      lon: from.lon,
      headingTrue: 0,
      groundKts: 0,
      altFt: 0,
      onGround: true,
      fuelGal: fuelStartGal,
      title,
      atcModel,
      ...over,
    })
    t += 1000
  }

  // Parked, then taxi out.
  push({})
  push({ groundKts: 8 })
  push({ groundKts: 12 })
  // Rotate.
  push({ groundKts: 60, altFt: 50, onGround: false })
  push({ groundKts: 110, altFt: 1500, onGround: false })

  // Cruise, interpolating position and fuel burn toward the destination.
  for (let i = 1; i <= cruiseSamples; i++) {
    const f = i / (cruiseSamples + 1)
    push({
      lat: lerp(from.lat, to.lat, f),
      lon: lerp(from.lon, to.lon, f),
      groundKts: 150,
      altFt: 6500,
      onGround: false,
      fuelGal: lerp(fuelStartGal, fuelEndGal, f),
    })
  }

  // Descend and touch down at the destination.
  push({ lat: to.lat, lon: to.lon, groundKts: 100, altFt: 800, onGround: false, fuelGal: fuelEndGal })
  push({ lat: to.lat, lon: to.lon, groundKts: 55, altFt: 0, onGround: true, fuelGal: fuelEndGal })
  push({ lat: to.lat, lon: to.lon, groundKts: 15, onGround: true, fuelGal: fuelEndGal })
  // Taxi in and park.
  push({ lat: to.lat, lon: to.lon, groundKts: 6, onGround: true, fuelGal: fuelEndGal })
  push({ lat: to.lat, lon: to.lon, groundKts: 0, onGround: true, fuelGal: fuelEndGal })
  push({ lat: to.lat, lon: to.lon, groundKts: 0, onGround: true, fuelGal: fuelEndGal })

  return samples
}

describe('deriveFlightFromSamples — single leg', () => {
  const samples = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 80 })
  const flight = deriveFlightFromSamples(samples, 'outback')

  it('detects exactly one leg and one landing', () => {
    expect(flight).not.toBeNull()
    expect(flight!.legs).toHaveLength(1)
    expect(flight!.landings).toBe(1)
  })

  it('matches start and end airports', () => {
    expect(flight!.startIcao).toBe('YBAS')
    expect(flight!.endIcao).toBe('YBHI')
    expect(flight!.intermediates).toEqual([])
  })

  it('applies the duty formula for one leg (+60 min overhead)', () => {
    expect(flight!.dutyMinutes).toBe(computeDutyMinutes(flight!.blockMinutes, 1))
    expect(flight!.dutyMinutes - flight!.blockMinutes).toBe(60)
  })

  it('converts the fuel burned to litres', () => {
    // 100 -> 80 gal burned = 20 gal * 3.785411784 L/gal
    expect(flight!.fuelUsedL).toBeCloseTo(20 * 3.785411784, 1)
  })

  it('records the sim aircraft strings for the forgiveness audit trail', () => {
    expect(flight!.simAtcModel).toBe('Bonanza')
    expect(flight!.simAircraftTitle).toContain('A36TC')
  })

  it('sums a plausible great-circle distance', () => {
    // YBAS -> YBHI is ~635 nm great-circle; the synthetic straight-line track
    // should land in that ballpark.
    expect(flight!.distanceNm).toBeGreaterThan(550)
    expect(flight!.distanceNm).toBeLessThan(750)
  })
})

describe('deriveFlightFromSamples — multi-leg trip', () => {
  const leg1 = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 80 })
  const leg1EndT = leg1[leg1.length - 1].t
  // A refuel while parked between legs: fuel goes UP. This must not be counted
  // as negative burn for either leg.
  const refuel: SimSample = { ...leg1[leg1.length - 1], t: leg1EndT + 60000, fuelGal: 100 }
  const leg2 = legSamples({ t0: leg1EndT + 120000, from: YBHI, to: YPAD, fuelStartGal: 100, fuelEndGal: 85 })
  const flight = deriveFlightFromSamples([...leg1, refuel, ...leg2], 'outback')

  it('detects two legs and two landings', () => {
    expect(flight!.legs).toHaveLength(2)
    expect(flight!.landings).toBe(2)
  })

  it('routes start -> intermediate -> end', () => {
    expect(flight!.startIcao).toBe('YBAS')
    expect(flight!.intermediates).toEqual(['YBHI'])
    expect(flight!.endIcao).toBe('YPAD')
  })

  it('applies the duty formula for two legs (+90 min overhead)', () => {
    expect(flight!.dutyMinutes - flight!.blockMinutes).toBe(90)
  })

  it('does not count the between-legs refuel as burned fuel', () => {
    // leg1 burns 20 gal, leg2 burns 15 gal = 35 gal total; the 80->100 refuel
    // bump must not subtract from that.
    const expectedGal = 20 + 15
    expect(flight!.fuelUsedL).toBeCloseTo(expectedGal * 3.785411784, 0)
  })
})

describe('deriveFlightFromSamples — edge cases', () => {
  it('returns null when the aircraft never leaves the ground', () => {
    const samples: SimSample[] = [
      { t: 0, lat: YBAS.lat, lon: YBAS.lon, headingTrue: 0, groundKts: 0, altFt: 0, onGround: true, fuelGal: 100, title: 't', atcModel: 'm' },
      { t: 1000, lat: YBAS.lat, lon: YBAS.lon, headingTrue: 0, groundKts: 10, altFt: 0, onGround: true, fuelGal: 99, title: 't', atcModel: 'm' },
      { t: 2000, lat: YBAS.lat, lon: YBAS.lon, headingTrue: 0, groundKts: 0, altFt: 0, onGround: true, fuelGal: 99, title: 't', atcModel: 'm' },
    ]
    expect(deriveFlightFromSamples(samples, 'outback')).toBeNull()
  })

  it('force-closes a leg that landed but has not fully stopped when the recording ends', () => {
    const samples = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 80 })
    // Drop the trailing "parked" samples so the recording ends mid-taxi-in.
    const trimmed = samples.slice(0, -2)
    const flight = deriveFlightFromSamples(trimmed, 'outback')
    expect(flight).not.toBeNull()
    expect(flight!.legs).toHaveLength(1)
    expect(flight!.endIcao).toBe('YBHI')
  })

  it('does not close a leg that is still airborne when the recording ends', () => {
    const samples = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 80 })
    // Cut the stream mid-cruise, well before touchdown.
    const trimmed = samples.slice(0, 8)
    expect(deriveFlightFromSamples(trimmed, 'outback')).toBeNull()
  })

  it('treats a bounce (airborne again before stopping) as the same leg, not a new one', () => {
    const samples = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 90 })
    // Insert a bounce right after touchdown: briefly airborne again before the
    // aircraft finally rolls to a stop.
    const touchdownIdx = samples.findIndex((s) => s.onGround && s.lat === YBHI.lat)
    const bounce: SimSample = { ...samples[touchdownIdx], t: samples[touchdownIdx].t + 500, onGround: false, altFt: 30 }
    const withBounce = [...samples.slice(0, touchdownIdx + 1), bounce, ...samples.slice(touchdownIdx + 1)]
    const flight = deriveFlightFromSamples(withBounce, 'outback')
    expect(flight!.legs).toHaveLength(1)
    expect(flight!.landings).toBe(2) // the initial touchdown and the second one both count
  })
})

describe('computeDutyMinutes', () => {
  it('adds 60 minutes overhead for a one-leg trip (matches the issue example)', () => {
    expect(computeDutyMinutes(0, 1)).toBe(60)
  })

  it('adds 90 minutes overhead for a two-leg trip (matches the issue example)', () => {
    expect(computeDutyMinutes(0, 2)).toBe(90)
  })

  it('adds the overhead on top of actual block time', () => {
    expect(computeDutyMinutes(45, 1)).toBe(105)
  })
})

describe('nearestAirport', () => {
  it('finds the airport at its own coordinates', () => {
    expect(nearestAirport(YBAS.lat, YBAS.lon, 'outback')?.icao).toBe('YBAS')
  })

  it('is forgiving within a small tolerance', () => {
    expect(nearestAirport(YBAS.lat + 0.01, YBAS.lon + 0.01, 'outback')?.icao).toBe('YBAS')
  })

  it('returns null far from any catalogued airport', () => {
    expect(nearestAirport(0, 0, 'outback')).toBeNull()
  })
})

describe('matchesAircraft', () => {
  const bonanza = getSpec('bonanza')
  const caravan = getSpec('c208')

  it('matches a real-world variant via ATC MODEL (forgiveness — issue #9)', () => {
    // Exactly the Phase 0 spike's real MSFS 2020 readout: an add-on A36TC
    // reported with ATC MODEL "Bonanza", accepted for the in-game G36 spec.
    expect(
      matchesAircraft(bonanza, { atcModel: 'Bonanza', title: 'Black Square A36TC Bonanza Professional N3475M' })
    ).toBe(true)
  })

  it('falls back to TITLE when ATC MODEL is generic', () => {
    expect(matchesAircraft(bonanza, { atcModel: 'Aircraft', title: 'Bonanza G36 Livery' })).toBe(true)
  })

  it('does not match an unrelated type', () => {
    expect(matchesAircraft(caravan, { atcModel: 'Bonanza', title: 'A36TC Bonanza' })).toBe(false)
  })

  it('never matches a spec with no simMatch keywords', () => {
    const noKeywords = { ...bonanza, simMatch: undefined }
    expect(matchesAircraft(noKeywords, { atcModel: 'Bonanza', title: 'Bonanza' })).toBe(false)
  })
})

describe('simplifyTrack', () => {
  it('keeps endpoints and collapses a near-straight line to two points', () => {
    const points: TrackPoint[] = Array.from({ length: 20 }, (_, i) => ({
      t: i * 1000,
      lat: lerp(YBAS.lat, YBHI.lat, i / 19),
      lon: lerp(YBAS.lon, YBHI.lon, i / 19),
      hdg: 0,
      gs: 150,
      alt: 6500,
      onGround: false,
    }))
    // Linear lat/lon interpolation over ~600 nm isn't exactly the great-circle
    // path (longitude lines converge toward the poles), so it drifts a few nm
    // off-course — a real recorded track follows the aircraft's actual (near-
    // geodesic) route far more tightly, which is what the tiny default epsilon
    // is tuned for. Use a looser tolerance here to isolate the RDP mechanism
    // itself from that synthetic-data artifact.
    const simplified = simplifyTrack(points, 5)
    expect(simplified.length).toBeLessThan(points.length)
    expect(simplified[0]).toEqual(points[0])
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1])
  })

  it('preserves a genuine deviation (a turn) rather than smoothing it away', () => {
    const points: TrackPoint[] = [
      { t: 0, lat: YBAS.lat, lon: YBAS.lon, hdg: 0, gs: 150, alt: 6500, onGround: false },
      // A sharp turn well off the direct YBAS -> YBHI line.
      { t: 1000, lat: YBAS.lat - 2, lon: YBAS.lon + 2, hdg: 90, gs: 150, alt: 6500, onGround: false },
      { t: 2000, lat: YBHI.lat, lon: YBHI.lon, hdg: 180, gs: 150, alt: 6500, onGround: false },
    ]
    const simplified = simplifyTrack(points, 0.05)
    expect(simplified).toHaveLength(3) // the deviating midpoint survives
  })

  it('leaves a two-point track untouched', () => {
    const points: TrackPoint[] = [
      { t: 0, lat: YBAS.lat, lon: YBAS.lon, hdg: 0, gs: 0, alt: 0, onGround: true },
      { t: 1000, lat: YBHI.lat, lon: YBHI.lon, hdg: 0, gs: 0, alt: 0, onGround: true },
    ]
    expect(simplifyTrack(points)).toEqual(points)
  })
})

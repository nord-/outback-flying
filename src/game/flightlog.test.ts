import { describe, it, expect } from 'vitest'
import {
  computeDutyMinutes,
  matchesAircraft,
  nearestAirport,
  simCapacityL,
  simplifyTrack,
  initRecorderState,
  recordSample,
  STATIONARY_KTS,
} from './flightlog'
import { getSpec } from '../data/aircraft'
import { AIRPORTS } from '../data/airports'
import type { SimSample } from '../sim/types'
import type { TrackPoint } from './types'

const YBAS = AIRPORTS.find((a) => a.icao === 'YBAS')!
const YBHI = AIRPORTS.find((a) => a.icao === 'YBHI')!
const YPAD = AIRPORTS.find((a) => a.icao === 'YPAD')!
const YTNK_POS = AIRPORTS.find((a) => a.icao === 'YTNK')!

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
  // Skips the initial parked engines-off sample — used to chain a second hop
  // onto an already-open engine-leg (a running turnaround) rather than close
  // it at the seam between hops.
  omitParkedLeadIn?: boolean
}): SimSample[] {
  const { t0, from, to, fuelStartGal, fuelEndGal, cruiseSamples = 10, omitParkedLeadIn = false } = opts
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
      enginesOn: true,
      fuelGal: fuelStartGal,
      fuelCapacityGal: 200,
      title,
      atcModel,
      ...over,
    })
    t += 1000
  }

  // Parked, then taxi out.
  if (!omitParkedLeadIn) push({ enginesOn: false })
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
  push({ lat: to.lat, lon: to.lon, groundKts: 0, onGround: true, fuelGal: fuelEndGal, enginesOn: false })

  return samples
}

// Local one-sample builder, same shape as legSamples' push defaults at YBAS,
// overridable — for tests that don't need the whole taxi/climb/cruise fixture.
const mk = (over: Partial<SimSample> = {}): SimSample => ({
  t: 0,
  lat: YBAS.lat,
  lon: YBAS.lon,
  headingTrue: 0,
  groundKts: 0,
  altFt: 0,
  onGround: true,
  enginesOn: true,
  fuelGal: 100,
  fuelCapacityGal: 200,
  title: 'Black Square A36TC Bonanza Professional N3475M',
  atcModel: 'Bonanza',
  ...over,
})

const fold = (samples: SimSample[]) => samples.reduce(recordSample, initRecorderState('outback'))

describe('engine-driven leg boundaries (#20)', () => {
  it('opens a leg at engine start and closes it at engines-off on the ground', () => {
    const s = fold(legSamples({ t0: 0, from: YBAS, to: YTNK_POS, fuelStartGal: 100, fuelEndGal: 80 }))
    expect(s.legs).toHaveLength(1)
    expect(s.currentLeg).toBeNull()
    expect(s.legs[0].fuelUsedL).toBeGreaterThan(0)
  })

  it('keeps a running turnaround inside one leg (no close without engines-off)', () => {
    // Fly YBAS→YTNK, land, stop with engines RUNNING, take off again, land+shutdown at YBAS.
    const leg1 = legSamples({ t0: 0, from: YBAS, to: YTNK_POS, fuelStartGal: 100, fuelEndGal: 90 })
    const runningStop = leg1.slice(0, -1) // drop the final engines-off sample
    // omitParkedLeadIn skips the second hop's initial parked engines-off sample —
    // without it, that sample would close the leg and the fixture would
    // contradict the very behavior under test. NEVER "fix" a failure here by
    // weakening recordSample; the fixture models a continuous engines-on chain.
    const leg2 = legSamples({ t0: 10_000_000, from: YTNK_POS, to: YBAS, fuelStartGal: 90, fuelEndGal: 80, omitParkedLeadIn: true })
    const s = fold([...runningStop, ...leg2])
    expect(s.legs).toHaveLength(1) // single engine-leg spanning both hops
    expect(s.landings).toBe(2)
  })

  it("a running turnaround's flightMinutes sums only the airborne segments, not the parked interval between them (#22 review)", () => {
    const leg1 = legSamples({ t0: 0, from: YBAS, to: YTNK_POS, fuelStartGal: 100, fuelEndGal: 90 })
    const runningStop = leg1.slice(0, -1) // drop the final engines-off sample
    // A LONG stationary stop with engines running between the two hops — if
    // ground time leaked into flightMinutes (first-liftoff to last-touchdown),
    // this would inflate it by ~1000 minutes.
    const leg2 = legSamples({
      t0: leg1[leg1.length - 2].t + 60_000_000,
      from: YTNK_POS,
      to: YBAS,
      fuelStartGal: 90,
      fuelEndGal: 80,
      omitParkedLeadIn: true,
    })
    const s = fold([...runningStop, ...leg2])
    expect(s.legs).toHaveLength(1)
    // Each hop's airborne portion alone is well under an hour; the parked gap
    // between them is ~1000 minutes and must not be counted.
    expect(s.legs[0].flightMinutes).toBeLessThan(60)
  })

  it('closes the leg on shutdown even while still rolling', () => {
    const samples = legSamples({ t0: 0, from: YBAS, to: YTNK_POS, fuelStartGal: 100, fuelEndGal: 90 })
    const last = samples[samples.length - 1]
    // Replace the parked shutdown sample with a rolling shutdown.
    samples[samples.length - 1] = { ...last, groundKts: STATIONARY_KTS + 4, enginesOn: false }
    const s = fold(samples)
    expect(s.legs).toHaveLength(1)
  })

  it('a taxi-only excursion (never airborne) still closes as a zero-flight leg', () => {
    const s = fold([
      mk({ t: 0, enginesOn: false, groundKts: 0 }),
      mk({ t: 1000, enginesOn: true, groundKts: 8 }),
      mk({ t: 2000, enginesOn: true, groundKts: 0 }),
      mk({ t: 3000, enginesOn: false, groundKts: 0 }),
    ])
    expect(s.legs).toHaveLength(1)
    expect(s.legs[0].flightMinutes).toBe(0)
  })
})

describe('position/time discontinuity guard (#22 review)', () => {
  it('a teleport back to the ground mid-flight is not counted as a touchdown', () => {
    const samples = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 90 })
    const trimmed = samples.slice(0, 8) // still airborne, well before touchdown
    const last = trimmed[trimmed.length - 1]
    // A slew/reset to the antipodal-ish (0,0) one second later — thousands of
    // nm away, which no real aircraft covers in a second regardless of how
    // tightly these synthetic fixtures otherwise compress flight time.
    const teleport: SimSample = { ...last, t: last.t + 1000, lat: 0, lon: 0, onGround: true, groundKts: 0 }
    const s = fold([...trimmed, teleport])
    expect(s.landings).toBe(0)
    expect(s.currentLeg).not.toBeNull() // the leg stays open, not garbage-closed
  })

  it("excludes an implausible mid-leg jump from the closed leg's distance", () => {
    const samples = legSamples({ t0: 0, from: YBAS, to: YTNK_POS, fuelStartGal: 100, fuelEndGal: 90 })
    const idx = 10 // mid-cruise, airborne on both sides
    const before = samples.slice(0, idx)
    const after = samples.slice(idx)
    const jumpT = before[before.length - 1].t + 500
    const jump: SimSample = { ...samples[idx], t: jumpT, lat: 0, lon: 0 }
    // Keep every sample after the jump strictly later in time (and thus an
    // equally implausible jump back to the real route), rather than reusing
    // the original timestamps verbatim — those sit *before* jumpT, which
    // would make the return hop look like negative elapsed time instead of a
    // second discontinuity.
    const shiftedAfter = after.map((s, i) => ({ ...s, t: jumpT + 500 + i * 1000 }))
    const s = fold([...before, jump, ...shiftedAfter])
    expect(s.legs).toHaveLength(1)
    // Both the jump out to (0,0) and the jump back are excluded; only the
    // ordinary in-route distance either side of them is summed. Without the
    // guard this would run into the tens of thousands of nm via (0,0).
    expect(s.legs[0].distanceNm).toBeLessThan(1000)
    expect(s.legs[0].distanceNm).toBeGreaterThan(0)
  })
})

describe('external fuel accumulation (#20)', () => {
  it('accumulates a sustained sample-to-sample fuel increase beyond slop', () => {
    const s = fold([
      mk({ t: 0, enginesOn: true, fuelGal: 50 }),
      mk({ t: 1000, enginesOn: true, fuelGal: 49.8 }), // normal burn — ignored
      mk({ t: 2000, enginesOn: true, fuelGal: 80 }),   // +30.2 gal sim-menu refill
      mk({ t: 3000, enginesOn: true, fuelGal: 80 }),   // held — confirms it wasn't a transient
    ])
    expect(s.externalFuelGal).toBeCloseTo(30.2, 1)
  })

  it('ignores increases within the slop', () => {
    const s = fold([
      mk({ t: 0, enginesOn: true, fuelGal: 50 }),
      mk({ t: 1000, enginesOn: true, fuelGal: 50.3 }), // float noise
      mk({ t: 2000, enginesOn: true, fuelGal: 50.3 }),
    ])
    expect(s.externalFuelGal).toBe(0)
  })

  it('does not bill a transient spike (slosh/unporting) that reverts on the next sample (#22 review)', () => {
    const s = fold([
      mk({ t: 0, enginesOn: true, fuelGal: 50 }),
      mk({ t: 1000, enginesOn: true, fuelGal: 65 }), // spike — maneuvering slosh
      mk({ t: 2000, enginesOn: true, fuelGal: 49.5 }), // reverts — was noise, not a refill
    ])
    expect(s.externalFuelGal).toBe(0)
  })

  it('still bills a genuine refill even if the gauge overshoots briefly before settling', () => {
    const s = fold([
      mk({ t: 0, enginesOn: true, fuelGal: 50 }),
      mk({ t: 1000, enginesOn: true, fuelGal: 82 }), // rising
      mk({ t: 2000, enginesOn: true, fuelGal: 90 }), // still rising — held
      mk({ t: 3000, enginesOn: true, fuelGal: 90 }), // settled higher — confirmed
    ])
    expect(s.externalFuelGal).toBeCloseTo(40, 1)
  })
})

// D15: closeFlight/deriveFlightFromSamples/DerivedFlight are gone — the
// always-on session (#20) commits per-leg via recordSample + commitLeg
// directly, with no offline "finalise the whole recording" step. These tests
// now fold samples through recordSample and assert on RecorderState. The
// multi-leg/intermediates aggregation that used to be checked here lives in
// store.ts's finalizeChainInto and is covered by Task 6's chain test
// ('commitLeg appends to the open chain; finalizeChain writes one FlightLog
// with summed earnings and missionIds' in store.test.ts).
describe('recordSample — single leg', () => {
  const samples = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 80 })
  const s = fold(samples)

  it('detects exactly one leg and one landing', () => {
    expect(s.legs).toHaveLength(1)
    expect(s.landings).toBe(1)
  })

  it('matches start and end airports', () => {
    expect(s.legs[0].fromIcao).toBe('YBAS')
    expect(s.legs[0].toIcao).toBe('YBHI')
  })

  it('converts the fuel burned to litres', () => {
    // 100 -> 80 gal burned = 20 gal * 3.785411784 L/gal
    expect(s.legs[0].fuelUsedL).toBeCloseTo(20 * 3.785411784, 1)
  })

  it('records the sim aircraft strings for the forgiveness audit trail', () => {
    expect(s.lastSample?.atcModel).toBe('Bonanza')
    expect(s.lastSample?.title).toContain('A36TC')
  })

  it('sums a plausible great-circle distance', () => {
    // YBAS -> YBHI is ~635 nm great-circle; the synthetic straight-line track
    // should land in that ballpark.
    expect(s.legs[0].distanceNm).toBeGreaterThan(550)
    expect(s.legs[0].distanceNm).toBeLessThan(750)
  })
})

describe('recordSample — multi-leg trip', () => {
  const leg1 = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 80 })
  const leg1EndT = leg1[leg1.length - 1].t
  // A refuel while parked between legs: fuel goes UP. This must not be counted
  // as negative burn for either leg.
  const refuel: SimSample = { ...leg1[leg1.length - 1], t: leg1EndT + 60000, fuelGal: 100 }
  const leg2 = legSamples({ t0: leg1EndT + 120000, from: YBHI, to: YPAD, fuelStartGal: 100, fuelEndGal: 85 })
  const s = fold([...leg1, refuel, ...leg2])

  it('detects two legs and two landings', () => {
    expect(s.legs).toHaveLength(2)
    expect(s.landings).toBe(2)
  })

  it('routes each leg fromIcao -> toIcao', () => {
    expect(s.legs[0].fromIcao).toBe('YBAS')
    expect(s.legs[0].toIcao).toBe('YBHI')
    expect(s.legs[1].fromIcao).toBe('YBHI')
    expect(s.legs[1].toIcao).toBe('YPAD')
  })

  it('does not count the between-legs refuel as burned fuel', () => {
    // leg1 burns 20 gal, leg2 burns 15 gal = 35 gal total; the 80->100 refuel
    // bump must not subtract from that.
    const expectedGal = 20 + 15
    const totalFuelUsedL = s.legs.reduce((sum, l) => sum + l.fuelUsedL, 0)
    expect(totalFuelUsedL).toBeCloseTo(expectedGal * 3.785411784, 0)
  })
})

describe('recordSample — edge cases', () => {
  it('records no completed leg when the aircraft never leaves the ground', () => {
    const samples: SimSample[] = [
      { t: 0, lat: YBAS.lat, lon: YBAS.lon, headingTrue: 0, groundKts: 0, altFt: 0, onGround: true, enginesOn: true, fuelGal: 100, fuelCapacityGal: 200, title: 't', atcModel: 'm' },
      { t: 1000, lat: YBAS.lat, lon: YBAS.lon, headingTrue: 0, groundKts: 10, altFt: 0, onGround: true, enginesOn: true, fuelGal: 99, fuelCapacityGal: 200, title: 't', atcModel: 'm' },
      { t: 2000, lat: YBAS.lat, lon: YBAS.lon, headingTrue: 0, groundKts: 0, altFt: 0, onGround: true, enginesOn: true, fuelGal: 99, fuelCapacityGal: 200, title: 't', atcModel: 'm' },
    ]
    const s = fold(samples)
    expect(s.legs).toHaveLength(0)
    expect(s.landings).toBe(0)
  })

  it('does not close a leg that is still airborne (no engines-off sample yet)', () => {
    const samples = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 80 })
    // Cut the stream mid-cruise, well before touchdown.
    const trimmed = samples.slice(0, 8)
    const s = fold(trimmed)
    expect(s.legs).toHaveLength(0)
    expect(s.currentLeg).not.toBeNull()
  })

  it('treats a bounce (airborne again before stopping) as the same leg, not a new one', () => {
    const samples = legSamples({ t0: 0, from: YBAS, to: YBHI, fuelStartGal: 100, fuelEndGal: 90 })
    // Insert a bounce right after touchdown: briefly airborne again before the
    // aircraft finally rolls to a stop.
    const touchdownIdx = samples.findIndex((s) => s.onGround && s.lat === YBHI.lat)
    const bounce: SimSample = { ...samples[touchdownIdx], t: samples[touchdownIdx].t + 500, onGround: false, altFt: 30 }
    const withBounce = [...samples.slice(0, touchdownIdx + 1), bounce, ...samples.slice(touchdownIdx + 1)]
    const s = fold(withBounce)
    expect(s.legs).toHaveLength(1)
    expect(s.landings).toBe(2) // the initial touchdown and the second one both count
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

describe('simCapacityL', () => {
  const bonanza = getSpec('bonanza')
  const caravan = getSpec('c208')

  const sample = (over: Partial<SimSample> = {}): SimSample => ({
    t: 0,
    lat: 0,
    lon: 0,
    headingTrue: 0,
    groundKts: 0,
    altFt: 0,
    onGround: true,
    enginesOn: false,
    fuelGal: 0,
    fuelCapacityGal: 50,
    title: 'Black Square A36TC Bonanza Professional N3475M',
    atcModel: 'Bonanza',
    ...over,
  })

  it('derives litres from the matched sim sample capacity', () => {
    expect(simCapacityL(bonanza, sample({ fuelCapacityGal: 50 }))).toBeCloseTo(50 * 3.785411784, 5)
  })

  it('returns undefined when there is no sample', () => {
    expect(simCapacityL(bonanza, null)).toBeUndefined()
  })

  it('returns undefined when the spec has no simMatch keywords', () => {
    expect(simCapacityL({ ...bonanza, simMatch: undefined }, sample())).toBeUndefined()
  })

  it('returns undefined when the sample does not match the spec', () => {
    expect(simCapacityL(caravan, sample({ atcModel: 'Bonanza', title: 'A36TC Bonanza' }))).toBeUndefined()
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

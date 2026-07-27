import { describe, it, expect } from 'vitest'
import { initSessionState, reduceSession, resolveChoice, type SessionCtx, type SessionEffect } from './simSession'
import { AIRPORTS } from '../data/airports'
import type { OwnedAircraft } from './types'
import type { SimSample } from '../sim/types'

const YBAS = AIRPORTS.find((a) => a.icao === 'YBAS')!
const YTNK = AIRPORTS.find((a) => a.icao === 'YTNK')!

const sample = (over: Partial<SimSample> = {}): SimSample => ({
  t: 0, lat: YBAS.lat, lon: YBAS.lon, headingTrue: 0, groundKts: 0, altFt: 0,
  onGround: true, fuelGal: 40, fuelCapacityGal: 50, enginesOn: false,
  title: 'Black Square A36TC Bonanza Professional N3475M', atcModel: 'Bonanza',
  ...over,
})

const bonanza = (over: Partial<OwnedAircraft> = {}): OwnedAircraft => ({
  id: 'ac1', specId: 'bonanza', registration: 'VH-AAA', hoursFlown: 0,
  condition: 100, locationIcao: 'YBAS', fuelL: 40 * 3.785411784, ...over,
})

const ctx = (over: Partial<SessionCtx> = {}): SessionCtx => ({
  fleet: [bonanza()], regionId: 'outback', pilotLocationIcao: 'YBAS', ...over,
})

describe('session matching (D1/D2)', () => {
  it('matches the single type+position candidate and enters GROUND_SECURE', () => {
    const { state } = reduceSession(initSessionState(), sample(), ctx())
    expect(state.phase).toBe('GROUND_SECURE')
    expect(state.aircraftId).toBe('ac1')
  })

  it('enters SIM_ACTIVE and seeds externalFuelL when engines already run richer than the game tank', () => {
    const c = ctx({ fleet: [bonanza({ fuelL: 20 })] }) // game: 20 L, sim: 40 gal ≈ 151 L
    const { state } = reduceSession(initSessionState(), sample({ enginesOn: true }), c)
    expect(state.phase).toBe('SIM_ACTIVE')
    expect(state.seedExternalL).toBeGreaterThan(100)
  })

  it('warns wrong-position when the sim is away from the pilot', () => {
    const { state, effects } = reduceSession(initSessionState(), sample({ lat: YTNK.lat, lon: YTNK.lon }), ctx())
    expect(state.phase).toBe('UNMATCHED')
    expect(effects.some((e) => e.kind === 'WARN' && e.code === 'wrong-position')).toBe(true)
  })

  it('warns wrong-position at an uncatalogued location', () => {
    const { effects } = reduceSession(initSessionState(), sample({ lat: 0, lon: 0 }), ctx())
    expect(effects.some((e) => e.kind === 'WARN' && e.code === 'wrong-position')).toBe(true)
  })

  it('matches an off-field pilot position within 5 nm', () => {
    const off = { lat: YBAS.lat + 0.3, lon: YBAS.lon + 0.3 } // well away from any airport
    const c = ctx({ fleet: [bonanza({ offField: off })], pilotOffField: off })
    const { state } = reduceSession(initSessionState(), sample({ lat: off.lat, lon: off.lon }), c)
    expect(state.aircraftId).toBe('ac1')
  })

  it('asks when several same-type aircraft share the position, and resolveChoice settles it', () => {
    const c = ctx({ fleet: [bonanza(), bonanza({ id: 'ac2', registration: 'VH-BBB' })] })
    const r1 = reduceSession(initSessionState(), sample(), c)
    const need = r1.effects.find((e) => e.kind === 'NEED_CHOICE')
    expect(need && need.candidateIds).toEqual(['ac1', 'ac2'])
    const chosen = resolveChoice(r1.state, 'ac2')
    const r2 = reduceSession(chosen, sample({ t: 1000 }), c)
    expect(r2.state.aircraftId).toBe('ac2')
    expect(r2.state.phase).toBe('GROUND_SECURE')
  })

  it('warns no-matching-aircraft when the type differs', () => {
    const { effects } = reduceSession(initSessionState(), sample({ atcModel: 'Kodiak', title: 'Kodiak 100' }), ctx())
    expect(effects.some((e) => e.kind === 'WARN' && e.code === 'no-matching-aircraft')).toBe(true)
  })

  it('repeats no warning twice for the same condition', () => {
    const r1 = reduceSession(initSessionState(), sample({ lat: 0, lon: 0 }), ctx())
    const r2 = reduceSession(r1.state, sample({ lat: 0, lon: 0, t: 1000 }), ctx())
    expect(r2.effects.filter((e) => e.kind === 'WARN')).toHaveLength(0)
  })
})

const lerp = (a: number, b: number, f: number) => a + (b - a) * f

// Build a synthetic engine-on flight from `from` to `dest`: taxi → climb →
// cruise (interpolated lat/lon) → land → stop. Modelled on flightlog.test.ts's
// legSamples, using this file's `sample()` field defaults. Starts with a
// parked engines-off lead-in sample (a no-op while GROUND_SECURE, harmless)
// unless `alreadyRunning: true` — needed when a helper's own output is the
// very first sample ever fed to the reducer (no GROUND_SECURE sample precedes
// it), so the reducer must attach straight into SIM_ACTIVE. Ends with an
// engines-off shutdown sample unless `keepRunning: true` leaves it parked
// with the engine still turning over.
function legSamplesBase(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  opts: {
    fuelStartGal: number
    fuelEndGal: number
    keepRunning?: boolean
    alreadyRunning?: boolean
    cruiseSamples?: number
  }
): SimSample[] {
  const { fuelStartGal, fuelEndGal, keepRunning = false, alreadyRunning = false, cruiseSamples = 10 } = opts
  const samples: SimSample[] = []
  let t = 0
  const push = (over: Partial<SimSample>) => {
    samples.push(
      sample({
        t,
        lat: from.lat,
        lon: from.lon,
        groundKts: 0,
        altFt: 0,
        onGround: true,
        enginesOn: true,
        fuelGal: fuelStartGal,
        ...over,
      })
    )
    t += 1000
  }

  if (!alreadyRunning) push({ enginesOn: false })
  // Taxi out.
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
  // Taxi in and stop.
  push({ lat: to.lat, lon: to.lon, groundKts: 6, onGround: true, fuelGal: fuelEndGal })
  push({ lat: to.lat, lon: to.lon, groundKts: 0, onGround: true, fuelGal: fuelEndGal })
  if (!keepRunning) push({ lat: to.lat, lon: to.lon, groundKts: 0, onGround: true, fuelGal: fuelEndGal, enginesOn: false })

  return samples
}

// From the pilot's base (YBAS) out to `dest`.
const legSamplesTo = (
  dest: { lat: number; lon: number },
  opts: { fuelStartGal: number; fuelEndGal: number; keepRunning?: boolean; alreadyRunning?: boolean }
) => legSamplesBase(YBAS, dest, opts)

// From YTNK back to `dest` — chains onto a prior legSamplesTo(YTNK, ...) hop.
const legSamplesBack = (
  dest: { lat: number; lon: number },
  opts: { fuelStartGal: number; fuelEndGal: number; keepRunning?: boolean; alreadyRunning?: boolean }
) => legSamplesBase(YTNK, dest, opts)

const run = (samples: SimSample[], c: SessionCtx) => {
  let state = initSessionState()
  const all: SessionEffect[] = []
  for (const s of samples) {
    const r = reduceSession(state, s, c)
    state = r.state
    all.push(...r.effects)
  }
  return { state, effects: all }
}

describe('fuel authority phases (D3/D7)', () => {
  it('GROUND_SECURE: one SYNC_TO_SIM per divergence episode, re-armed after convergence', () => {
    const c = ctx() // game tank = sim fuel initially
    const gameL = 40 * 3.785411784
    const { effects } = run(
      [
        sample({ t: 0 }), // match, in tolerance — no sync
        sample({ t: 1000, fuelGal: 48 }), // player edits sim menu: diverged
        sample({ t: 2000, fuelGal: 48 }), // still diverged — no second write
        sample({ t: 3000, fuelGal: 40 }), // converged (write landed)
        sample({ t: 4000, fuelGal: 48 }), // new episode
      ],
      c
    )
    const syncs = effects.filter((e) => e.kind === 'SYNC_TO_SIM')
    expect(syncs).toHaveLength(2)
    expect((syncs[0] as any).fuelL).toBeCloseTo(gameL, 1)
  })

  it('off-block seeds outstanding positive divergence as external fuel — a failed SYNC_TO_SIM write must not leak fuel in for free (#22 review)', () => {
    const c = ctx({ fleet: [bonanza({ fuelL: 100 })] }) // game tank: 100 L
    // Match on the ground with the sim already reading well above the game's
    // tank — models a SYNC_TO_SIM write that a modern [FUEL_SYSTEM] aircraft
    // silently ignored, so the divergence was never resolved.
    const r1 = reduceSession(initSessionState(), sample({ t: 0, fuelGal: 100 }), c) // ≈378.5 L in the sim
    expect(r1.state.phase).toBe('GROUND_SECURE')
    // Off-block with the divergence still present.
    const r2 = reduceSession(r1.state, sample({ t: 1000, fuelGal: 100, enginesOn: true }), c)
    expect(r2.effects.some((e) => e.kind === 'OFF_BLOCK')).toBe(true)
    expect(r2.state.seedExternalL).toBeGreaterThan(200) // ≈ 378.5 L − 100 L − tolerance
  })

  it('off-block seeds nothing when the sim and game tank already agree', () => {
    const c = ctx() // game tank = sim fuel initially (40 gal)
    const r1 = reduceSession(initSessionState(), sample({ t: 0 }), c)
    expect(r1.state.phase).toBe('GROUND_SECURE')
    const r2 = reduceSession(r1.state, sample({ t: 1000, enginesOn: true }), c)
    expect(r2.state.seedExternalL).toBe(0)
  })

  it('off-block: engine start on ground emits OFF_BLOCK with the field and flips to SIM_ACTIVE', () => {
    const { state, effects } = run([sample({ t: 0 }), sample({ t: 1000, enginesOn: true })], ctx())
    expect(state.phase).toBe('SIM_ACTIVE')
    expect(effects.find((e) => e.kind === 'OFF_BLOCK')).toEqual({ kind: 'OFF_BLOCK', icao: 'YBAS' })
  })

  it('on-block: shutdown after a flight emits ON_BLOCK with sim fuel, position and external fuel, and returns to GROUND_SECURE', () => {
    const flight = legSamplesTo(YTNK, { fuelStartGal: 40, fuelEndGal: 30 })
    const { state, effects } = run([sample({ t: 0 }), ...flight], ctx())
    expect(state.phase).toBe('GROUND_SECURE')
    const ob = effects.find((e) => e.kind === 'ON_BLOCK') as any
    expect(ob.pos).toEqual({ icao: 'YTNK' })
    expect(ob.simFuelL).toBeCloseTo(30 * 3.785411784, 1)
    expect(ob.leg.fuelUsedL).toBeGreaterThan(0)
    expect(ob.landings).toBe(1)
  })

  it('STOP_AT fires once at a full stop after landing, engines still running, and re-arms when airborne', () => {
    // land at YTNK, stop with engines on, take off, land+stop again
    const hop1 = legSamplesTo(YTNK, { fuelStartGal: 40, fuelEndGal: 35, keepRunning: true })
    const hop2 = legSamplesBack(YBAS, { fuelStartGal: 35, fuelEndGal: 30, keepRunning: true })
    const { effects } = run([sample({ t: 0 }), ...hop1, ...hop2], ctx())
    const stops = effects.filter((e) => e.kind === 'STOP_AT') as any[]
    expect(stops.map((s) => s.icao)).toEqual(['YTNK', 'YBAS'])
  })

  it('ON_BLOCK at an uncatalogued field carries raw coordinates', () => {
    const off = { lat: YBAS.lat + 0.4, lon: YBAS.lon + 0.4 }
    const flight = legSamplesTo(off, { fuelStartGal: 40, fuelEndGal: 35 })
    const { effects } = run([sample({ t: 0 }), ...flight], ctx())
    const ob = effects.find((e) => e.kind === 'ON_BLOCK') as any
    expect(ob.pos).toEqual({ lat: off.lat, lon: off.lon })
  })

  it('bills seeded pre-connect fuel through ON_BLOCK externalFuelL', () => {
    const c = ctx({ fleet: [bonanza({ fuelL: 20 })] })
    const flight = legSamplesTo(YTNK, { fuelStartGal: 40, fuelEndGal: 30, alreadyRunning: true })
    const { effects } = run(flight, c) // first sample engines already on → SIM_ACTIVE attach
    const ob = effects.find((e) => e.kind === 'ON_BLOCK') as any
    expect(ob.externalFuelL).toBeGreaterThan(100) // ≈ 40 gal − 20 L − tol
  })

  it('drops the match and warns when the sim aircraft is swapped mid-session (§8)', () => {
    const r1 = reduceSession(initSessionState(), sample(), ctx()) // matched, GROUND_SECURE
    const swapped = sample({ t: 1000, atcModel: 'Kodiak', title: 'Kodiak 100' })
    const r2 = reduceSession(r1.state, swapped, ctx())
    expect(r2.state.phase).toBe('UNMATCHED')
    expect(r2.state.aircraftId).toBeNull()
    expect(r2.effects.some((e) => e.kind === 'WARN' && e.code === 'aircraft-swapped')).toBe(true)
  })
})

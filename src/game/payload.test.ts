import { describe, it, expect } from 'vitest'
import { missionPayload, PAX_KG, loadedKg, payoutRatio, planLoad } from './payload'
import type { Mission } from './types'
import type { SimSample } from '../sim/types'

const mission = (over: Partial<Mission> = {}): Mission => ({
  id: 'm1',
  type: 'MEDEVAC',
  title: 'Test run',
  description: '',
  fromIcao: 'YBAS',
  toIcao: 'YTNK',
  distanceNm: 300,
  seatsRequired: 1,
  urgency: 'ROUTINE',
  reward: 5000,
  penalty: 1000,
  postedDay: 1,
  expiresDay: 10,
  reputationReward: 2,
  cargoKg: 40,
  ...over,
})

const sample = (over: Partial<SimSample> = {}): SimSample => ({
  t: 0, lat: -23.8, lon: 133.9, headingTrue: 0, groundKts: 0, altFt: 0,
  onGround: true, fuelGal: 40, fuelCapacityGal: 50, enginesOn: false,
  title: 'Test aircraft', atcModel: 'Test',
  totalKg: 1250, emptyKg: 900, fuelKg: 165, pilotStationKg: 85,
  ...over,
})

describe('missionPayload', () => {
  it('derives PAX weight from the seat requirement and adds the stated freight', () => {
    const p = missionPayload(mission({ seatsRequired: 2, cargoKg: 40 }))
    expect(p.paxKg).toBe(2 * PAX_KG)
    expect(p.cargoKg).toBe(40)
    expect(p.totalKg).toBe(210)
  })

  it('reads a freightless mission as PAX only', () => {
    expect(missionPayload(mission({ seatsRequired: 4, cargoKg: 0 })).totalKg).toBe(4 * PAX_KG)
  })

  it('reads a freightless, seatless mission as no requirement at all', () => {
    expect(missionPayload(mission({ seatsRequired: 0, cargoKg: 0 })).totalKg).toBe(0)
  })

  // Hydration is potentially hostile (hand-edited / corrupt saves): a NaN here
  // would otherwise poison every comparison downstream.
  it('reads a corrupt freight figure as none rather than NaN', () => {
    expect(missionPayload(mission({ cargoKg: Number.NaN })).totalKg).toBe(PAX_KG)
    expect(missionPayload(mission({ cargoKg: -50 })).totalKg).toBe(PAX_KG)
  })
})

describe('loadedKg', () => {
  // The issue's own example: 185 kg of payload, 85 of it the pilot.
  it('reports payload minus the pilot station', () => {
    expect(loadedKg(sample())).toBe(100)
  })

  it('counts the whole payload when the pilot seat is empty', () => {
    expect(loadedKg(sample({ pilotStationKg: 0 }))).toBe(185)
  })

  it('never reports a negative load', () => {
    expect(loadedKg(sample({ pilotStationKg: 500 }))).toBe(0)
  })

  // #28's lesson applied to weight: a sim mid-load reports nonsense, and
  // nonsense must read as UNKNOWN — never as an empty aeroplane, which would
  // silently dock the player's reward.
  it('reads an unloading simulator as unknown, not as empty', () => {
    expect(loadedKg(sample({ totalKg: 0, emptyKg: 0, fuelKg: 0, pilotStationKg: 0 }))).toBeNull()
    expect(loadedKg(sample({ emptyKg: Number.NaN }))).toBeNull()
    expect(loadedKg(sample({ totalKg: 800, emptyKg: 900 }))).toBeNull() // lighter than empty
    expect(loadedKg(sample({ fuelKg: -1 }))).toBeNull()
    expect(loadedKg(sample({ totalKg: 5_000_000 }))).toBeNull()
  })
})

describe('payoutRatio', () => {
  it('pays in full for a full load, and for an overloaded one', () => {
    expect(payoutRatio(100, 100)).toBe(1)
    expect(payoutRatio(100, 400)).toBe(1)
  })

  it('forgives a shortfall inside the tolerance', () => {
    expect(payoutRatio(85, 83.4)).toBe(1)
  })

  it('pays the loaded fraction when short', () => {
    expect(payoutRatio(125, 40)).toBeCloseTo(0.32, 5)
  })

  // Fails OPEN, exactly as settleStop already treats an unjudgeable
  // time-critical window: a plumbing gap is not the player's fault.
  it('pays in full when the load is unmeasurable or nothing is required', () => {
    expect(payoutRatio(125, null)).toBe(1)
    expect(payoutRatio(0, 0)).toBe(1)
  })
})

// Shared across the planLoad describes below: A and B always share a route
// (the mission() factory's default fromIcao/toIcao), so they are a stand-in
// for "two candidates competing for the same kilograms" wherever they appear.
const a = mission({ id: 'A', seatsRequired: 1, cargoKg: 0, expiresDay: 3, reward: 1000 }) // 85 kg
const b = mission({ id: 'B', seatsRequired: 1, cargoKg: 0, expiresDay: 4, reward: 9000 }) // 85 kg

describe('planLoad', () => {
  // The issue's worked example.
  it('arms only the nearest deadline when the load cannot carry both', () => {
    const plan = planLoad([b, a], 100)
    expect(plan.map((e) => [e.mission.id, e.arms])).toEqual([['A', true], ['B', false]])
  })

  it('arms both when the load carries the sum', () => {
    expect(planLoad([a, b], 170).every((e) => e.arms)).toBe(true)
  })

  it('arms missions to different destinations independently — the leg flown is unknown until on-block', () => {
    const toZ = mission({ id: 'Z', toIcao: 'YPAD', seatsRequired: 1, cargoKg: 0, expiresDay: 9 })
    const plan = planLoad([a, toZ], 100)
    expect(plan.every((e) => e.arms)).toBe(true)
  })

  // R5 (#33 review): the old rule let the first entry in a group always arm
  // regardless of fit. That is now narrowed to a lone candidate only — a
  // two-mission group gets no free pass just because one of them is first in
  // priority order.
  it('refuses BOTH missions in a two-candidate group too short even for the top-priority one', () => {
    const plan = planLoad([a, b], 40)
    expect(plan.find((e) => e.mission.id === 'A')?.arms).toBe(false)
    expect(plan.find((e) => e.mission.id === 'B')?.arms).toBe(false)
  })

  it('arms everything when the load is unmeasurable', () => {
    expect(planLoad([a, b], null).every((e) => e.arms)).toBe(true)
  })

  it('breaks a deadline tie by time-critical first, then reward, then id', () => {
    const plain = mission({ id: 'P', expiresDay: 3, reward: 1000, seatsRequired: 1, cargoKg: 0 })
    const rich = mission({ id: 'R', expiresDay: 3, reward: 8000, seatsRequired: 1, cargoKg: 0 })
    const urgent = mission({ id: 'U', expiresDay: 3, reward: 1000, seatsRequired: 1, cargoKg: 0, windowMinutes: 40 })
    expect(planLoad([plain, rich, urgent], null).map((e) => e.mission.id)).toEqual(['U', 'R', 'P'])
  })

  it('reports the cumulative demand of a route so the UI can show what is missing', () => {
    const plan = planLoad([a, b], 100)
    expect(plan.find((e) => e.mission.id === 'B')?.cumulativeKg).toBe(170)
  })
})

// R3-R5 (#33 review): the anti-exploit central to the whole feature. Cargo
// already armed for this aircraft — on ANY route — is physically aboard and
// must shrink the budget a fresh arming pass judges against; the one
// exception (a mission entirely alone for the load) only fires against a
// genuinely empty slate.
describe('planLoad committedKg (#33 review)', () => {
  // Alone on its own route in every one of these cases — the group-size half
  // of R5 is never in question here; only the committedKg half is.
  const solo = mission({ id: 'S', seatsRequired: 1, cargoKg: 0, expiresDay: 5 }) // 85 kg

  it('omitting committedKg is equivalent to passing 0 — a caller with nothing armed yet', () => {
    const plan = planLoad([a, b], 100)
    expect(plan).toEqual(planLoad([a, b], 100, 0))
  })

  it('reduces the free budget by committedKg, refusing a mission a fresh load would have covered', () => {
    // 100 kg aboard, of which 50 is cargo this aircraft already has armed
    // elsewhere — only 50 kg is actually free, short of the 85 kg needed, and
    // committedKg > 0 means the lone-candidate exception does not apply.
    expect(planLoad([solo], 100, 50)[0].arms).toBe(false)
  })

  it('R5: a lone candidate arms even when short, PROVIDED nothing is committed yet', () => {
    expect(planLoad([solo], 40, 0)[0].arms).toBe(true) // 85 kg needed, 40 kg free, alone
  })

  it('R5 does NOT fire once anything is already committed, even for a lone candidate', () => {
    // Same shortfall as the case above, but 10 kg of the load is already
    // spoken for — the candidate is no longer competing against nothing.
    expect(planLoad([solo], 40, 10)[0].arms).toBe(false)
  })

  it('R5 does NOT fire for a candidate that has company in its own route group, even at committedKg 0', () => {
    // a and b share a route (see above) — two candidates, so neither gets the
    // lone-candidate exception regardless of committedKg.
    const plan = planLoad([a, b], 40, 0)
    expect(plan.every((e) => !e.arms)).toBe(true)
  })

  // R5 corner 4: "alone" is a per-route-group question. A candidate with
  // company on a DIFFERENT route must not count against a genuinely solo
  // candidate on its own route — "alone" computed over the whole candidate
  // list instead of per group would wrongly deny this mission the exception.
  it('R5 still fires for a lone candidate even when other routes have their own competing candidates', () => {
    const soloOtherRoute = mission({ id: 'S2', toIcao: 'YPAD', seatsRequired: 1, cargoKg: 0, expiresDay: 5 }) // 85 kg, alone on YBAS→YPAD
    const plan = planLoad([soloOtherRoute, a, b], 40, 0) // a and b share YBAS→YTNK, two candidates there
    expect(plan.find((e) => e.mission.id === 'S2')?.arms).toBe(true)
    expect(plan.filter((e) => e.mission.id === 'A' || e.mission.id === 'B').every((e) => !e.arms)).toBe(true)
  })

  // The owner's mission-4 variant, isolated to planLoad: two candidates on one
  // route, 100 kg aboard, 50 kg of it already committed to a mission armed on
  // ANOTHER route (so only 50 kg is actually free). The 75 kg job is top
  // priority (expires today) but does not fit; the 50 kg job behind it does.
  it("mirrors the owner's mission-4 case: the pricier top-priority job is refused, the one behind it arms", () => {
    const four = mission({ id: '4', seatsRequired: 0, cargoKg: 75, expiresDay: 1 }) // top priority
    const three = mission({ id: '3', seatsRequired: 0, cargoKg: 50, expiresDay: 5 })
    const plan = planLoad([four, three], 100, 50)
    expect(plan.find((e) => e.mission.id === '4')?.arms).toBe(false)
    expect(plan.find((e) => e.mission.id === '3')?.arms).toBe(true)
  })
})

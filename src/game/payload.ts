// Pure payload layer (#33 realistic cargo): what a mission demands be aboard,
// what the simulator says actually is, and how a short load is paid. Same
// contract as fields.ts and flightlog.ts — no React, no I/O, no store access.

import type { Mission } from './types'
import type { SimSample } from '../sim/types'

/** Weight booked for one passenger/patient seat, kg. Deliberately one flat
 *  figure: the game asks the player to load kilograms, not to model a manifest. */
export const PAX_KG = 85

/** A sim's weight report is not exact (rounding, unit conversion, per-station
 *  quantisation), so a shortfall this small is not a shortfall. */
export const PAYLOAD_TOLERANCE_KG = 2

/** Reputation cost of arriving with less than the mission asked for. */
export const UNDERLOAD_REP_PENALTY = 2

export interface MissionPayload {
  paxKg: number
  cargoKg: number
  totalKg: number
}

/**
 * What the mission demands be aboard, split for display. PAX weight is
 * DERIVED from `seatsRequired` and never stored: a stored copy could contradict
 * the seat count after a balance change, and the seat count is already the
 * authority on how many people are aboard.
 */
export function missionPayload(m: Mission): MissionPayload {
  const paxKg = Math.max(0, m.seatsRequired) * PAX_KG
  const cargoKg = Number.isFinite(m.cargoKg) ? Math.max(0, m.cargoKg) : 0
  return { paxKg, cargoKg, totalKg: paxKg + cargoKg }
}

/** Above this the sim is describing something that is not an aeroplane (the
 *  heaviest ever built is ~640 t) — treat it as a bad read. */
const MAX_PLAUSIBLE_TOTAL_KG = 1_000_000

/**
 * What is aboard beyond the pilot, kg — or `null` when the sim's weight report
 * cannot be trusted. Deliberately separate from `isPlausibleSample`
 * (flightlog.ts): a nonsense weight must not discard the whole positional
 * sample, it must only make the LOAD unknown.
 */
export function loadedKg(s: SimSample): number | null {
  const parts = [s.totalKg, s.emptyKg, s.fuelKg, s.pilotStationKg]
  if (!parts.every((n) => Number.isFinite(n))) return null
  if (s.emptyKg <= 0 || s.fuelKg < 0 || s.pilotStationKg < 0) return null
  if (s.totalKg < s.emptyKg || s.totalKg > MAX_PLAUSIBLE_TOTAL_KG) return null
  return Math.max(0, round2(s.totalKg - s.emptyKg - s.fuelKg - s.pilotStationKg))
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Share of the reward a load earns: 1 for a full (or overweight, or
 * unjudgeable) load, the loaded fraction when short. Fails OPEN — an
 * unmeasurable load or a mission that demands nothing pays in full, the same
 * benefit of the doubt settleStop already gives an unjudgeable delivery window.
 */
export function payoutRatio(requiredKg: number, loaded: number | null): number {
  if (requiredKg <= 0 || loaded == null) return 1
  if (requiredKg - loaded <= PAYLOAD_TOLERANCE_KG) return 1
  return Math.max(0, Math.min(1, loaded / requiredKg))
}

export interface LoadPlanEntry {
  mission: Mission
  requiredKg: number
  /** This mission plus everything ahead of it on the same route — what the load
   *  would have to reach for this entry to arm. */
  cumulativeKg: number
  arms: boolean
}

/** Nearest deadline first, then time-critical, then the larger reward, then id.
 *  Total and deterministic: the same board must always plan the same way, or
 *  the gate stops being testable and stops being explainable to the player. */
function byPriority(a: Mission, b: Mission): number {
  if (a.expiresDay !== b.expiresDay) return a.expiresDay - b.expiresDay
  const critical = (m: Mission) => (m.windowMinutes != null ? 0 : 1)
  if (critical(a) !== critical(b)) return critical(a) - critical(b)
  if (a.reward !== b.reward) return b.reward - a.reward
  return a.id.localeCompare(b.id)
}

/**
 * Which of these missions the measured load can carry.
 *
 * Missions are grouped by ROUTE — origin *and* destination. Same-route missions
 * compete for the same kilograms; two missions to *different* destinations are
 * judged independently, because until on-block there is no telling which one is
 * being flown.
 *
 * The budget every group is measured against is `loaded − committedKg`, not the
 * raw load (R3, #33 review). Cargo this aircraft already has armed — on ANY
 * route, not just this one — is physically in the cabin and cannot be unloaded
 * to make room for a fresh job, so it eats into what a new mission can claim
 * regardless of where that mission is headed. `armInto` sums `missionPayload`
 * over every mission the aircraft already has armed and passes the total as
 * `committedKg`; a caller with nothing armed yet (including `LoadPanel`'s
 * "pending" prediction) passes 0, which recovers the plain `loaded` budget.
 *
 * Within a route the nearest deadline goes first (R4) and arms only while the
 * accumulating demand stays inside budget (+ `PAYLOAD_TOLERANCE_KG`) — a later
 * mission never displaces an earlier one just because it would fit alone.
 *
 * ONE exception (R5): a mission that stands entirely alone for this load —
 * nothing else already committed for the aircraft, AND it is the only
 * candidate on its own route — arms even when short, so `payoutRatio` still
 * has something to price proportionally. Either half of that failing (some
 * other mission is already aboard, or this route has competition) means a
 * mission that does not fit is refused outright rather than arming at a
 * fraction of its reward. This replaces an earlier rule where the first
 * mission in a group always armed regardless of committedKg: that let a
 * player arm mission A with a tight load, then accept a same-route mission B
 * and re-arm at a later engine start, where B — now first in a candidate list
 * that no longer included the already-armed A — armed unconditionally and
 * both A and B billed in full off one load (review finding).
 *
 * A `null` load (no sim, or an untrustworthy weight report) arms everything —
 * the honour system's answer, and the same fail-open stance as payoutRatio.
 */
export function planLoad(
  missions: Mission[],
  loaded: number | null,
  committedKg = 0
): LoadPlanEntry[] {
  const routes = new Map<string, Mission[]>()
  for (const m of missions) {
    const key = `${m.fromIcao}→${m.toIcao}`
    const group = routes.get(key)
    if (group) group.push(m)
    else routes.set(key, [m])
  }

  const plan: LoadPlanEntry[] = []
  for (const group of routes.values()) {
    const sorted = [...group].sort(byPriority)
    // R5: the lone-candidate exception only fires against a genuinely empty
    // slate. An aircraft that already has cargo committed can't claim "nothing
    // else is competing" — that committed cargo IS the competition, it just
    // happens to be on a different route.
    const alone = committedKg === 0 && sorted.length === 1
    let armedKg = 0
    for (const mission of sorted) {
      const requiredKg = missionPayload(mission).totalKg
      const cumulativeKg = armedKg + requiredKg
      const arms =
        loaded == null || alone || cumulativeKg <= loaded - committedKg + PAYLOAD_TOLERANCE_KG
      if (arms) armedKg = cumulativeKg
      plan.push({ mission, requiredKg, cumulativeKg, arms })
    }
  }
  return plan
}

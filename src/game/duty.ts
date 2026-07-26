// Pure pilot duty-time limits (issue #10). No React, no store — the single
// source for the four rolling-window caps. Duty minutes are produced elsewhere
// (computeDutyMinutes in flightlog.ts); this module only aggregates and judges.
import type { DutyEntry } from './types'
import { computeDutyMinutes } from './flightlog'

type DutyLike = Pick<DutyEntry, 'day' | 'minutes'>

export interface DutyLimit {
  days: number
  minutes: number
}

// (a) 10h/day, (b) 60h/7d, (c) 110h/14d, (d) 190h/28d.
export const DUTY_LIMITS: DutyLimit[] = [
  { days: 1, minutes: 600 },
  { days: 7, minutes: 3600 },
  { days: 14, minutes: 6600 },
  { days: 28, minutes: 11400 },
]

export interface DutyRuleStatus {
  days: number
  used: number
  limit: number
  over: boolean
}

/** Sum of duty minutes in the window ending today: day ∈ [D-windowDays+1, D]. */
export function windowTotal(log: readonly DutyLike[], currentDay: number, windowDays: number): number {
  const earliest = currentDay - windowDays + 1
  let sum = 0
  for (const e of log) {
    if (e.day >= earliest && e.day <= currentDay) sum += e.minutes
  }
  return sum
}

/** One status per DUTY_LIMITS rule, for the dashboard. over := used > limit. */
export function dutyStatus(log: readonly DutyLike[], currentDay: number): DutyRuleStatus[] {
  return DUTY_LIMITS.map((rule) => {
    const used = windowTotal(log, currentDay, rule.days)
    return { days: rule.days, used, limit: rule.minutes, over: used > rule.minutes }
  })
}

/** True if any rule's window is over its limit today. */
export function isOverAnyLimit(log: readonly DutyLike[], currentDay: number): boolean {
  return dutyStatus(log, currentDay).some((s) => s.over)
}

/** Estimated duty for a mission leg, for the accept-time warning. Flight time =
 *  great-circle time + 10%; block = flight + 12 min; duty assumes one leg. */
export function estimateDutyMinutes(distanceNm: number, cruiseKts: number): number {
  const flightMinutes = (distanceNm / cruiseKts) * 60 * 1.1
  const blockMinutes = flightMinutes + 12
  return Math.round(computeDutyMinutes(blockMinutes, 1))
}

/** Would adding `addMinutes` of duty today push any rule over its limit? */
export function wouldBeOver(log: readonly DutyLike[], currentDay: number, addMinutes: number): boolean {
  return isOverAnyLimit([...log, { day: currentDay, minutes: addMinutes }], currentDay)
}

/** Reward factor for a flight of `flightDutyMinutes`:
 *  - 0 if already over any limit BEFORE the flight (flying again in violation)
 *  - 0.5 if under before but the flight crosses any limit
 *  - 1 otherwise. */
export function penaltyFactor(
  log: readonly DutyLike[],
  currentDay: number,
  flightDutyMinutes: number
): number {
  if (isOverAnyLimit(log, currentDay)) return 0
  if (wouldBeOver(log, currentDay, flightDutyMinutes)) return 0.5
  return 1
}

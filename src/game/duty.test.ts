import { describe, it, expect } from 'vitest'
import {
  DUTY_LIMITS,
  windowTotal,
  dutyStatus,
  isOverAnyLimit,
  estimateDutyMinutes,
  wouldBeOver,
  penaltyFactor,
} from './duty'
import type { DutyEntry } from './types'

const entry = (day: number, minutes: number): DutyEntry => ({
  id: `d${day}_${minutes}`,
  day,
  minutes,
  kind: 'MISSION',
})

describe('DUTY_LIMITS', () => {
  it('encodes the four rules in minutes', () => {
    expect(DUTY_LIMITS).toEqual([
      { days: 1, minutes: 600 },
      { days: 7, minutes: 3600 },
      { days: 14, minutes: 6600 },
      { days: 28, minutes: 11400 },
    ])
  })
})

describe('windowTotal', () => {
  const log = [entry(10, 100), entry(9, 50), entry(4, 200), entry(3, 999)]

  it('day window (1) counts only the current day', () => {
    expect(windowTotal(log, 10, 1)).toBe(100)
  })

  it('includes the entry exactly windowDays-1 days ago and excludes older', () => {
    // 7-day window ending day 10 => days 4..10 inclusive: 100 + 50 + 200 = 350
    expect(windowTotal(log, 10, 7)).toBe(350)
    // day 3 is one day too old for the 7-day window
    expect(windowTotal(log, 9, 7)).toBe(50 + 200 + 999) // days 3..9
  })

  it('is zero when nothing falls in the window', () => {
    expect(windowTotal(log, 40, 7)).toBe(0)
  })
})

describe('dutyStatus / isOverAnyLimit', () => {
  it('flags over only when used strictly exceeds the limit', () => {
    const atLimit = [entry(5, 600)]
    expect(dutyStatus(atLimit, 5)[0]).toEqual({ days: 1, used: 600, limit: 600, over: false })
    expect(isOverAnyLimit(atLimit, 5)).toBe(false)

    const overByOne = [entry(5, 601)]
    expect(dutyStatus(overByOne, 5)[0].over).toBe(true)
    expect(isOverAnyLimit(overByOne, 5)).toBe(true)
  })

  it('returns one status per rule in DUTY_LIMITS order', () => {
    expect(dutyStatus([], 1).map((s) => s.days)).toEqual([1, 7, 14, 28])
  })
})

describe('estimateDutyMinutes', () => {
  it('applies flight = dist/cruise x60 x1.1, block +12, duty +60 (one leg)', () => {
    // 300 nm at 150 kt => 2h flight = 120 min; x1.1 = 132; +12 block = 144;
    // computeDutyMinutes(144, 1) = 144 + 30*2 = 204.
    expect(estimateDutyMinutes(300, 150)).toBe(204)
  })
})

describe('wouldBeOver', () => {
  it('is true when adding the minutes pushes a rule over', () => {
    const log = [{ id: 'x', day: 5, minutes: 550, kind: 'MISSION' as const }]
    expect(wouldBeOver(log, 5, 40)).toBe(false) // 590 <= 600
    expect(wouldBeOver(log, 5, 60)).toBe(true) // 610 > 600
  })
})

describe('penaltyFactor', () => {
  it('is 1 for a legal flight', () => {
    expect(penaltyFactor([], 5, 300)).toBe(1)
  })

  it('is 0.5 when the flight crosses a limit from under', () => {
    const log = [{ id: 'x', day: 5, minutes: 400, kind: 'MISSION' as const }]
    expect(penaltyFactor(log, 5, 300)).toBe(0.5) // 400 -> 700 > 600
  })

  it('is 0 when already over any limit before the flight', () => {
    const log = [{ id: 'x', day: 5, minutes: 700, kind: 'MISSION' as const }]
    expect(penaltyFactor(log, 5, 30)).toBe(0)
  })

  it('lands exactly on the limit => legal (factor 1)', () => {
    const log = [{ id: 'x', day: 5, minutes: 300, kind: 'MISSION' as const }]
    expect(penaltyFactor(log, 5, 300)).toBe(1) // 600 == limit, not over
  })
})

import { describe, it, expect } from 'vitest'
import {
  computeReward,
  refuelCost,
  timeCriticalWindowMinutes,
  TIME_CRITICAL_MIN_WINDOW_MIN,
  TIME_CRITICAL_GROUND_ALLOWANCE_MIN,
} from './economy'

describe('timeCriticalWindowMinutes', () => {
  it('grows monotonically with distance', () => {
    expect(timeCriticalWindowMinutes(150)).toBeGreaterThan(timeCriticalWindowMinutes(60))
  })
  it('never returns below the minimum window', () => {
    expect(timeCriticalWindowMinutes(1)).toBe(TIME_CRITICAL_MIN_WINDOW_MIN)
  })
  it('matches the budget formula for a mid-range leg', () => {
    // 140 nm @ 140 kt = 60 min + 25 ground = 85
    expect(timeCriticalWindowMinutes(140)).toBe(60 + TIME_CRITICAL_GROUND_ALLOWANCE_MIN)
  })
})

describe('computeReward extraMult', () => {
  it('defaults to no change', () => {
    expect(computeReward(200, 2, 'EMERGENCY', 50)).toBe(computeReward(200, 2, 'EMERGENCY', 50, 1))
  })
  it('applies the premium', () => {
    const base = computeReward(200, 2, 'EMERGENCY', 50, 1)
    const premium = computeReward(200, 2, 'EMERGENCY', 50, 1.3)
    expect(premium).toBeGreaterThan(base)
    expect(premium / base).toBeCloseTo(1.3, 1)
  })
})

describe('refuelCost', () => {
  it('multiplies litres by price and the field multiplier, rounded', () => {
    expect(refuelCost(100, 2.9, 1.1)).toBe(319) // 100 * 2.9 * 1.1 = 319
  })
  it('is zero for zero litres', () => {
    expect(refuelCost(0, 2.9, 1.1)).toBe(0)
  })
})

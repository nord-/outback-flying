import { describe, it, expect } from 'vitest'
import { refuelCost } from './economy'

describe('refuelCost', () => {
  it('multiplies litres by price and the field multiplier, rounded', () => {
    expect(refuelCost(100, 2.9, 1.1)).toBe(319) // 100 * 2.9 * 1.1 = 319
  })
  it('is zero for zero litres', () => {
    expect(refuelCost(0, 2.9, 1.1)).toBe(0)
  })
})

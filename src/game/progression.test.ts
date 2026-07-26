import { describe, it, expect } from 'vitest'
import { rankFor, nextRank, rankProgress, xpForMission } from './progression'
import type { Mission } from './types'

const mission = (over: Partial<Mission> = {}): Mission => ({
  id: 'm1',
  type: 'MEDEVAC',
  title: 'Test',
  description: '',
  fromIcao: 'YBAS',
  toIcao: 'YBHI',
  distanceNm: 300,
  seatsRequired: 2,
  urgency: 'ROUTINE',
  reward: 5000,
  penalty: 1000,
  postedDay: 1,
  expiresDay: 5,
  reputationReward: 2,
  ...over,
})

describe('rankFor', () => {
  it('starts at Cadet with no experience', () => {
    expect(rankFor(0).title).toBe('Cadet')
  })

  it('returns the highest rank whose threshold is met', () => {
    expect(rankFor(499).title).toBe('Cadet')
    expect(rankFor(500).title).toBe('Junior Pilot')
    expect(rankFor(20000).title).toBe('Director of Flying')
    expect(rankFor(999999).title).toBe('Director of Flying')
  })
})

describe('nextRank / rankProgress', () => {
  it('reports the next rank and remaining xp', () => {
    expect(nextRank(0)?.title).toBe('Junior Pilot')
    const p = rankProgress(250)
    expect(p.next?.title).toBe('Junior Pilot')
    expect(p.toNext).toBe(250)
    expect(p.pct).toBeCloseTo(0.5, 5)
  })

  it('caps progress at the top rank', () => {
    const p = rankProgress(25000)
    expect(p.next).toBeNull()
    expect(p.pct).toBe(1)
    expect(p.toNext).toBe(0)
  })
})

describe('xpForMission', () => {
  it('rewards more xp for higher urgency', () => {
    const routine = xpForMission(mission({ urgency: 'ROUTINE' }))
    const emergency = xpForMission(mission({ urgency: 'EMERGENCY' }))
    expect(emergency).toBeGreaterThan(routine)
  })

  it('scales with distance and seats', () => {
    // distance 300 / 10 = 30, +5 routine, +2*3 seats = 41
    expect(xpForMission(mission())).toBe(41)
  })
})

import { describe, it, expect } from 'vitest'
import { deriveMapView } from './mapView'
import { AIRPORTS } from '../data/airports'
import type { GameState, Mission } from './types'

const mission = (over: Partial<Mission>): Mission => ({
  id: 'm1',
  type: 'MEDEVAC',
  title: 'Test run',
  description: '',
  fromIcao: 'YBHI',
  toIcao: 'YBMA',
  distanceNm: 300,
  seatsRequired: 1,
  urgency: 'ROUTINE',
  reward: 5000,
  penalty: 1000,
  postedDay: 1,
  expiresDay: 5,
  reputationReward: 2,
  ...over,
})

function game(over: Partial<GameState> = {}): GameState {
  return {
    version: 2,
    companyName: 'Test Air',
    homeBaseIcao: 'YBAS',
    pilotLocationIcao: 'YBHI',
    balance: 1000,
    reputation: 50,
    day: 1,
    fuel: { AVGAS: 2.9, JETA: 2.4 },
    fleet: [{ id: 'ac1', specId: 'c172', registration: 'VH-ABC', hoursFlown: 0, condition: 100, locationIcao: 'YBAS' }],
    availableMissions: [],
    acceptedMissions: [],
    ledger: [],
    stats: { missionsCompleted: 0, missionsFailed: 0, hoursFlown: 0, totalEarned: 0 },
    ...over,
  }
}

describe('deriveMapView', () => {
  it('maps home base and pilot to their airports', () => {
    const v = deriveMapView(game())
    expect(v.homeBase.icao).toBe('YBAS')
    expect(v.homeBase.name).toBe('Alice Springs')
    expect(v.pilot.icao).toBe('YBHI')
  })

  it('includes every airport as a background point', () => {
    expect(deriveMapView(game()).airports).toHaveLength(AIRPORTS.length)
  })

  it('maps each owned aircraft to a point', () => {
    const v = deriveMapView(game())
    expect(v.aircraft).toEqual([
      { registration: 'VH-ABC', point: expect.objectContaining({ icao: 'YBAS' }) },
    ])
  })

  it('available missions carry title/urgency and no pilot leg', () => {
    const v = deriveMapView(game({ availableMissions: [mission({ id: 'a1', urgency: 'EMERGENCY' })] }))
    expect(v.availableMissions[0]).toMatchObject({ id: 'a1', title: 'Test run', urgency: 'EMERGENCY' })
    expect(v.availableMissions[0].from.icao).toBe('YBHI')
    expect(v.availableMissions[0].to.icao).toBe('YBMA')
    expect(v.availableMissions[0].pilotLeg).toBeUndefined()
  })

  it('accepted missions add a pilot leg from the pilot to the mission start', () => {
    const v = deriveMapView(game({ acceptedMissions: [mission({ id: 'b1', fromIcao: 'YBMA', toIcao: 'YCCY' })] }))
    expect(v.acceptedMissions[0].pilotLeg).toEqual({
      from: expect.objectContaining({ icao: 'YBHI' }), // pilotLocationIcao
      to: expect.objectContaining({ icao: 'YBMA' }), // mission.fromIcao
    })
  })
})

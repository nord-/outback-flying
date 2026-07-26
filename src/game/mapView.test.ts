import { describe, it, expect } from 'vitest'
import { deriveMapView, missionsAtAirport } from './mapView'
import { airportsInRegion } from '../data/airports'
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
    regionId: 'outback',
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

  it('includes every in-region airport as a background point', () => {
    expect(deriveMapView(game()).airports).toHaveLength(airportsInRegion('outback').length)
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

describe('missionsAtAirport', () => {
  it('returns available missions departing from the airport with role "from"', () => {
    const r = missionsAtAirport(
      game({ availableMissions: [mission({ id: 'a1', fromIcao: 'YBHI', toIcao: 'YBMA' })] }),
      'YBHI'
    )
    expect(r).toEqual([
      { id: 'a1', title: 'Test run', fromIcao: 'YBHI', toIcao: 'YBMA', reward: 5000, role: 'from', status: 'available' },
    ])
  })

  it('returns missions arriving at the airport with role "to"', () => {
    const r = missionsAtAirport(
      game({ availableMissions: [mission({ id: 'a1', fromIcao: 'YBHI', toIcao: 'YBMA' })] }),
      'YBMA'
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id: 'a1', role: 'to', status: 'available' })
  })

  it('includes both available and accepted missions touching the airport, available first', () => {
    const r = missionsAtAirport(
      game({
        availableMissions: [mission({ id: 'a1', fromIcao: 'YBHI', toIcao: 'YBMA' })],
        acceptedMissions: [mission({ id: 'b1', fromIcao: 'YCCY', toIcao: 'YBHI' })],
      }),
      'YBHI'
    )
    expect(r.map((m) => [m.id, m.status, m.role])).toEqual([
      ['a1', 'available', 'from'],
      ['b1', 'accepted', 'to'],
    ])
  })

  it('returns an empty list for an airport with no missions', () => {
    expect(missionsAtAirport(game(), 'YBAS')).toEqual([])
  })
})

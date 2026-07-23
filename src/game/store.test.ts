import { describe, it, expect, afterEach } from 'vitest'
import { migratePersistedState, useGame } from './store'
import { getSpec } from '../data/aircraft'
import type { GameState, OwnedAircraft } from './types'

const aircraft = (locationIcao: string): OwnedAircraft => ({
  id: 'ac1',
  specId: 'c210',
  registration: 'VH-ABC',
  hoursFlown: 0,
  condition: 100,
  locationIcao,
})

// A legacy save (SAVE_VERSION 1) written before homeBaseIcao/pilotLocationIcao
// existed. Cast through unknown because it is deliberately missing those fields.
function legacySave(fleetLoc: string | null) {
  const game = {
    version: 1,
    companyName: 'Test Air',
    balance: 1000,
    reputation: 50,
    day: 3,
    fuel: { AVGAS: 2.9, JETA: 2.4 },
    fleet: fleetLoc ? [aircraft(fleetLoc)] : [],
    availableMissions: [],
    acceptedMissions: [],
    ledger: [],
    stats: { missionsCompleted: 0, missionsFailed: 0, hoursFlown: 0, totalEarned: 0 },
  }
  return { game } as unknown as { game: GameState | null }
}

describe('migratePersistedState', () => {
  it('fills home base and pilot location from the first aircraft', () => {
    const out = migratePersistedState(legacySave('YBHI'), 1)
    expect(out.game?.homeBaseIcao).toBe('YBAS')
    expect(out.game?.pilotLocationIcao).toBe('YBHI')
    expect(out.game?.version).toBe(4)
  })

  it('adds the outback region id and synthesises an operator profile', () => {
    const out = migratePersistedState(legacySave('YBHI'), 1)
    expect(out.game?.regionId).toBe('outback')
    expect(out.operator).toMatchObject({ name: 'Test Air', xp: 0, startRegionId: 'outback' })
  })

  it('falls back to YBAS when the fleet is empty', () => {
    const out = migratePersistedState(legacySave(null), 1)
    expect(out.game?.pilotLocationIcao).toBe('YBAS')
    expect(out.game?.homeBaseIcao).toBe('YBAS')
  })

  it('returns a save with no game unchanged', () => {
    const out = migratePersistedState({ game: null }, 1)
    expect(out.game).toBeNull()
  })

  it('does not overwrite values that already exist', () => {
    const save = legacySave('YBHI')
    save.game!.homeBaseIcao = 'YPPH'
    save.game!.pilotLocationIcao = 'YBMA'
    const out = migratePersistedState(save, 1)
    expect(out.game?.homeBaseIcao).toBe('YPPH')
    expect(out.game?.pilotLocationIcao).toBe('YBMA')
  })

  it('leaves a save from a newer version untouched', () => {
    const save = legacySave('YBHI')
    save.game!.version = 5
    const out = migratePersistedState(save, 5)
    expect(out.game?.version).toBe(5)
    expect(out.game?.homeBaseIcao).toBeUndefined()
  })
})

describe('newGame starter selection', () => {
  it('starts with the chosen aircraft and its documented balance', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const g = useGame.getState().game!
    expect(g.fleet).toHaveLength(1)
    expect(g.fleet[0].specId).toBe('bonanza')
    expect(g.balance).toBe(1000)
  })

  it('records the starting balance as an OPENING ledger entry', () => {
    useGame.getState().newGame('Test Air', 'pc6')
    const g = useGame.getState().game!
    expect(g.balance).toBe(-20000)
    const opening = g.ledger.find((e) => e.category === 'OPENING')
    expect(opening?.amount).toBe(-20000)
    expect(opening?.balanceAfter).toBe(-20000)
  })

  it('does not count opening capital as earnings', () => {
    useGame.getState().newGame('Test Air', 'c152') // +30000, a positive opening entry
    const g = useGame.getState().game!
    expect(g.balance).toBe(30000)
    expect(g.stats.totalEarned).toBe(0)
  })

  it('falls back to the Cessna 172 for an invalid starter id', () => {
    useGame.getState().newGame('Test Air', 'nope')
    const g = useGame.getState().game!
    expect(g.fleet[0].specId).toBe('c172')
    expect(g.balance).toBe(20000)
    expect(() => getSpec(g.fleet[0].specId)).not.toThrow()
  })

  afterEach(() => useGame.getState().resetGame())
})

describe('newGame regions and operator profile', () => {
  it('defaults to the outback region at Alice Springs', () => {
    useGame.getState().newGame('Test Air', 'c172')
    const g = useGame.getState().game!
    expect(g.regionId).toBe('outback')
    expect(g.homeBaseIcao).toBe('YBAS')
    expect(g.pilotLocationIcao).toBe('YBAS')
    expect(g.fleet[0].locationIcao).toBe('YBAS')
  })

  it('starts an East Africa operation at Nairobi Wilson', () => {
    useGame.getState().newGame('Test Air', 'c172', 'africa')
    const g = useGame.getState().game!
    expect(g.regionId).toBe('africa')
    expect(g.homeBaseIcao).toBe('HKNW')
    expect(g.fleet[0].locationIcao).toBe('HKNW')
    // Every generated mission stays within the chosen region.
    const africaIcaos = new Set(['HKNW', 'HKJK', 'HKMO', 'HTKJ', 'HUEN', 'HTDA', 'HKKI', 'HKEL', 'HKML', 'HKWJ', 'HKLO', 'HKLK', 'HKGA', 'HKMB', 'HTAR', 'HTZA', 'HTMW', 'HTDO', 'HSSJ', 'HAAB'])
    for (const m of g.availableMissions) {
      expect(africaIcaos.has(m.fromIcao)).toBe(true)
      expect(africaIcaos.has(m.toIcao)).toBe(true)
    }
  })

  it('creates an operator profile that records the starting region', () => {
    useGame.getState().newGame('Red Centre Air', 'c172', 'namerica')
    const op = useGame.getState().operator!
    expect(op).toMatchObject({ name: 'Red Centre Air', xp: 0, startRegionId: 'namerica' })
  })

  afterEach(() => useGame.getState().resetGame())
})

describe('migratePersistedState catalogue remap', () => {
  it('remaps removed spec ids and stamps the current version', () => {
    const out = migratePersistedState(legacySave('YBAS'), 2)
    // legacySave() builds a fleet aircraft with the removed specId 'c210'
    expect(out.game?.fleet[0].specId).toBe('bonanza')
    expect(out.game?.version).toBe(4)
    expect(() => getSpec(out.game!.fleet[0].specId)).not.toThrow()
  })

  it('remaps a PA-31 fleet aircraft to the Baron', () => {
    const save = legacySave('YBAS')
    save.game!.fleet[0].specId = 'pa31'
    const out = migratePersistedState(save, 2)
    expect(out.game?.fleet[0].specId).toBe('baron')
  })
})

import { describe, it, expect } from 'vitest'
import { migratePersistedState } from './store'
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
    expect(out.game?.version).toBe(2)
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
    save.game!.version = 3
    const out = migratePersistedState(save, 3)
    expect(out.game?.version).toBe(3)
    expect(out.game?.homeBaseIcao).toBeUndefined()
  })
})

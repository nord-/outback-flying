import { describe, it, expect, afterEach } from 'vitest'
import { migratePersistedState, useGame, getHydrationError } from './store'
import { getSpec } from '../data/aircraft'
import { airportsInRegion } from '../data/airports'
import { maintenanceCost } from './economy'
import type { GameState, OwnedAircraft, Mission } from './types'
import type { DerivedFlight } from './flightlog'

const mission = (over: Partial<Mission> = {}): Mission => ({
  id: 'm1',
  type: 'MEDEVAC',
  title: 'Test run',
  description: '',
  fromIcao: 'YBAS',
  toIcao: 'YBHI',
  distanceNm: 635,
  seatsRequired: 1,
  urgency: 'ROUTINE',
  reward: 5000,
  penalty: 1000,
  postedDay: 1,
  expiresDay: 10,
  reputationReward: 2,
  ...over,
})

const derived = (over: Partial<DerivedFlight> = {}): DerivedFlight => ({
  legs: [{ fromIcao: 'YBAS', toIcao: 'YBHI', blockMinutes: 130, flightMinutes: 110, distanceNm: 635, fuelUsedL: 90 }],
  startIcao: 'YBAS',
  endIcao: 'YBHI',
  intermediates: [],
  blockMinutes: 130,
  flightMinutes: 110,
  dutyMinutes: 190,
  distanceNm: 635,
  fuelUsedL: 90,
  landings: 1,
  track: [],
  simAircraftTitle: 'Black Square A36TC Bonanza Professional N3475M',
  simAtcModel: 'Bonanza',
  ...over,
})

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
    expect(out.game?.version).toBe(6)
  })

  it('adds the outback region id and synthesises an operator profile', () => {
    const out = migratePersistedState(legacySave('YBHI'), 1)
    expect(out.game?.regionId).toBe('outback')
    expect(out.operator).toMatchObject({ name: 'Test Air', xp: 0, startRegionId: 'outback' })
  })

  it('defaults flightLogs to an empty list on a pre-v5 save', () => {
    const out = migratePersistedState(legacySave('YBHI'), 1)
    expect(out.game?.flightLogs).toEqual([])
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
    save.game!.version = 7
    const out = migratePersistedState(save, 7)
    expect(out.game?.version).toBe(7)
    expect(out.game?.homeBaseIcao).toBeUndefined()
  })

  it('normalizes an unknown regionId instead of trusting a corrupt save', () => {
    const save = legacySave('YBHI')
    ;(save.game as unknown as { regionId: string }).regionId = 'atlantis'
    const out = migratePersistedState(save, 4)
    expect(out.game?.regionId).toBe('outback')
  })

  it('normalizes an unknown operator.startRegionId instead of trusting a corrupt save', () => {
    const save = legacySave('YBHI') as unknown as {
      game: GameState
      operator: { name: string; xp: number; startRegionId: string }
    }
    save.game.regionId = 'africa'
    save.operator = { name: 'Test Air', xp: 0, startRegionId: 'atlantis' }
    const out = migratePersistedState(save, 4)
    expect(out.operator?.startRegionId).toBe('africa')
  })

  it('seeds dutyLog from existing flightLogs on a pre-v6 save', () => {
    const save = legacySave('YBHI')
    save.game!.flightLogs = [
      { id: 'fl1', day: 2, missionId: 'm1', dutyMinutes: 150 } as never,
      { id: 'fl2', day: 3, dutyMinutes: 90 } as never, // free flight, no missionId
    ]
    const out = migratePersistedState(save, 1)
    expect(out.game?.version).toBe(6)
    expect(out.game?.dutyLog).toHaveLength(2)
    expect(out.game?.dutyLog[0]).toMatchObject({ day: 2, minutes: 150, kind: 'MISSION', missionId: 'm1' })
    expect(out.game?.dutyLog[1]).toMatchObject({ day: 3, minutes: 90, kind: 'FREE' })
  })

  it('does not re-seed a dutyLog that already exists', () => {
    const save = legacySave('YBHI')
    save.game!.dutyLog = [{ id: 'keep', day: 1, minutes: 42, kind: 'FERRY' }]
    save.game!.flightLogs = [{ id: 'fl1', day: 2, dutyMinutes: 150 } as never]
    const out = migratePersistedState(save, 1)
    expect(out.game?.dutyLog).toEqual([{ id: 'keep', day: 1, minutes: 42, kind: 'FERRY' }])
  })
})

describe('newGame starter selection', () => {
  it('starts with the chosen aircraft and its documented balance', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const g = useGame.getState().game!
    expect(g.fleet).toHaveLength(1)
    expect(g.fleet[0].specId).toBe('bonanza')
    expect(g.balance).toBe(1000)
    expect(g.flightLogs).toEqual([])
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

  it('gives aircraft region-flavoured registrations', () => {
    useGame.getState().newGame('Test Air', 'c172')
    expect(useGame.getState().game!.fleet[0].registration).toMatch(/^VH-[A-Z]{3}$/)
    useGame.getState().resetGame()

    useGame.getState().newGame('Test Air', 'c172', 'africa')
    expect(useGame.getState().game!.fleet[0].registration).toMatch(/^5Y-[A-Z]{3}$/)
    useGame.getState().resetGame()

    useGame.getState().newGame('Test Air', 'c172', 'namerica')
    expect(useGame.getState().game!.fleet[0].registration).toMatch(/^N\d{3}[A-Z]{2}$/)
  })

  it('starts an East Africa operation at Nairobi Wilson', () => {
    useGame.getState().newGame('Test Air', 'c172', 'africa')
    const g = useGame.getState().game!
    expect(g.regionId).toBe('africa')
    expect(g.homeBaseIcao).toBe('HKNW')
    expect(g.fleet[0].locationIcao).toBe('HKNW')
    // Every generated mission stays within the chosen region.
    const africaIcaos = new Set(airportsInRegion('africa').map((a) => a.icao))
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

describe('commitFlightLog', () => {
  afterEach(() => useGame.getState().resetGame())

  it('commits a mission flight: pays the reward, logs it, and moves the aircraft', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const aircraftId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [mission()] } }))

    const res = useGame.getState().commitFlightLog({ derived: derived(), aircraftId, missionId: 'm1' })
    expect(res.ok).toBe(true)
    expect(res.reward).toBe(5000)

    const g = useGame.getState().game!
    expect(g.acceptedMissions).toHaveLength(0)
    expect(g.stats.missionsCompleted).toBe(1)
    expect(g.fleet[0].locationIcao).toBe('YBHI')
    expect(g.flightLogs).toHaveLength(1)
    expect(g.flightLogs[0].missionId).toBe('m1')
    expect(g.flightLogs[0].earnings).toBe(res.net)
    expect(useGame.getState().operator!.xp).toBeGreaterThan(0)
  })

  it('commits a free flight with no mission: no reward, still logged and charged', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const aircraftId = useGame.getState().game!.fleet[0].id

    const res = useGame.getState().commitFlightLog({ derived: derived(), aircraftId })
    expect(res.ok).toBe(true)
    expect(res.reward).toBe(0)
    expect(res.net).toBeLessThan(0) // fuel + maintenance, no income

    const g = useGame.getState().game!
    expect(g.flightLogs).toHaveLength(1)
    expect(g.flightLogs[0].missionId).toBeUndefined()
  })

  it('rejects a recorded departure that does not match the mission', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const aircraftId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [mission({ fromIcao: 'YPAD' })] } }))

    const res = useGame.getState().commitFlightLog({ derived: derived(), aircraftId, missionId: 'm1' })
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/departure/i)
  })

  it('rejects a recorded arrival that does not match the mission', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const aircraftId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [mission({ toIcao: 'YPAD' })] } }))

    const res = useGame.getState().commitFlightLog({ derived: derived(), aircraftId, missionId: 'm1' })
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/arrival/i)
  })

  it('rejects a recording with no landings', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const aircraftId = useGame.getState().game!.fleet[0].id
    const res = useGame.getState().commitFlightLog({ derived: derived({ landings: 0 }), aircraftId })
    expect(res.ok).toBe(false)
  })

  it('rejects a recorded departure that does not match where the game thinks the aircraft is — even with no mission attached (prevents skipping a paid reposition)', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const aircraftId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({
      game: { ...s.game!, fleet: [{ ...s.game!.fleet[0], locationIcao: 'YPAD' }] },
    }))

    // derived() starts at YBAS, but the game thinks this aircraft is at YPAD.
    const res = useGame.getState().commitFlightLog({ derived: derived(), aircraftId })
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/reposition/i)
    expect(useGame.getState().game!.flightLogs).toHaveLength(0)
  })

  it('rejects a mission with too few seats for the aircraft (mirrors flyMission)', () => {
    useGame.getState().newGame('Test Air', 'bonanza') // 5 seats
    const aircraftId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [mission({ seatsRequired: 6 })] } }))

    const res = useGame.getState().commitFlightLog({ derived: derived(), aircraftId, missionId: 'm1' })
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/seats/i)
  })

  it('rejects an unknown aircraft', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const res = useGame.getState().commitFlightLog({ derived: derived(), aircraftId: 'nope' })
    expect(res.ok).toBe(false)
  })
})

describe('commitFlightLog duty', () => {
  afterEach(() => useGame.getState().resetGame())

  it('logs duty as MISSION when tied to a mission', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const aircraftId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [mission()] } }))
    const res = useGame.getState().commitFlightLog({ derived: derived(), aircraftId, missionId: 'm1' })
    expect(res.ok).toBe(true)
    const g = useGame.getState().game!
    expect(g.dutyLog).toHaveLength(1)
    expect(g.dutyLog[0]).toMatchObject({ minutes: derived().dutyMinutes, kind: 'MISSION', missionId: 'm1' })
    expect(res.dutyFactor).toBe(1)
  })

  it('logs a free flight as FREE with no reward penalty', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const aircraftId = useGame.getState().game!.fleet[0].id
    const res = useGame.getState().commitFlightLog({ derived: derived(), aircraftId })
    expect(res.ok).toBe(true)
    expect(useGame.getState().game!.dutyLog[0].kind).toBe('FREE')
  })
})

describe('flyMission duty', () => {
  afterEach(() => useGame.getState().resetGame())

  const placeAndAccept = (block: number) => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const g0 = useGame.getState().game!
    const ac = g0.fleet[0]
    const m = mission({ fromIcao: ac.locationIcao, toIcao: 'YBHI', distanceNm: 200, seatsRequired: 1 })
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [m] } }))
    return useGame.getState().flyMission({
      missionId: m.id,
      aircraftId: ac.id,
      blockMinutes: block,
      fuelLitres: 100,
      landings: 1,
    })
  }

  it('appends exactly one duty entry using block + 60 (one landing)', () => {
    placeAndAccept(120)
    const g = useGame.getState().game!
    expect(g.dutyLog).toHaveLength(1)
    expect(g.dutyLog[0]).toMatchObject({ day: 1, minutes: 180, kind: 'MISSION' }) // 120 + 30*2
  })

  it('gives full reward when under all limits (dutyFactor 1)', () => {
    const res = placeAndAccept(120)
    expect(res.dutyFactor).toBe(1)
  })

  it('withholds 50% when the flight crosses the daily limit', () => {
    // Pre-load 500 min today; a 120-min-block flight adds 180 => 680 > 600.
    useGame.getState().newGame('Test Air', 'bonanza')
    const g0 = useGame.getState().game!
    const ac = g0.fleet[0]
    const m = mission({ fromIcao: ac.locationIcao, toIcao: 'YBHI', distanceNm: 200, seatsRequired: 1, reward: 4000 })
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        acceptedMissions: [m],
        dutyLog: [{ id: 'pre', day: 1, minutes: 500, kind: 'MISSION' }],
      },
    }))
    const res = useGame.getState().flyMission({
      missionId: m.id, aircraftId: ac.id, blockMinutes: 120, fuelLitres: 0, landings: 1,
    })
    expect(res.dutyFactor).toBe(0.5)
    const g = useGame.getState().game!
    // A PENALTY line of -2000 (half of 4000) exists.
    expect(g.ledger.some((l) => l.category === 'PENALTY' && l.amount === -2000)).toBe(true)
    // net = reward - withheld - fuel(0) - maint - latePenalty(0)
    const maint = maintenanceCost(120, getSpec('bonanza').maintPerHour)
    expect(res.net).toBe(4000 - 2000 - 0 - maint)
  })

  it('withholds 100% when already over a limit before the flight', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const g0 = useGame.getState().game!
    const ac = g0.fleet[0]
    const m = mission({ fromIcao: ac.locationIcao, toIcao: 'YBHI', distanceNm: 200, seatsRequired: 1, reward: 4000 })
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        acceptedMissions: [m],
        dutyLog: [{ id: 'pre', day: 1, minutes: 700, kind: 'MISSION' }], // already > 600
      },
    }))
    const res = useGame.getState().flyMission({
      missionId: m.id, aircraftId: ac.id, blockMinutes: 60, fuelLitres: 0, landings: 1,
    })
    expect(res.dutyFactor).toBe(0)
    const g = useGame.getState().game!
    expect(g.ledger.some((l) => l.category === 'PENALTY' && l.amount === -4000)).toBe(true)
    // A fully-withheld reward must not inflate lifetime earnings: totalEarned
    // counts reward actually kept, so a 100% duty violation nets to zero.
    expect(g.stats.totalEarned).toBe(0)
  })

  it('counts only the kept half of the reward in totalEarned on a 50% violation', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const g0 = useGame.getState().game!
    const ac = g0.fleet[0]
    const m = mission({ fromIcao: ac.locationIcao, toIcao: 'YBHI', distanceNm: 200, seatsRequired: 1, reward: 4000 })
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        acceptedMissions: [m],
        dutyLog: [{ id: 'pre', day: 1, minutes: 500, kind: 'MISSION' }], // 500 + 180 = 680 > 600
      },
    }))
    useGame.getState().flyMission({
      missionId: m.id, aircraftId: ac.id, blockMinutes: 120, fuelLitres: 0, landings: 1,
    })
    // Full 4000 posted, 2000 withheld → 2000 kept.
    expect(useGame.getState().game!.stats.totalEarned).toBe(2000)
  })
})

describe('repositionAircraft duty', () => {
  afterEach(() => useGame.getState().resetGame())

  it('logs ferry duty as block + 60 with kind FERRY and no reward', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const g0 = useGame.getState().game!
    const ac = g0.fleet[0]
    const dest = airportsInRegion(g0.regionId).find((a) => a.icao !== ac.locationIcao)!
    useGame.getState().repositionAircraft(ac.id, dest.icao, 90, 80)
    const g = useGame.getState().game!
    expect(g.dutyLog).toHaveLength(1)
    expect(g.dutyLog[0]).toMatchObject({ minutes: 150, kind: 'FERRY' }) // 90 + 30*2
    expect(g.dutyLog[0].missionId).toBeUndefined()
  })
})

describe('migratePersistedState catalogue remap', () => {
  it('remaps removed spec ids and stamps the current version', () => {
    const out = migratePersistedState(legacySave('YBAS'), 2)
    // legacySave() builds a fleet aircraft with the removed specId 'c210'
    expect(out.game?.fleet[0].specId).toBe('bonanza')
    expect(out.game?.version).toBe(6)
    expect(() => getSpec(out.game!.fleet[0].specId)).not.toThrow()
  })

  it('remaps a PA-31 fleet aircraft to the Baron', () => {
    const save = legacySave('YBAS')
    save.game!.fleet[0].specId = 'pa31'
    const out = migratePersistedState(save, 2)
    expect(out.game?.fleet[0].specId).toBe('baron')
  })
})

// End-to-end through the persist middleware and persistentStorage (in jsdom
// there is no IndexedDB, so the adapter's localStorage path carries the save —
// the IndexedDB path is covered in idbStorage.test.ts).
describe('rehydration through persistentStorage', () => {
  const SAVE_KEY = 'outback-flying-save'
  afterEach(() => {
    localStorage.removeItem(SAVE_KEY)
    useGame.getState().resetGame()
  })

  it('rehydrates and migrates a stored save', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: legacySave('YBHI'), version: 1 }))
    await useGame.persist.rehydrate()
    const g = useGame.getState().game!
    expect(g.companyName).toBe('Test Air')
    expect(g.pilotLocationIcao).toBe('YBHI') // migrate() ran over the stored value
    expect(g.fleet[0].specId).toBe('bonanza') // c210 remapped by the v3 migration
  })

  it('signals a hydration error for a corrupt save instead of hanging', async () => {
    localStorage.setItem(SAVE_KEY, '{this is not json')
    await Promise.resolve(useGame.persist.rehydrate()).catch(() => {})
    // onFinishHydration never fires on failure; the error signal is what keeps
    // the boot screen from waiting forever (see useHydrated + App.tsx).
    expect(getHydrationError()).toBeTruthy()
  })
})

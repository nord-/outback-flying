import { describe, it, expect, afterEach } from 'vitest'
import { migratePersistedState, useGame, getHydrationError } from './store'
import { getSpec } from '../data/aircraft'
import { airportsInRegion, getAirport } from '../data/airports'
import { maintenanceCost, refuelCost, conditionLoss } from './economy'
import { landingWear } from './fields'
import type { GameState, OwnedAircraft, Mission, FlightLeg } from './types'

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

const leg = (over: Partial<FlightLeg> = {}): FlightLeg => ({
  fromIcao: 'YBAS',
  toIcao: 'YTNK',
  blockMinutes: 90,
  flightMinutes: 75,
  distanceNm: 300,
  fuelUsedL: 60,
  ...over,
})

const aircraft = (locationIcao: string): OwnedAircraft => ({
  id: 'ac1',
  specId: 'c210',
  registration: 'VH-ABC',
  hoursFlown: 0,
  condition: 100,
  locationIcao,
  fuelL: 400,
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
    expect(out.game?.version).toBe(10)
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
    save.game!.version = 11
    const out = migratePersistedState(save, 11)
    expect(out.game?.version).toBe(11)
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
    expect(out.game?.version).toBe(10)
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

  it('seeds a full tank for a pre-v7 aircraft that has none', () => {
    const save = legacySave('YBHI')
    // Simulate a v6 save: an aircraft with a real spec but no fuelL field.
    const legacyAc: Omit<OwnedAircraft, 'fuelL'> = {
      id: 'ac1', specId: 'bonanza', registration: 'VH-XYZ',
      hoursFlown: 0, condition: 100, locationIcao: 'YBHI',
    }
    save.game!.version = 6
    save.game!.fleet = [legacyAc as OwnedAircraft]
    const out = migratePersistedState(save, 6)
    expect(out.game?.fleet[0].fuelL).toBe(getSpec('bonanza').fuelCapacityL)
  })

  it('v8 defaults armedMissions and leaves off-field fields absent', () => {
    const persisted = legacySave('YBHI')
    delete (persisted.game as any).armedMissionIds
    const out = migratePersistedState(persisted, 7)
    expect(out.game!.armedMissions).toEqual([])
    expect(out.game!.pilotOffField).toBeUndefined()
    expect(out.game!.openChain).toBeUndefined()
    expect(out.game!.version).toBe(10)
  })

  it('v9 drops a legacy plain-string armedMissionIds list instead of guessing its owning aircraft', () => {
    const persisted = legacySave('YBHI')
    ;(persisted.game as any).armedMissionIds = ['m1', 'm2']
    const out = migratePersistedState(persisted, 8)
    expect(out.game!.armedMissions).toEqual([])
    expect(out.game!.version).toBe(10)
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

  it('delivers the starter aircraft with a full tank', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    expect(ac.fuelL).toBe(getSpec('bonanza').fuelCapacityL)
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

describe('fuel consumption draws down the tank', () => {
  afterEach(() => useGame.getState().resetGame())

  it('flyMission subtracts reported fuel from the tank and posts no FUEL entry', () => {
    useGame.getState().newGame('Test Air', 'bonanza') // full tank 400
    const acId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [mission()] } }))
    const res = useGame.getState().flyMission({ missionId: 'm1', aircraftId: acId, blockMinutes: 130, fuelLitres: 90, landings: 1 })
    expect(res.ok).toBe(true)
    const g = useGame.getState().game!
    expect(g.fleet[0].fuelL).toBe(310) // 400 - 90
    expect(g.ledger.some((e) => e.category === 'FUEL')).toBe(false)
  })

  it('floors the tank at zero and notes a dry tank when burn exceeds fuel', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const acId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, fleet: [{ ...s.game!.fleet[0], fuelL: 50 }], acceptedMissions: [mission()] } }))
    const res = useGame.getState().flyMission({ missionId: 'm1', aircraftId: acId, blockMinutes: 130, fuelLitres: 90, landings: 1 })
    expect(res.ok).toBe(true)
    expect(useGame.getState().game!.fleet[0].fuelL).toBe(0)
    expect(res.message).toMatch(/dry/i)
  })

  it('repositionAircraft draws the tank down and bills maintenance only', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const acId = useGame.getState().game!.fleet[0].id
    const res = useGame.getState().repositionAircraft(acId, 'YBHI', 60, 40)
    expect(res.ok).toBe(true)
    const g = useGame.getState().game!
    expect(g.fleet[0].fuelL).toBe(360) // 400 - 40
    expect(g.ledger.some((e) => e.category === 'FUEL')).toBe(false)
  })

})

describe('migratePersistedState catalogue remap', () => {
  it('remaps removed spec ids and stamps the current version', () => {
    const out = migratePersistedState(legacySave('YBAS'), 2)
    // legacySave() builds a fleet aircraft with the removed specId 'c210'
    expect(out.game?.fleet[0].specId).toBe('bonanza')
    expect(out.game?.version).toBe(10)
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

describe('refuel', () => {
  afterEach(() => useGame.getState().resetGame())

  it('loads fuel, charges the field price × multiplier, and posts a FUEL entry', () => {
    useGame.getState().newGame('Test Air', 'bonanza') // AVGAS, capacity 400, starts full
    const g0 = useGame.getState().game!
    const acId = g0.fleet[0].id
    // Burn some first so there's room, then refuel.
    useGame.setState((s) => ({ game: { ...s.game!, fleet: [{ ...s.game!.fleet[0], fuelL: 300 }] } }))
    const price = useGame.getState().game!.fuel.AVGAS
    const res = useGame.getState().refuel(acId, 100)
    expect(res.ok).toBe(true)
    const g = useGame.getState().game!
    expect(g.fleet[0].fuelL).toBe(400)
    // YBAS is a base → mult 1.0.
    expect(res.cost).toBe(Math.round(100 * price * 1.0))
    expect(g.ledger[0].category).toBe('FUEL')
    expect(g.ledger[0].amount).toBe(-res.cost!)
  })

  it('rejects a non-positive litres amount', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const acId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, fleet: [{ ...s.game!.fleet[0], fuelL: 100 }] } }))
    const res = useGame.getState().refuel(acId, 0)
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/positive/i)
  })

  it('rejects overfilling past capacity', () => {
    useGame.getState().newGame('Test Air', 'bonanza') // starts full at 400
    const acId = useGame.getState().game!.fleet[0].id
    const res = useGame.getState().refuel(acId, 50)
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/overfill/i)
  })

  it('respects a caller-supplied capacity override (sim capacity)', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const acId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, fleet: [{ ...s.game!.fleet[0], fuelL: 100 }] } }))
    const res = useGame.getState().refuel(acId, 60, 150) // sim cap 150 < spec 400
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/150 L/)
  })

  it('rejects refuelling where the field offers no fuel', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const acId = useGame.getState().game!.fleet[0].id
    // Park the aircraft at an off-catalogue field: airportOffersFuel returns
    // false for an unknown icao, which is exactly the gate #5's no-fuel strips
    // will hit. This exercises the store gate for real without needing a
    // no-fuel field in the catalogue yet.
    useGame.setState((s) => ({ game: { ...s.game!, fleet: [{ ...s.game!.fleet[0], locationIcao: 'ZZZZ' }] } }))
    const res = useGame.getState().refuel(acId, 10)
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/no AVGAS/i)
  })

  it('accepts refuelling at a normal field that offers the type', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const acId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, fleet: [{ ...s.game!.fleet[0], fuelL: 300 }] } }))
    expect(useGame.getState().refuel(acId, 10).ok).toBe(true)
  })

  it('fills to full from a fractional tank without a false overfill rejection', () => {
    useGame.getState().newGame('Test Air', 'bonanza') // cap 400
    const acId = useGame.getState().game!.fleet[0].id
    useGame.setState((s) => ({ game: { ...s.game!, fleet: [{ ...s.game!.fleet[0], fuelL: 309.28 }] } }))
    const toFull = Math.round(400 - 309.28) // 91 — what the Fleet button passes
    const res = useGame.getState().refuel(acId, toFull)
    expect(res.ok).toBe(true)
    expect(useGame.getState().game!.fleet[0].fuelL).toBe(400) // clamped exactly to capacity
  })
})

describe('always-on session actions (#20)', () => {
  afterEach(() => useGame.getState().resetGame())

  // Starts a game, places the starter aircraft at `fromIcao`, and plants an
  // accepted + armed mission fromIcao -> toIcao (id 'm1' unless overridden).
  function newGameWithMission(fromIcao: string, toIcao: string, missionOver: Partial<Mission> = {}) {
    useGame.getState().newGame('Test Air', 'bonanza') // 5 seats
    const m = mission({ id: 'm1', fromIcao, toIcao, seatsRequired: 1, ...missionOver })
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        fleet: [{ ...s.game!.fleet[0], locationIcao: fromIcao }],
        acceptedMissions: [m],
        armedMissions: [{ missionId: m.id, aircraftId: s.game!.fleet[0].id }],
      },
    }))
  }

  it('armMissions arms accepted missions from the field, seats permitting', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0] // at YBAS
    const m = mission({ id: 'm1', fromIcao: 'YBAS', toIcao: 'YTNK', seatsRequired: 1 })
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [m] } }))

    const res = useGame.getState().armMissions(ac.id, 'YBAS')
    const g = useGame.getState().game!
    expect(g.armedMissions.some((r) => r.missionId === 'm1')).toBe(true)
    expect(res.messages.some((msg) => msg.includes('underway'))).toBe(true)
  })

  it('armMissions refuses a mission needing more seats than the spec has', () => {
    useGame.getState().newGame('Test Air', 'bonanza') // 5 seats
    const ac = useGame.getState().game!.fleet[0]
    const m = mission({ id: 'm1', fromIcao: 'YBAS', toIcao: 'YTNK', seatsRequired: 6 })
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [m] } }))

    const res = useGame.getState().armMissions(ac.id, 'YBAS')
    const g = useGame.getState().game!
    expect(g.armedMissions.some((r) => r.missionId === 'm1')).toBe(false)
    expect(res.messages.some((msg) => msg.includes('seats'))).toBe(true)
  })

  it('stopAt completes an armed mission at its destination: reward, rep, XP, stats, un-arm', () => {
    newGameWithMission('YBAS', 'YTNK') // helper: accepted mission + armed id + aircraft at YBAS
    const g0 = useGame.getState().game!
    const missionId = g0.acceptedMissions[0].id
    const before = g0.balance
    const opBefore = useGame.getState().operator!.xp
    const res = useGame.getState().stopAt(g0.fleet[0].id, 'YTNK')
    const g1 = useGame.getState().game!
    expect(g1.acceptedMissions).toHaveLength(0)
    expect(g1.armedMissions.some((r) => r.missionId === missionId)).toBe(false)
    expect(g1.balance).toBeGreaterThan(before)
    expect(g1.stats.missionsCompleted).toBe(1)
    expect(g1.reputation).toBeGreaterThan(50)
    expect(useGame.getState().operator!.xp).toBeGreaterThan(opBefore)
    expect(res.messages.some((m) => m.includes('complete'))).toBe(true)
  })

  it('a chain stop completes A→B and later stop completes A→C (double-completion)', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0] // at YBAS
    const mA = mission({ id: 'mA', fromIcao: 'YBAS', toIcao: 'YTNK', seatsRequired: 1, reward: 3000 })
    const mB = mission({ id: 'mB', fromIcao: 'YBAS', toIcao: 'YPAD', seatsRequired: 1, reward: 4000 })
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        acceptedMissions: [mA, mB],
        armedMissions: [
          { missionId: 'mA', aircraftId: ac.id },
          { missionId: 'mB', aircraftId: ac.id },
        ],
      },
    }))

    const r1 = useGame.getState().stopAt(ac.id, 'YTNK')
    let g = useGame.getState().game!
    expect(g.acceptedMissions.map((m) => m.id)).toEqual(['mB'])
    expect(g.armedMissions.map((r) => r.missionId)).toEqual(['mB'])
    expect(g.stats.missionsCompleted).toBe(1)

    const r2 = useGame.getState().stopAt(ac.id, 'YPAD')
    g = useGame.getState().game!
    expect(g.acceptedMissions).toHaveLength(0)
    expect(g.armedMissions).toHaveLength(0)
    expect(g.stats.missionsCompleted).toBe(2)
    expect(r1.messages.some((m) => m.includes('complete'))).toBe(true)
    expect(r2.messages.some((m) => m.includes('complete'))).toBe(true)
  })

  it('a different aircraft landing at the same destination does NOT collect a mission it did not carry (#22 review)', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const acA = useGame.getState().game!.fleet[0] // at YBAS
    const m = mission({ id: 'm1', fromIcao: 'YBAS', toIcao: 'YPAD', seatsRequired: 1, reward: 3000 })
    // A second aircraft, owned but never carrying the mission, also ends up at
    // the destination — e.g. it was already there, or ferried in separately.
    const acB: OwnedAircraft = { ...acA, id: 'ac2', registration: 'VH-BBB', locationIcao: 'YPAD' }
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        fleet: [acA, acB],
        acceptedMissions: [m],
        armedMissions: [{ missionId: 'm1', aircraftId: acA.id }], // armed by A, not B
      },
    }))

    const before = useGame.getState().game!.balance
    const res = useGame.getState().stopAt(acB.id, 'YPAD') // B lands where A's mission was headed
    const g = useGame.getState().game!
    expect(g.acceptedMissions).toHaveLength(1) // still outstanding — B didn't complete it
    expect(g.armedMissions).toHaveLength(1) // still armed for A
    expect(g.balance).toBe(before) // no payout
    expect(g.stats.missionsCompleted).toBe(0)
    expect(res.messages.some((m) => m.includes('complete'))).toBe(false)
  })

  it('stopAt withholds 100% of the reward when already over a duty limit', () => {
    newGameWithMission('YBAS', 'YTNK', { reward: 4000 })
    useGame.setState((s) => ({
      game: { ...s.game!, dutyLog: [{ id: 'pre', day: 1, minutes: 700, kind: 'MISSION' }] },
    }))
    const before = useGame.getState().game!.balance
    useGame.getState().stopAt(useGame.getState().game!.fleet[0].id, 'YTNK')
    const g = useGame.getState().game!
    expect(g.ledger.some((l) => l.category === 'PENALTY' && l.amount === -4000)).toBe(true)
    expect(g.stats.totalEarned).toBe(0)
    expect(g.stats.missionsCompleted).toBe(1)
    expect(g.balance).toBe(before) // reward fully withheld: net zero change
  })

  it('commitLeg syncs fuel/position from the sim and books per-leg maintenance, wear and duty', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    const res = useGame.getState().commitLeg({
      aircraftId: ac.id,
      leg: leg({ blockMinutes: 90 }),
      simFuelL: 300,
      pos: { icao: 'YTNK' },
      externalFuelL: 0,
      landings: 1,
      track: [],
      simTitle: 'Test Title',
      simAtcModel: 'Test Model',
    })
    const g = useGame.getState().game!
    const ac1 = g.fleet[0]
    expect(ac1.fuelL).toBe(300)
    expect(ac1.locationIcao).toBe('YTNK')
    expect(ac1.hoursFlown).toBe(1.5)
    const maint = maintenanceCost(90, getSpec('bonanza').maintPerHour)
    expect(g.ledger.some((l) => l.category === 'MAINTENANCE' && l.amount === -maint)).toBe(true)
    expect(g.dutyLog).toHaveLength(1)
    expect(g.dutyLog[0].minutes).toBe(150) // 90 + 30 + 30 (first leg of the day)
    expect(g.openChain?.legs).toHaveLength(1)
    expect(res.messages).toEqual([])
  })

  it('commitLeg at an uncatalogued position stores offField on aircraft and pilot', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    const res = useGame.getState().commitLeg({
      aircraftId: ac.id,
      leg: leg({ toIcao: null }),
      simFuelL: 250,
      pos: { lat: -20, lon: 133 },
      externalFuelL: 0,
      landings: 1,
      track: [],
      simTitle: 'Test Title',
      simAtcModel: 'Test Model',
    })
    const g = useGame.getState().game!
    expect(g.fleet[0].offField).toEqual({ lat: -20, lon: 133 })
    expect(g.pilotOffField).toEqual({ lat: -20, lon: 133 })
    expect(res.messages.some((m) => m.includes('off-field'))).toBe(true)
  })

  it('commitLeg bills external fuel at the arrival field rates', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    const price = useGame.getState().game!.fuel.AVGAS
    const res = useGame.getState().commitLeg({
      aircraftId: ac.id,
      leg: leg({ toIcao: 'YTNK' }),
      simFuelL: 300,
      pos: { icao: 'YTNK' },
      externalFuelL: 100,
      landings: 1,
      track: [],
      simTitle: 'Test Title',
      simAtcModel: 'Test Model',
    })
    const g = useGame.getState().game!
    const expectedCost = refuelCost(100, price, 1.1) // YTNK fuelPriceMult 1.1
    expect(g.ledger.some((l) => l.category === 'FUEL' && l.amount === -expectedCost)).toBe(true)
    expect(res.messages.some((m) => m.includes('External fuel'))).toBe(true)
  })

  it('commitLeg appends to the open chain; finalizeChain writes one FlightLog with summed earnings and missionIds', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    const m = mission({ id: 'm1', fromIcao: 'YBAS', toIcao: 'YCBP', seatsRequired: 1, reward: 3000 })
    useGame.setState((s) => ({
      game: { ...s.game!, acceptedMissions: [m], armedMissions: [{ missionId: 'm1', aircraftId: ac.id }] },
    }))

    const spec = getSpec('bonanza')
    const leg1 = leg({ fromIcao: 'YBAS', toIcao: 'YTNK', blockMinutes: 90 })
    const leg2 = leg({ fromIcao: 'YTNK', toIcao: 'YCBP', blockMinutes: 60 })

    useGame.getState().commitLeg({
      aircraftId: ac.id, leg: leg1, simFuelL: 300, pos: { icao: 'YTNK' },
      externalFuelL: 0, landings: 1, track: [], simTitle: 'T', simAtcModel: 'M',
    })
    useGame.getState().commitLeg({
      aircraftId: ac.id, leg: leg2, simFuelL: 250, pos: { icao: 'YCBP' },
      externalFuelL: 0, landings: 1, track: [], simTitle: 'T', simAtcModel: 'M',
    })

    useGame.getState().finalizeChain()
    const g = useGame.getState().game!
    expect(g.openChain).toBeUndefined()
    expect(g.flightLogs).toHaveLength(1)
    const fl = g.flightLogs[0]
    expect(fl.legs).toHaveLength(2)
    expect(fl.missionIds).toEqual(['m1'])
    const maint1 = maintenanceCost(90, spec.maintPerHour)
    const maint2 = maintenanceCost(60, spec.maintPerHour)
    expect(fl.earnings).toBe(3000 - maint1 - maint2)
  })

  it('advanceDay finalizes the open chain and un-arms expired missions', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    useGame.getState().commitLeg({
      aircraftId: ac.id,
      leg: leg({ toIcao: 'YTNK' }),
      simFuelL: 300,
      pos: { icao: 'YTNK' },
      externalFuelL: 0,
      landings: 1,
      track: [],
      simTitle: 'T',
      simAtcModel: 'M',
    })
    expect(useGame.getState().game!.openChain).toBeDefined()

    const expiring = mission({ id: 'mExp', fromIcao: 'YTNK', toIcao: 'YPAD', expiresDay: 1 })
    useGame.setState((s) => ({
      game: { ...s.game!, acceptedMissions: [expiring], armedMissions: [{ missionId: 'mExp', aircraftId: ac.id }] },
    }))

    useGame.getState().advanceDay()
    const g = useGame.getState().game!
    expect(g.openChain).toBeUndefined()
    expect(g.flightLogs).toHaveLength(1)
    expect(g.acceptedMissions).toHaveLength(0) // expired past deadline, penalty applied
    expect(g.armedMissions.some((r) => r.missionId === 'mExp')).toBe(false)
  })

  it('abandonMission un-arms', () => {
    newGameWithMission('YBAS', 'YTNK')
    const missionId = useGame.getState().game!.acceptedMissions[0].id
    useGame.getState().abandonMission(missionId)
    const g = useGame.getState().game!
    expect(g.armedMissions.some((r) => r.missionId === missionId)).toBe(false)
    expect(g.acceptedMissions).toHaveLength(0)
  })

  it("the day's first leg adds the flat 30 duty minutes; later legs add legBlock+30", () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    useGame.getState().commitLeg({
      aircraftId: ac.id, leg: leg({ blockMinutes: 90, toIcao: 'YTNK' }), simFuelL: 300,
      pos: { icao: 'YTNK' }, externalFuelL: 0, landings: 1, track: [], simTitle: 'T', simAtcModel: 'M',
    })
    useGame.getState().commitLeg({
      aircraftId: ac.id, leg: leg({ fromIcao: 'YTNK', blockMinutes: 60, toIcao: 'YCBP' }), simFuelL: 250,
      pos: { icao: 'YCBP' }, externalFuelL: 0, landings: 1, track: [], simTitle: 'T', simAtcModel: 'M',
    })
    const g = useGame.getState().game!
    expect(g.dutyLog).toHaveLength(2)
    expect(g.dutyLog[0].minutes).toBe(90 + 30 + 30) // first leg of the day
    expect(g.dutyLog[1].minutes).toBe(60 + 30) // later leg, no extra flat 30
  })

  it('flyMission rejects an off-field aircraft', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    const m = mission({ id: 'm1', fromIcao: ac.locationIcao, toIcao: 'YTNK', seatsRequired: 1 })
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        acceptedMissions: [m],
        fleet: [{ ...s.game!.fleet[0], offField: { lat: -20, lon: 133 } }],
      },
    }))
    const res = useGame.getState().flyMission({ missionId: 'm1', aircraftId: ac.id, blockMinutes: 90, fuelLitres: 50, landings: 1 })
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/off-field/i)
  })

  it('repositionAircraft from off-field clears offField and pilotOffField', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0] // anchored at YBAS
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        fleet: [{ ...s.game!.fleet[0], offField: { lat: -20, lon: 133 } }],
        pilotOffField: { lat: -20, lon: 133 },
      },
    }))
    // Reposition "to" the anchor field itself — allowed because the aircraft is
    // actually off-field, not genuinely already there (relaxed same-place guard).
    const res = useGame.getState().repositionAircraft(ac.id, 'YBAS', 90, 50)
    expect(res.ok).toBe(true)
    const g = useGame.getState().game!
    expect(g.fleet[0].offField).toBeUndefined()
    expect(g.pilotOffField).toBeUndefined()
    expect(g.fleet[0].locationIcao).toBe('YBAS')
  })

  // D14 fix: a mission completing on the FIRST leg of a chain used to be
  // dropped from the FlightLog because settleStop (which credits
  // openChain.earnings/missionIds) ran before any chain existed. beginChain
  // (and commitLeg's own ensureOpenChain call) now open the chain first.
  it('a mission completing on the first leg of a fresh chain still records earnings/missionIds (beginChain then commitLeg)', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    const m = mission({ id: 'm1', fromIcao: 'YBAS', toIcao: 'YTNK', seatsRequired: 1, reward: 3000 })
    useGame.setState((s) => ({
      game: { ...s.game!, acceptedMissions: [m], armedMissions: [{ missionId: 'm1', aircraftId: ac.id }] },
    }))

    useGame.getState().beginChain(ac.id, 'T', 'M')
    useGame.getState().commitLeg({
      aircraftId: ac.id,
      leg: leg({ fromIcao: 'YBAS', toIcao: 'YTNK', blockMinutes: 90 }),
      simFuelL: 300,
      pos: { icao: 'YTNK' },
      externalFuelL: 0,
      landings: 1,
      track: [],
      simTitle: 'T',
      simAtcModel: 'M',
    })
    useGame.getState().finalizeChain()

    const g = useGame.getState().game!
    const maint = maintenanceCost(90, getSpec('bonanza').maintPerHour)
    expect(g.flightLogs[0].missionIds).toEqual(['m1'])
    expect(g.flightLogs[0].earnings).toBe(3000 - maint)
  })

  it('a mission completing on the first leg still records earnings/missionIds even without a prior beginChain call', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    const m = mission({ id: 'm1', fromIcao: 'YBAS', toIcao: 'YTNK', seatsRequired: 1, reward: 3000 })
    useGame.setState((s) => ({
      game: { ...s.game!, acceptedMissions: [m], armedMissions: [{ missionId: 'm1', aircraftId: ac.id }] },
    }))

    // No beginChain call here — commitLeg must ensure its own chain exists
    // before settling, so the completion still lands in the FlightLog.
    useGame.getState().commitLeg({
      aircraftId: ac.id,
      leg: leg({ fromIcao: 'YBAS', toIcao: 'YTNK', blockMinutes: 90 }),
      simFuelL: 300,
      pos: { icao: 'YTNK' },
      externalFuelL: 0,
      landings: 1,
      track: [],
      simTitle: 'T',
      simAtcModel: 'M',
    })
    useGame.getState().finalizeChain()

    const g = useGame.getState().game!
    const maint = maintenanceCost(90, getSpec('bonanza').maintPerHour)
    expect(g.flightLogs[0].missionIds).toEqual(['m1'])
    expect(g.flightLogs[0].earnings).toBe(3000 - maint)
  })

  it('a running turnaround records both a stopAt-completed and a commitLeg-completed mission in the same FlightLog', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    const mAB = mission({ id: 'mAB', fromIcao: 'YBAS', toIcao: 'YTNK', seatsRequired: 1, reward: 3000 })
    const mAC = mission({ id: 'mAC', fromIcao: 'YBAS', toIcao: 'YCBP', seatsRequired: 1, reward: 4000 })
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        acceptedMissions: [mAB, mAC],
        armedMissions: [
          { missionId: 'mAB', aircraftId: ac.id },
          { missionId: 'mAC', aircraftId: ac.id },
        ],
      },
    }))

    useGame.getState().beginChain(ac.id, 'T', 'M')
    useGame.getState().stopAt(ac.id, 'YTNK') // completes mAB; chain already open from beginChain
    useGame.getState().commitLeg({
      aircraftId: ac.id,
      leg: leg({ fromIcao: 'YTNK', toIcao: 'YCBP', blockMinutes: 60 }),
      simFuelL: 250,
      pos: { icao: 'YCBP' },
      externalFuelL: 0,
      landings: 1,
      track: [],
      simTitle: 'T',
      simAtcModel: 'M',
    })
    useGame.getState().finalizeChain()

    const g = useGame.getState().game!
    const maint = maintenanceCost(60, getSpec('bonanza').maintPerHour)
    expect(g.flightLogs[0].missionIds).toHaveLength(2)
    expect(g.flightLogs[0].missionIds).toEqual(expect.arrayContaining(['mAB', 'mAC']))
    expect(g.flightLogs[0].earnings).toBe(3000 + 4000 - maint)
  })
})

describe('landing wear', () => {
  afterEach(() => useGame.getState().resetGame())

  // YABF (Aberfoyle) is a 660 m dirt strip — margin 1.043 for a bonanza,
  // giving landingWear(YABF, bonanza) = 0.36. Unlike a sealed hub (0 wear
  // regardless), this makes the assertion below fail if the store change
  // is ever reverted (#5 fix round 1).
  it('flyMission charges landing wear on top of the time-based loss', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const g0 = useGame.getState().game!
    const ac = g0.fleet[0]
    const m = mission({ fromIcao: ac.locationIcao, toIcao: 'YABF', distanceNm: 200, seatsRequired: 1 })
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [m] } }))

    useGame.getState().flyMission({
      missionId: m.id,
      aircraftId: ac.id,
      blockMinutes: 120,
      fuelLitres: 100,
      landings: 1,
    })

    const spec = getSpec('bonanza')
    const expected = 100 - conditionLoss(120) - landingWear(getAirport('YABF'), spec)
    expect(useGame.getState().game!.fleet[0].condition).toBeCloseTo(expected, 2)
  })

  it('repositionAircraft charges landing wear at the destination', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]

    useGame.getState().repositionAircraft(ac.id, 'YABF', 90, 80)

    const expected = 100 - conditionLoss(90) - landingWear(getAirport('YABF'), getSpec('bonanza'))
    expect(useGame.getState().game!.fleet[0].condition).toBeCloseTo(expected, 2)
  })

  it('commitLeg charges landing wear when it parks at a catalogued field', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]

    useGame.getState().commitLeg({
      aircraftId: ac.id,
      simTitle: 'Bonanza',
      simAtcModel: 'BE36',
      pos: { icao: 'YABF' },
      leg: leg({ toIcao: 'YABF', blockMinutes: 90 }),
      landings: 1,
      track: [],
      externalFuelL: 0,
      simFuelL: 200,
    })

    const expected = 100 - conditionLoss(90) - landingWear(getAirport('YABF'), getSpec('bonanza'))
    expect(useGame.getState().game!.fleet[0].condition).toBeCloseTo(expected, 2)
  })

  it('commitLeg charges no landing wear when parking off-field', () => {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]

    // Same physical spot as YABF (Aberfoyle) and the same aircraft/leg as
    // the "parks at a catalogued field" test above — landingWear(YABF,
    // bonanza) is 0.36, not 0, so this pair genuinely discriminates: an
    // off-field shutdown (pos carries lat/lon, no icao) must charge only
    // the time-based loss, while reporting the identical arrival as
    // `pos: { icao: 'YABF' }` would charge wear on top (B10).
    useGame.getState().commitLeg({
      aircraftId: ac.id,
      simTitle: 'Bonanza',
      simAtcModel: 'BE36',
      pos: { lat: -21.671, lon: 145.266 },
      leg: leg({ toIcao: null, blockMinutes: 90 }),
      landings: 1,
      track: [],
      externalFuelL: 0,
      simFuelL: 200,
    })

    // Only the time-based loss — no runway data exists off-field (B10).
    expect(useGame.getState().game!.fleet[0].condition).toBeCloseTo(100 - conditionLoss(90), 2)
  })

  it('never drives condition below zero', () => {
    // b200 is not a STARTER_OPTION, so makeInitialState would silently fall
    // back to DEFAULT_STARTER ('c172'). Inject the fleet directly instead.
    //
    // condition: 2.0 is deliberate, not arbitrary: conditionLoss(90) alone
    // is 1.35, leaving 0.65 — NOT clamped — if landing wear were skipped.
    // Only landingWear(YABF, b200) = 2.33 added on top drives the result
    // negative and into the clamp. A lower starting value (e.g. 0.1) would
    // already clamp from conditionLoss alone and could not tell an
    // implemented wear charge apart from a missing one (#5 fix round 1).
    useGame.getState().newGame('Test Air', 'c172')
    useGame.setState((s) => ({
      game: {
        ...s.game!,
        fleet: [{ ...s.game!.fleet[0], specId: 'b200', condition: 2.0, fuelL: 1000 }],
      },
    }))
    const ac = useGame.getState().game!.fleet[0]

    useGame.getState().repositionAircraft(ac.id, 'YABF', 90, 80)

    expect(useGame.getState().game!.fleet[0].condition).toBe(0)
  })
})

describe('time-critical missions (#11)', () => {
  afterEach(() => useGame.getState().resetGame())

  // Bonanza (5 seats) at YBAS with an accepted time-critical mission to YTNK.
  function tcGame(over: Partial<Mission> = {}) {
    useGame.getState().newGame('Test Air', 'bonanza')
    const ac = useGame.getState().game!.fleet[0]
    const m = mission({ id: 'tc1', type: 'ORGAN_TRANSPORT', fromIcao: 'YBAS', toIcao: 'YTNK', seatsRequired: 1, windowMinutes: 40, ...over })
    useGame.setState((s) => ({ game: { ...s.game!, acceptedMissions: [m] } }))
    return { ac, m }
  }
  const ARM_T = 1_000_000

  it('armMissions stamps windowEndsAtT from arm time + window for a time-critical mission', () => {
    const { ac } = tcGame()
    useGame.getState().armMissions(ac.id, 'YBAS', ARM_T)
    const armed = useGame.getState().game!.armedMissions.find((r) => r.missionId === 'tc1')
    expect(armed?.windowEndsAtT).toBe(ARM_T + 40 * 60_000)
  })

  it('stopAt within the window pays the reward (made it)', () => {
    const { ac } = tcGame()
    useGame.getState().armMissions(ac.id, 'YBAS', ARM_T)
    const before = useGame.getState().game!.balance
    const res = useGame.getState().stopAt(ac.id, 'YTNK', ARM_T + 30 * 60_000) // 30 < 40 min
    const g = useGame.getState().game!
    expect(g.stats.missionsCompleted).toBe(1)
    expect(g.stats.missionsFailed).toBe(0)
    expect(g.balance).toBeGreaterThan(before)
    expect(g.reputation).toBeGreaterThan(50)
    expect(g.acceptedMissions).toHaveLength(0)
    expect(g.armedMissions).toHaveLength(0)
    expect(res.messages.some((msg) => msg.includes('complete'))).toBe(true)
  })

  it('stopAt after the window hard-fails: no reward, penalty, -7 rep, missionsFailed', () => {
    const { m } = tcGame({ reward: 8000, penalty: 2000 })
    const ac = useGame.getState().game!.fleet[0]
    useGame.getState().armMissions(ac.id, 'YBAS', ARM_T)
    const before = useGame.getState().game!.balance
    const res = useGame.getState().stopAt(ac.id, 'YTNK', ARM_T + 50 * 60_000) // 50 > 40 min
    const g = useGame.getState().game!
    expect(g.stats.missionsFailed).toBe(1)
    expect(g.stats.missionsCompleted).toBe(0)
    expect(g.reputation).toBe(50 - 7)
    expect(g.balance).toBe(before - m.penalty) // penalty only, no reward posted
    expect(g.ledger.some((l) => l.category === 'MISSION')).toBe(false)
    expect(g.acceptedMissions).toHaveLength(0)
    expect(g.armedMissions).toHaveLength(0)
    expect(res.messages.some((msg) => msg.includes('Missed'))).toBe(true)
  })

  it('the honour flyMission path refuses a time-critical mission', () => {
    const { ac, m } = tcGame()
    const res = useGame.getState().flyMission({ missionId: m.id, aircraftId: ac.id, blockMinutes: 60, fuelLitres: 50, landings: 1 })
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/SimConnect/i)
  })

  it('commitLeg (ON_BLOCK route) settles a time-critical mission within the window', () => {
    const { ac } = tcGame()
    useGame.getState().armMissions(ac.id, 'YBAS', ARM_T)
    const before = useGame.getState().game!.balance
    useGame.getState().commitLeg({
      aircraftId: ac.id, atT: ARM_T + 30 * 60_000, leg: leg({ blockMinutes: 90 }),
      simFuelL: 300, pos: { icao: 'YTNK' }, externalFuelL: 0, landings: 1, track: [], simTitle: 'T', simAtcModel: 'M',
    })
    const g = useGame.getState().game!
    expect(g.stats.missionsCompleted).toBe(1)
    expect(g.stats.missionsFailed).toBe(0)
    expect(g.balance).toBeGreaterThan(before) // reward outweighs the per-leg maintenance
    expect(g.acceptedMissions).toHaveLength(0)
  })

  it('commitLeg (ON_BLOCK route) hard-fails a time-critical mission past the window', () => {
    const { ac } = tcGame({ reward: 8000, penalty: 2000 })
    useGame.getState().armMissions(ac.id, 'YBAS', ARM_T)
    useGame.getState().commitLeg({
      aircraftId: ac.id, atT: ARM_T + 50 * 60_000, leg: leg({ blockMinutes: 90 }),
      simFuelL: 300, pos: { icao: 'YTNK' }, externalFuelL: 0, landings: 1, track: [], simTitle: 'T', simAtcModel: 'M',
    })
    const g = useGame.getState().game!
    expect(g.stats.missionsFailed).toBe(1)
    expect(g.stats.missionsCompleted).toBe(0)
    expect(g.ledger.some((l) => l.category === 'MISSION')).toBe(false)
    expect(g.acceptedMissions).toHaveLength(0)
  })

  it('advanceDay does not re-penalise a time-critical mission already failed at the stop', () => {
    const { ac } = tcGame({ reward: 8000, penalty: 2000 })
    useGame.getState().armMissions(ac.id, 'YBAS', ARM_T)
    useGame.getState().stopAt(ac.id, 'YTNK', ARM_T + 50 * 60_000) // missed
    const failedBefore = useGame.getState().game!.stats.missionsFailed
    useGame.getState().advanceDay()
    expect(useGame.getState().game!.stats.missionsFailed).toBe(failedBefore)
  })

  it('fails OPEN when the window was never stamped (a plumbing gap must not punish the player)', () => {
    const { ac } = tcGame()
    useGame.getState().armMissions(ac.id, 'YBAS') // no atT → windowEndsAtT stays undefined
    expect(useGame.getState().game!.armedMissions.find((r) => r.missionId === 'tc1')?.windowEndsAtT).toBeUndefined()
    const before = useGame.getState().game!.balance
    useGame.getState().stopAt(ac.id, 'YTNK', ARM_T + 999 * 60_000) // far past — but unjudgeable
    const g = useGame.getState().game!
    expect(g.stats.missionsCompleted).toBe(1) // benefit of the doubt
    expect(g.stats.missionsFailed).toBe(0)
    expect(g.balance).toBeGreaterThan(before)
  })

  it('finalizeChain reverts an armed time-critical mission to plain accepted (crash/disconnect recovery)', () => {
    const { ac, m } = tcGame()
    useGame.getState().armMissions(ac.id, 'YBAS', ARM_T)
    useGame.getState().beginChain(ac.id, 'T', 'M') // open a chain so finalizeChain has something to close
    useGame.getState().finalizeChain()
    const g = useGame.getState().game!
    expect(g.armedMissions.some((r) => r.missionId === m.id)).toBe(false) // un-armed
    expect(g.acceptedMissions.some((mm) => mm.id === m.id)).toBe(true) // still accepted, re-arms next session
  })
})

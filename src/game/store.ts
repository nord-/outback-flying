import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { persistentStorage } from './idbStorage'
import type {
  GameState,
  LedgerCategory,
  Mission,
  OperatorProfile,
  OwnedAircraft,
} from './types'
import { getSpec, STARTER_OPTIONS, DEFAULT_STARTER } from '../data/aircraft'
import { getRegion, DEFAULT_REGION } from '../data/regions'
import { generateMissions } from './missions'
import { xpForMission } from './progression'
import {
  conditionLoss,
  fuelCost,
  maintenanceCost,
} from './economy'

const SAVE_VERSION = 4
const MISSION_BOARD_TARGET = 7

let idSeq = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(idSeq++).toString(36)}`

function randomRegistration(): string {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const s = () => L[Math.floor(Math.random() * L.length)]
  return `VH-${s()}${s()}${s()}`
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export interface PersistedSave {
  game: GameState | null
  operator?: OperatorProfile | null
}

/** Migrate an older persisted save forward to the current SAVE_VERSION:
 *  - v2: add home base / pilot location fields
 *  - v3: remap removed aircraft spec ids
 *  - v4: add the region id and synthesise an operator profile */
export function migratePersistedState(persisted: unknown, version: number): PersistedSave {
  const state = persisted as PersistedSave
  const g = state?.game
  if (!g) return state // no game started yet — nothing to migrate
  if (version > SAVE_VERSION) return state // newer save format than this build understands — don't touch it
  if (!g.homeBaseIcao) g.homeBaseIcao = 'YBAS'
  if (!g.pilotLocationIcao) g.pilotLocationIcao = g.fleet[0]?.locationIcao ?? 'YBAS'

  // Catalogue rework (v3): the Cessna 210 and PA-31 Navajo were removed. Remap
  // any owned aircraft that still reference them so getSpec() does not throw.
  const SPEC_REMAP: Record<string, string> = { c210: 'bonanza', pa31: 'baron' }
  for (const ac of g.fleet ?? []) {
    if (Object.prototype.hasOwnProperty.call(SPEC_REMAP, ac.specId)) ac.specId = SPEC_REMAP[ac.specId]
  }

  // Region support (v4): pre-region saves are all Australian outback. Also
  // synthesise an operator profile so the persistent career exists.
  if (!g.regionId) g.regionId = DEFAULT_REGION
  if (!state.operator) {
    state.operator = { name: g.companyName, xp: 0, startRegionId: g.regionId }
  }

  g.version = SAVE_VERSION
  return state
}

function makeInitialState(companyName: string, startSpecId: string, regionId: string): GameState {
  const region = getRegion(regionId)
  const home = region.homeBaseIcao
  const option =
    STARTER_OPTIONS.find((o) => o.specId === startSpecId) ??
    STARTER_OPTIONS.find((o) => o.specId === DEFAULT_STARTER) ??
    STARTER_OPTIONS[0]
  const starter: OwnedAircraft = {
    id: uid('ac'),
    specId: option.specId,
    registration: randomRegistration(),
    hoursFlown: 0,
    condition: 100,
    locationIcao: home,
  }
  const g: GameState = {
    version: SAVE_VERSION,
    companyName: companyName.trim() || 'Outback Air Rescue',
    regionId,
    homeBaseIcao: home,
    pilotLocationIcao: home,
    balance: 0,
    reputation: 50,
    day: 1,
    fuel: { ...region.startingFuel },
    fleet: [starter],
    availableMissions: generateMissions(MISSION_BOARD_TARGET, 1, 50, [getSpec(starter.specId)], regionId),
    acceptedMissions: [],
    ledger: [],
    stats: { missionsCompleted: 0, missionsFailed: 0, hoursFlown: 0, totalEarned: 0 },
  }
  post(
    g,
    'OPENING',
    option.startingBalance >= 0 ? 'Opening capital' : 'Startup loan',
    option.startingBalance
  )
  return g
}

function makeOperator(name: string, regionId: string): OperatorProfile {
  return { name: name.trim() || 'Outback Air Rescue', xp: 0, startRegionId: regionId }
}

export interface FlyReport {
  missionId: string
  aircraftId: string
  blockMinutes: number
  fuelLitres: number
  landings: number
}

export interface FlyOutcome {
  ok: boolean
  message: string
  reward?: number
  fuel?: number
  maintenance?: number
  net?: number
  onTime?: boolean
}

interface Store {
  game: GameState | null
  operator: OperatorProfile | null
  // lifecycle
  newGame: (companyName: string, startSpecId: string, regionId?: string) => void
  resetGame: () => void
  // missions
  acceptMission: (missionId: string) => void
  abandonMission: (missionId: string) => void
  flyMission: (report: FlyReport) => FlyOutcome
  repositionAircraft: (aircraftId: string, toIcao: string, blockMinutes: number, fuelLitres: number) => FlyOutcome
  // fleet
  buyAircraft: (specId: string, baseIcao: string) => { ok: boolean; message: string }
  sellAircraft: (aircraftId: string) => void
  repairAircraft: (aircraftId: string) => void
  // time
  advanceDay: () => void
}

/** Push a ledger entry and return the resulting balance. */
function post(
  g: GameState,
  category: LedgerCategory,
  description: string,
  amount: number
): void {
  const balanceAfter = Math.round((g.balance + amount) * 100) / 100
  g.balance = balanceAfter
  g.ledger.unshift({
    id: uid('l'),
    day: g.day,
    category,
    description,
    amount,
    balanceAfter,
  })
  if (amount > 0 && category !== 'OPENING') g.stats.totalEarned += amount
}

export const useGame = create<Store>()(
  persist(
    (set, get) => ({
      game: null,
      operator: null,

      newGame: (companyName, startSpecId, regionId = DEFAULT_REGION) =>
        set({
          game: makeInitialState(companyName, startSpecId, regionId),
          operator: makeOperator(companyName, regionId),
        }),

      resetGame: () => set({ game: null, operator: null }),

      acceptMission: (missionId) =>
        set((s) => {
          if (!s.game) return s
          const g = structuredClone(s.game)
          const idx = g.availableMissions.findIndex((m) => m.id === missionId)
          if (idx === -1) return s
          const [m] = g.availableMissions.splice(idx, 1)
          g.acceptedMissions.push(m)
          return { game: g }
        }),

      abandonMission: (missionId) =>
        set((s) => {
          if (!s.game) return s
          const g = structuredClone(s.game)
          const idx = g.acceptedMissions.findIndex((m) => m.id === missionId)
          if (idx === -1) return s
          const [m] = g.acceptedMissions.splice(idx, 1)
          post(g, 'PENALTY', `Abandoned "${m.title}"`, -m.penalty)
          g.reputation = clamp(g.reputation - 3, 0, 100)
          g.stats.missionsFailed += 1
          return { game: g }
        }),

      flyMission: (report) => {
        const s = get()
        if (!s.game) return { ok: false, message: 'No active game.' }
        const g = structuredClone(s.game)

        const mission = g.acceptedMissions.find((m) => m.id === report.missionId)
        if (!mission) return { ok: false, message: 'Mission not found.' }
        const ac = g.fleet.find((a) => a.id === report.aircraftId)
        if (!ac) return { ok: false, message: 'Aircraft not found.' }
        const spec = getSpec(ac.specId)

        if (ac.locationIcao !== mission.fromIcao)
          return { ok: false, message: `${ac.registration} is at ${ac.locationIcao}, not ${mission.fromIcao}. Reposition it first.` }
        if (spec.seats < mission.seatsRequired)
          return { ok: false, message: `${spec.name} seats ${spec.seats}; mission needs ${mission.seatsRequired}.` }
        if (spec.rangeNm < mission.distanceNm)
          return { ok: false, message: `${spec.name} range ${spec.rangeNm} nm is short of ${mission.distanceNm} nm.` }
        if (report.landings < 1) return { ok: false, message: 'A completed flight needs at least one landing.' }
        if (report.blockMinutes <= 0 || report.fuelLitres < 0)
          return { ok: false, message: 'Enter a valid block time and fuel figure.' }

        const price = g.fuel[spec.fuelType]
        const fuel = fuelCost(report.fuelLitres, price)
        const maint = maintenanceCost(report.blockMinutes, spec.maintPerHour)
        const onTime = g.day <= mission.expiresDay

        // Income and expenses.
        post(g, 'MISSION', `${mission.title}`, mission.reward)
        post(g, 'FUEL', `Fuel — ${ac.registration} (${report.fuelLitres} L ${spec.fuelType})`, -fuel)
        post(g, 'MAINTENANCE', `Maintenance — ${ac.registration}`, -maint)

        // Aircraft wear + relocation.
        ac.hoursFlown = +(ac.hoursFlown + report.blockMinutes / 60).toFixed(2)
        ac.condition = clamp(+(ac.condition - conditionLoss(report.blockMinutes)).toFixed(2), 0, 100)
        ac.locationIcao = mission.toIcao
        g.pilotLocationIcao = mission.toIcao

        // Reputation + stats.
        if (onTime) g.reputation = clamp(g.reputation + mission.reputationReward, 0, 100)
        else {
          post(g, 'PENALTY', `Late completion — ${mission.title}`, -mission.penalty)
          g.reputation = clamp(g.reputation - 2, 0, 100)
        }
        g.stats.missionsCompleted += 1
        g.stats.hoursFlown = +(g.stats.hoursFlown + report.blockMinutes / 60).toFixed(2)

        // Career experience accrues to the operator (persists across regions).
        const xp = xpForMission(mission)
        const operator = s.operator ? { ...s.operator, xp: s.operator.xp + xp } : s.operator

        // Remove from accepted.
        g.acceptedMissions = g.acceptedMissions.filter((m) => m.id !== mission.id)

        set({ game: g, operator })
        const net = mission.reward - fuel - maint - (onTime ? 0 : mission.penalty)
        return {
          ok: true,
          onTime,
          reward: mission.reward,
          fuel,
          maintenance: maint,
          net,
          message: onTime
            ? `Mission complete. Net ${net >= 0 ? '+' : ''}$${net.toLocaleString()}. +${xp} XP.`
            : `Completed late — reputation and a penalty applied. Net ${net >= 0 ? '+' : ''}$${net.toLocaleString()}. +${xp} XP.`,
        }
      },

      repositionAircraft: (aircraftId, toIcao, blockMinutes, fuelLitres) => {
        const s = get()
        if (!s.game) return { ok: false, message: 'No active game.' }
        const g = structuredClone(s.game)
        const ac = g.fleet.find((a) => a.id === aircraftId)
        if (!ac) return { ok: false, message: 'Aircraft not found.' }
        if (ac.locationIcao === toIcao) return { ok: false, message: 'Aircraft is already there.' }
        if (blockMinutes <= 0 || fuelLitres < 0) return { ok: false, message: 'Enter a valid block time and fuel figure.' }
        const spec = getSpec(ac.specId)
        const price = g.fuel[spec.fuelType]
        const fuel = fuelCost(fuelLitres, price)
        const maint = maintenanceCost(blockMinutes, spec.maintPerHour)

        post(g, 'FUEL', `Ferry fuel — ${ac.registration} → ${toIcao}`, -fuel)
        post(g, 'MAINTENANCE', `Maintenance — ${ac.registration}`, -maint)
        ac.hoursFlown = +(ac.hoursFlown + blockMinutes / 60).toFixed(2)
        ac.condition = clamp(+(ac.condition - conditionLoss(blockMinutes)).toFixed(2), 0, 100)
        ac.locationIcao = toIcao
        g.pilotLocationIcao = toIcao
        g.stats.hoursFlown = +(g.stats.hoursFlown + blockMinutes / 60).toFixed(2)

        set({ game: g })
        return { ok: true, message: `Repositioned ${ac.registration} to ${toIcao}. Cost $${(fuel + maint).toLocaleString()}.` }
      },

      buyAircraft: (specId, baseIcao) => {
        const s = get()
        if (!s.game) return { ok: false, message: 'No active game.' }
        const spec = getSpec(specId)
        if (s.game.balance < spec.purchaseCost)
          return { ok: false, message: `Not enough funds. Need $${spec.purchaseCost.toLocaleString()}.` }
        const g = structuredClone(s.game)
        const ac: OwnedAircraft = {
          id: uid('ac'),
          specId,
          registration: randomRegistration(),
          hoursFlown: 0,
          condition: 100,
          locationIcao: baseIcao,
        }
        g.fleet.push(ac)
        post(g, 'AIRCRAFT_PURCHASE', `Bought ${spec.name} (${ac.registration})`, -spec.purchaseCost)
        set({ game: g })
        return { ok: true, message: `${spec.name} ${ac.registration} added to your fleet at ${baseIcao}.` }
      },

      sellAircraft: (aircraftId) =>
        set((s) => {
          if (!s.game) return s
          const g = structuredClone(s.game)
          const ac = g.fleet.find((a) => a.id === aircraftId)
          if (!ac) return s
          const spec = getSpec(ac.specId)
          // Resale scales with condition; used aircraft take a haircut.
          const resale = Math.round(spec.purchaseCost * 0.7 * (ac.condition / 100))
          g.fleet = g.fleet.filter((a) => a.id !== aircraftId)
          post(g, 'AIRCRAFT_SALE', `Sold ${spec.name} (${ac.registration})`, resale)
          return { game: g }
        }),

      repairAircraft: (aircraftId) =>
        set((s) => {
          if (!s.game) return s
          const g = structuredClone(s.game)
          const ac = g.fleet.find((a) => a.id === aircraftId)
          if (!ac || ac.condition >= 100) return s
          const spec = getSpec(ac.specId)
          const missing = 100 - ac.condition
          const cost = Math.round((spec.purchaseCost * 0.0009) * missing)
          if (g.balance < cost) return s
          post(g, 'REPAIR', `Repaired ${ac.registration} (+${missing.toFixed(0)}%)`, -cost)
          ac.condition = 100
          return { game: g }
        }),

      advanceDay: () =>
        set((s) => {
          if (!s.game) return s
          const g = structuredClone(s.game)
          g.day += 1

          // Daily fixed costs across the fleet.
          const daily = g.fleet.reduce((sum, a) => sum + getSpec(a.specId).dailyFixedCost, 0)
          if (daily > 0) post(g, 'DAILY_COST', `Hangar & insurance (${g.fleet.length} aircraft)`, -daily)

          // Expire accepted missions that are now past deadline (failures).
          const stillValid: Mission[] = []
          for (const m of g.acceptedMissions) {
            if (g.day > m.expiresDay) {
              post(g, 'PENALTY', `Missed deadline — ${m.title}`, -m.penalty)
              g.reputation = clamp(g.reputation - 4, 0, 100)
              g.stats.missionsFailed += 1
            } else {
              stillValid.push(m)
            }
          }
          g.acceptedMissions = stillValid

          // Expire stale board postings.
          g.availableMissions = g.availableMissions.filter((m) => g.day <= m.expiresDay)

          // Fuel price drift ±8%.
          const drift = (p: number) => +Math.max(1.2, p * (0.92 + Math.random() * 0.16)).toFixed(2)
          g.fuel = { AVGAS: drift(g.fuel.AVGAS), JETA: drift(g.fuel.JETA) }

          // Refill the board.
          const need = MISSION_BOARD_TARGET - g.availableMissions.length
          if (need > 0) {
            const fleetSpecs = g.fleet.map((a) => getSpec(a.specId))
            g.availableMissions.push(...generateMissions(need, g.day, g.reputation, fleetSpecs, g.regionId))
          }

          return { game: g }
        }),
    }),
    {
      name: 'outback-flying-save',
      version: SAVE_VERSION,
      // IndexedDB-backed (falls back to localStorage); see idbStorage.ts.
      storage: createJSONStorage(() => persistentStorage),
      partialize: (s) => ({ game: s.game, operator: s.operator }),
      migrate: (persisted, version) => migratePersistedState(persisted, version),
    }
  )
)

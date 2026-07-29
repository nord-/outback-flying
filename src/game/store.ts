import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { persistentStorage } from './idbStorage'
import { saveFlightLog } from './flightLogStorage'
import { computeDutyMinutes, scrubFlightLog } from './flightlog'
import { penaltyFactor, isOverAnyLimit } from './duty'
import type {
  GameState,
  LedgerCategory,
  Mission,
  OperatorProfile,
  OwnedAircraft,
  FlightLog,
  FlightLogSummary,
  DutyEntry,
  GeoPos,
  TrackPoint,
  FlightLeg,
  OpenChain,
  ArmedMission,
} from './types'
import { getSpec, STARTER_OPTIONS, DEFAULT_STARTER } from '../data/aircraft'
import { getRegion, tryGetRegion, DEFAULT_REGION } from '../data/regions'
import { airportOffersFuel, getAirport } from '../data/airports'
import { generateMissions } from './missions'
import { xpForMission } from './progression'
import {
  conditionLoss,
  maintenanceCost,
  refuelCost,
} from './economy'
import { landingWear } from './fields'
import { planLoad, missionPayload, payoutRatio, UNDERLOAD_REP_PENALTY } from './payload'

const SAVE_VERSION = 12 // v7 = fuel tanks; v8 = always-on sim tracking (#20); v9 = per-aircraft armed missions (#22 review); v10 = time-critical missions (#11); v11 = Null Island scrub (#28) + configurable board size (#30); v12 = cargo weights (#33)
const SAVE_KEY = 'outback-flying-save'
// Board size is the player's call (#30) — a bigger board means more choice and
// less ferrying, at the cost of a busier screen.
export const MISSION_BOARD_STEPS = [5, 10, 15, 20] as const
export const DEFAULT_MISSION_BOARD_TARGET = 10
/**
 * Snap an arbitrary number to the nearest allowed board size, so neither a
 * hand-edited save nor a future UI control can wedge the board at an
 * unintended size (a persisted 5000 would have advanceDay generate 5000
 * missions). Shared by the setter and the migration — one rule, one place.
 */
function snapBoardTarget(target: number): number {
  return MISSION_BOARD_STEPS.reduce((best, step) =>
    Math.abs(step - target) < Math.abs(best - target) ? step : best
  )
}
const TIME_CRITICAL_FAIL_REP = -7 // reputation hit when a time-critical delivery misses its window (#11)
// Turning down a call-out costs a little standing. The clamp floors reputation
// at 0, so a rookie (who starts there, #23) dismisses for free — deliberate:
// the cost is meant to make an ESTABLISHED operator think twice, and refilling
// only at advanceDay already prevents rerolling the board.
const DISMISS_REP = 1
// A new operator is an unknown rookie: no reputation to trade on, and none to
// lose either — every rep change is clamped to 0..100, so early mistakes are
// free (#23).
const STARTING_REPUTATION = 0

// Hydration failure signal. persist's onFinishHydration never fires when
// rehydration throws (corrupt stored JSON, a hostile persisted shape), so the
// UI needs a separate signal — otherwise it would wait on the boot screen
// forever. Pure TS on purpose: React subscribes via useHydrated().
let hydrationError: unknown = null
const hydrationErrorListeners = new Set<(err: unknown) => void>()

export function getHydrationError(): unknown {
  return hydrationError
}

export function onHydrationError(cb: (err: unknown) => void): () => void {
  hydrationErrorListeners.add(cb)
  return () => hydrationErrorListeners.delete(cb)
}

/** Erase the persisted save entirely (boot-error recovery). */
export async function eraseSave(): Promise<void> {
  await persistentStorage.removeItem(SAVE_KEY)
}

let idSeq = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(idSeq++).toString(36)}`

/** Region-flavoured tail number, built from the region's registrationTemplate
 *  ('L' = random letter, 'D' = random digit, other chars pass through). */
function randomRegistration(regionId: string): string {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const template = getRegion(regionId).registrationTemplate
  return template.replace(/[LD]/g, (ch) =>
    ch === 'L' ? L[Math.floor(Math.random() * L.length)] : String(Math.floor(Math.random() * 10))
  )
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
 *  - v4: add the region id and synthesise an operator profile
 *  - v5: default the flightLogs list
 *  - v6: seed the duty log from flight logs
 *  - v7: seed a full fuel tank for aircraft that don't have one
 *  - v8: default the armed-mission list
 *  - v9: armed missions gain an owning aircraftId; a legacy plain-string
 *    list can't attribute one, so it's dropped (missions simply re-arm next
 *    time their aircraft passes the departure field)
 *  - v10: time-critical missions, no migration needed
 *  - v11: drop impossible legs left by a sim unloading its aircraft (#28).
 *    Parked positions are deliberately untouched: `commitLeg` only writes
 *    `locationIcao` on an on-block at a catalogued field, so after a running
 *    stop it names an earlier field — "recovering" an off-field position from
 *    it would teleport the aircraft. A stuck save recovers in-game instead,
 *    via repositionAircraft, which accepts an off-field origin.
 *  - v12: missions gain cargoKg. A pre-cargo posting keeps its seat count and
 *    so acquires a PAX-only requirement — the honest reading of a mission that
 *    always carried people. Armed records have no loadedKg and therefore settle
 *    at full reward: they were armed under the old rules and are not punished
 *    retroactively. */
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
  // synthesise an operator profile so the persistent career exists. Hydration
  // is potentially hostile (corrupt/hand-edited saves), so an unknown region
  // id is normalized rather than trusted — otherwise getRegion(g.regionId)
  // throws later in App.tsx.
  if (!g.regionId || !tryGetRegion(g.regionId)) g.regionId = DEFAULT_REGION
  if (!state.operator) {
    state.operator = { name: g.companyName, xp: 0, startRegionId: g.regionId }
  } else if (!state.operator.startRegionId || !tryGetRegion(state.operator.startRegionId)) {
    state.operator.startRegionId = g.regionId
  }

  // SimConnect flight logs (v5).
  if (!g.flightLogs) g.flightLogs = []

  // Duty log (v6): seed from recorded flight logs so an in-progress save keeps
  // its history. A flight log with no missionId is a SimConnect free flight.
  // Single idempotent guard — never re-seeds an existing dutyLog.
  if (!g.dutyLog) {
    g.dutyLog = (g.flightLogs ?? []).map(
      (fl): DutyEntry => ({
        id: uid('duty'),
        day: fl.day,
        minutes: fl.dutyMinutes,
        kind: fl.missionId ? ('MISSION' as const) : ('FREE' as const),
        missionId: fl.missionId,
      })
    )
  }

  // Fuel as a resource (v7): any aircraft without a tank starts full. The
  // undefined check keeps this idempotent and covers both v5 and v6 saves.
  for (const ac of g.fleet ?? []) {
    if (ac.fuelL === undefined) ac.fuelL = getSpec(ac.specId).fuelCapacityL
  }

  // Always-on sim tracking (v8) + per-aircraft armed missions (v9): the v8
  // shape was a flat string[] with no aircraft attribution. There's no way to
  // recover which aircraft armed each entry, so a legacy list is dropped
  // rather than guessed — armInto re-arms correctly next time that aircraft
  // is at the departure field. Off-field positions and the open chain are
  // optional and correctly absent in older saves.
  const legacyArmed = (g as unknown as { armedMissionIds?: unknown[] }).armedMissionIds
  if (!g.armedMissions) {
    g.armedMissions =
      Array.isArray(legacyArmed) && legacyArmed.every((e) => typeof e === 'object' && e !== null)
        ? (legacyArmed as ArmedMission[])
        : []
  }
  delete (g as unknown as { armedMissionIds?: unknown[] }).armedMissionIds

  // Null Island (v11, #28): a leg closed at 0,0 when the sim unloaded its
  // aircraft. Drop those legs and re-derive the totals; an entry with nothing
  // left goes. Idempotent — a scrubbed log has no impossible legs to find.
  // Both Array.isArray guards are about hostile input, not save history: a
  // hand-edited or corrupt save whose `flightLogs` or a `legs` entry is not
  // an array would throw inside .map/scrubFlightLog and brick hydration
  // outright — no released save actually lacks either field.
  g.flightLogs = (Array.isArray(g.flightLogs) ? g.flightLogs : [])
    .map((fl) => (Array.isArray(fl.legs) ? scrubFlightLog(fl) : fl))
    .filter((fl): fl is FlightLogSummary => fl !== null)

  // Configurable board size (v11, #30). Older saves refilled to a fixed 7 and
  // carry no field at all. A value that *is* present is still not trusted: a
  // hand-edited 5000 would have advanceDay generate 5000 missions, so snap it
  // to a legal step the same way the setter does.
  g.missionBoardTarget = g.missionBoardTarget
    ? snapBoardTarget(g.missionBoardTarget)
    : DEFAULT_MISSION_BOARD_TARGET

  // Cargo weights (v12, #33). A missing figure is an old posting; a non-finite
  // or negative one is a corrupt or hand-edited save. All of them read as "no
  // freight", which missionPayload then reduces to a PAX-only requirement.
  // The Array.isArray guards are about hostile input, not save history — same
  // reasoning as the v11 step above: a mission list that is not an array, or
  // that holds a null entry, would throw here and brick hydration outright,
  // and no released save has either shape. A corrupt board is recoverable in
  // game (advanceDay refills it); an unopenable save is not.
  const scrubCargo = (list: unknown): Mission[] =>
    (Array.isArray(list) ? list : []).filter((m): m is Mission => !!m && typeof m === 'object')
  g.availableMissions = scrubCargo(g.availableMissions)
  g.acceptedMissions = scrubCargo(g.acceptedMissions)
  for (const m of [...g.availableMissions, ...g.acceptedMissions]) {
    if (!Number.isFinite(m.cargoKg) || m.cargoKg < 0) m.cargoKg = 0
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
    registration: randomRegistration(regionId),
    hoursFlown: 0,
    condition: 100,
    locationIcao: home,
    fuelL: getSpec(option.specId).fuelCapacityL,
  }
  const g: GameState = {
    version: SAVE_VERSION,
    companyName: companyName.trim() || 'Outback Air Rescue',
    regionId,
    homeBaseIcao: home,
    pilotLocationIcao: home,
    balance: 0,
    reputation: STARTING_REPUTATION,
    day: 1,
    missionBoardTarget: DEFAULT_MISSION_BOARD_TARGET,
    fuel: { ...region.startingFuel },
    fleet: [starter],
    availableMissions: generateMissions(
      DEFAULT_MISSION_BOARD_TARGET,
      1,
      STARTING_REPUTATION,
      [getSpec(starter.specId)],
      regionId,
      getAirport(home)
    ),
    acceptedMissions: [],
    ledger: [],
    flightLogs: [],
    dutyLog: [],
    armedMissions: [],
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
  maintenance?: number
  net?: number
  onTime?: boolean
  dutyFactor?: number // 1 = no duty penalty, 0.5 = half reward, 0 = none
}

// A per-leg commit from the always-on sim session (issue #20). `pos` is a
// catalogued field when the sim shut down within tolerance of an airport,
// otherwise a raw coordinate — the aircraft parked off-field (D9).
export interface CommitLegInput {
  aircraftId: string
  atT?: number // sim sample time (epoch ms) of this on-block — for time-critical settlement (#11)
  leg: FlightLeg
  simFuelL: number
  pos: { icao: string } | GeoPos
  externalFuelL: number
  landings: number
  track: TrackPoint[]
  simTitle: string
  simAtcModel: string
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
  dismissMission: (missionId: string) => void
  setMissionBoardTarget: (target: number) => void
  flyMission: (report: FlyReport) => FlyOutcome
  repositionAircraft: (aircraftId: string, toIcao: string, blockMinutes: number, fuelLitres: number) => FlyOutcome
  // fleet
  buyAircraft: (specId: string, baseIcao: string) => { ok: boolean; message: string }
  sellAircraft: (aircraftId: string) => void
  repairAircraft: (aircraftId: string) => void
  refuel: (aircraftId: string, litres: number, maxCapacityL?: number) => { ok: boolean; message: string; cost?: number }
  // time
  advanceDay: () => void
  // sim session (#20)
  beginChain: (aircraftId: string, simTitle: string, simAtcModel: string) => void
  commitLeg: (input: CommitLegInput) => { messages: string[] }
  stopAt: (aircraftId: string, icao: string, opts?: StopOptions) => { messages: string[] }
  armMissions: (aircraftId: string, icao: string, opts?: ArmOptions) => { messages: string[] }
  lockArmedLoad: (aircraftId: string, loadedKg: number | null) => void
  finalizeChain: () => void
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

/** Log a flight's duty and, when it breaches a limit, withhold reward via a
 *  PENALTY line. `dutyMinutes` must be this flight's duty; the factor is read
 *  BEFORE the entry is appended, so the "already over" case works. Returns the
 *  reward factor and the withheld dollars so callers can fold them into `net`. */
function applyDuty(
  g: GameState,
  dutyMinutes: number,
  kind: DutyEntry['kind'],
  missionId: string | undefined,
  reward: number
): { factor: number; withheld: number } {
  const factor = penaltyFactor(g.dutyLog, g.day, dutyMinutes)
  g.dutyLog.push({ id: uid('duty'), day: g.day, minutes: dutyMinutes, kind, missionId })
  const withheld = reward > 0 && factor < 1 ? Math.round(reward * (1 - factor)) : 0
  if (withheld > 0) {
    post(g, 'PENALTY', `Duty-time violation — ${factor === 0 ? '100%' : '50%'} reward withheld`, -withheld)
    // The reward line already added the full amount to totalEarned via post().
    // A duty violation *withholds* reward (unlike a late-completion fine), so
    // back the withheld portion out — totalEarned means reward actually kept.
    g.stats.totalEarned -= withheld
  }
  return { factor, withheld }
}

export interface ArmOptions {
  atT?: number
  loadedKg?: number | null
}

/** `stopAt`/`commitLeg` no longer arm anything (R2, #33 review — arming is
 *  engine-start-only), so their shared settlement path only ever needs the
 *  stop time for time-critical judging. A narrower type than `ArmOptions`
 *  keeps that honest instead of carrying a `loadedKg` neither call site uses. */
interface StopOptions {
  atT?: number
}

/** Arm every accepted mission departing `icao` that the aircraft can seat and
 *  the load can carry (D8, #33). Armed missions are tagged with `aircraftId` so
 *  settlement only pays out to the aircraft that actually carried the mission
 *  (#22 review), and with the measured load so a short delivery can be priced.
 *  This is now the ONLY place a mission arms (R2, #33 review) — `settleStop`
 *  used to arm too, at block-on and at a running full stop, which let cargo
 *  already aboard be measured twice: once here, and once more at the next
 *  engine start with a candidate list that had quietly dropped the mission
 *  this function already armed. */
function armInto(g: GameState, aircraftId: string, icao: string, opts: ArmOptions = {}): string[] {
  const ac = g.fleet.find((a) => a.id === aircraftId)
  if (!ac) return []
  const spec = getSpec(ac.specId)
  const { atT, loadedKg = null } = opts
  const messages: string[] = []

  // R3 (#33 review): cargo this aircraft already has armed is physically in
  // the cabin and can't be unloaded to make room — it eats into the budget
  // regardless of which route it's bound for. Summed here (not read off a
  // stored total) so it always reflects the current armedMissions list.
  const committedKg = g.armedMissions
    .filter((r) => r.aircraftId === aircraftId)
    .reduce((sum, r) => {
      const armed = g.acceptedMissions.find((m) => m.id === r.missionId)
      return armed ? sum + missionPayload(armed).totalKg : sum
    }, 0)

  // Seats and duplicates first — those are properties of the mission and the
  // aeroplane. What is left competes for the kilograms actually aboard.
  const candidates: Mission[] = []
  for (const m of g.acceptedMissions) {
    if (m.fromIcao !== icao || g.armedMissions.some((r) => r.missionId === m.id)) continue
    if (spec.seats < m.seatsRequired) {
      messages.push(`"${m.title}" needs ${m.seatsRequired} seats — ${spec.name} has ${spec.seats}. Not underway.`)
      continue
    }
    candidates.push(m)
  }

  for (const entry of planLoad(candidates, loadedKg, committedKg)) {
    const m = entry.mission
    if (!entry.arms) {
      // planLoad only ever refuses a candidate when the load WAS measured
      // (a null load arms everything), so loadedKg is a number here — the
      // `?? 0` this used to carry could never actually fire.
      const aboardKg = loadedKg as number
      // Say so plainly when the refusal actually turns on committed cargo
      // rather than the raw reading (R3, #33 review) — otherwise "only 100 kg
      // aboard" reads as a lie the moment 50 of those kg belong to a mission
      // already underway from a different field.
      const aboardPhrase =
        committedKg > 0
          ? `only ${Math.round(Math.max(0, aboardKg - committedKg))} kg free (${Math.round(aboardKg)} kg aboard, ${Math.round(committedKg)} kg already committed)`
          : `only ${Math.round(aboardKg)} kg aboard`
      messages.push(
        `"${m.title}" needs ${Math.round(entry.requiredKg)} kg, and ${Math.round(entry.cumulativeKg)} kg total for ${m.toIcao} — ${aboardPhrase}. Not underway.`
      )
      continue
    }
    // Time-critical (#11): stamp the deadline the moment the mission arms at
    // its origin — the countdown includes the ground time before departure.
    const windowEndsAtT =
      m.windowMinutes != null && atT != null ? atT + m.windowMinutes * 60_000 : undefined
    g.armedMissions.push({
      missionId: m.id,
      aircraftId,
      ...(windowEndsAtT != null ? { windowEndsAtT } : {}),
      ...(loadedKg != null ? { loadedKg } : {}),
    })
    messages.push(
      m.windowMinutes != null
        ? `⏱ Time-critical underway: ${m.title} — ${m.windowMinutes} min to reach ${m.toIcao}.`
        : `Mission underway: ${m.title} (${m.fromIcao} → ${m.toIcao}).`
    )
  }
  return messages
}

/** Complete missions at a full stop or at block-on (D8). Mutates g; returns
 *  updated operator. Only settles missions armed by THIS aircraft — a
 *  different aircraft merely landing at the same destination can't collect a
 *  reward it didn't carry the mission for (#22 review).
 *
 *  Deliberately does NOT arm anything (R2, #33 review — arming used to happen
 *  here too, at a running full stop and at block-on). "Much can happen between
 *  block on and block off" for commitLeg's case, and a running stop offers the
 *  player no chance to load before judging what's aboard — both are wrong in
 *  principle, not merely ungated. Arming now happens ONLY via `armInto`, at
 *  engine start (`armMissions`, called from the OFF_BLOCK effect). */
function settleStop(
  g: GameState,
  operator: OperatorProfile | null,
  aircraftId: string,
  icao: string,
  opts: StopOptions = {}
): { messages: string[]; operator: OperatorProfile | null } {
  const messages: string[] = []
  const done = g.acceptedMissions.filter(
    (m) => g.armedMissions.some((r) => r.missionId === m.id && r.aircraftId === aircraftId) && m.toIcao === icao
  )
  for (const mission of done) {
    // Read the time-critical deadline BEFORE the armed record is removed below.
    const armed = g.armedMissions.find((r) => r.missionId === mission.id && r.aircraftId === aircraftId)
    const isTimeCritical = mission.windowMinutes != null
    // Fail OPEN: if the window can't be judged (no deadline stamped, or no stop
    // time supplied — a plumbing gap, not the player's fault), give the benefit
    // of the doubt rather than hard-fail a delivery that may well have been on time.
    const canJudgeWindow = armed?.windowEndsAtT != null && opts.atT != null
    const madeWindow = !canJudgeWindow || (opts.atT as number) <= (armed!.windowEndsAtT as number)
    const onTime = g.day <= mission.expiresDay

    // Cargo (#33): what the aeroplane actually left with decides how much of
    // the reward the delivery earned. Fails open — an unmeasured load (honour
    // play, or a sim that reports nonsense) pays in full.
    const ratio = payoutRatio(missionPayload(mission).totalKg, armed?.loadedKg ?? null)
    const short = ratio < 1
    const payable = Math.round(mission.reward * ratio)
    // Floor, not round: "paid" must never overstate what actually landed —
    // a shortfall just over PAYLOAD_TOLERANCE_KG on a heavy mission would
    // otherwise round up to a self-contradicting "paid 100%". ratio === 1
    // takes the no-note branch anyway, so 100 is unreachable here.
    const paidPct = Math.floor(ratio * 100)

    // Settle: remove from accepted + armed regardless of outcome.
    g.acceptedMissions = g.acceptedMissions.filter((m) => m.id !== mission.id)
    g.armedMissions = g.armedMissions.filter((r) => r.missionId !== mission.id)

    let net: number
    if (isTimeCritical && (!madeWindow || !onTime)) {
      // Time-critical hard failure (#11): the perishable cargo is lost — no
      // reward, a penalty and a larger reputation hit than an ordinary late job.
      post(g, 'PENALTY', `Failed time-critical — ${mission.title}`, -mission.penalty)
      g.reputation = clamp(g.reputation + TIME_CRITICAL_FAIL_REP, 0, 100)
      g.stats.missionsFailed += 1
      net = -mission.penalty
      messages.push(`⏱ Missed the window — ${mission.title}: cargo lost, penalty applied.`)
    } else {
      post(g, 'MISSION', short ? `${mission.title} (underload — paid ${paidPct}%)` : mission.title, payable)
      net = payable
      // Per-leg duty accounting means the 50%-crossing tier can't be computed at
      // stop time; being over a limit when completing withholds everything (see
      // plan Global Constraints behavioral note).
      if (isOverAnyLimit(g.dutyLog, g.day)) {
        post(g, 'PENALTY', 'Duty-time violation — 100% reward withheld', -payable)
        g.stats.totalEarned -= payable
        net = 0
      }
      const repPenalty = short ? UNDERLOAD_REP_PENALTY : 0
      if (onTime) g.reputation = clamp(g.reputation + mission.reputationReward - repPenalty, 0, 100)
      else {
        post(g, 'PENALTY', `Late completion — ${mission.title}`, -mission.penalty)
        g.reputation = clamp(g.reputation - 2 - repPenalty, 0, 100)
        net -= mission.penalty
      }
      g.stats.missionsCompleted += 1
      const xp = xpForMission(mission) // deliberately NOT scaled: the leg was flown
      if (operator) operator = { ...operator, xp: operator.xp + xp }
      const shortNote = short ? ` (underload — paid ${paidPct}%)` : ''
      messages.push(
        onTime
          ? `Mission complete: ${mission.title}. +$${payable.toLocaleString()}${shortNote}, +${xp} XP.`
          : `Completed late: ${mission.title}${shortNote} — penalty applied.`
      )
    }
    if (g.openChain) {
      g.openChain.earnings += net
      g.openChain.missionIds.push(mission.id)
    }
  }
  return { messages, operator }
}

/** Close the open chain into a FlightLog + summary. Mutates g. */
function finalizeChainInto(g: GameState): void {
  // Time-critical (#11): a chain ending (disconnect, day rollover, aircraft
  // swap) reverts any armed time-critical missions to plain accepted, so an
  // interrupted or crashed session degrades to "not yet flown" rather than
  // burning a persisted wall-clock deadline the player can't recover from —
  // they re-arm fresh next time the aircraft parks at the origin.
  g.armedMissions = g.armedMissions.filter((r) => r.windowEndsAtT == null)
  const chain = g.openChain
  if (!chain || chain.legs.length === 0) {
    delete g.openChain
    return
  }
  const sum = (f: (l: FlightLeg) => number) => +chain.legs.reduce((t, l) => t + f(l), 0).toFixed(2)
  const intermediates = chain.legs
    .slice(0, -1)
    .map((l) => l.toIcao)
    .filter((i): i is string => i !== null)
  const summary: FlightLogSummary = {
    id: uid('fl'),
    day: chain.startDay,
    missionId: chain.missionIds[0],
    missionIds: chain.missionIds,
    aircraftId: chain.aircraftId,
    legs: chain.legs,
    startIcao: chain.legs[0].fromIcao,
    endIcao: chain.legs[chain.legs.length - 1].toIcao,
    intermediates,
    blockMinutes: sum((l) => l.blockMinutes),
    flightMinutes: sum((l) => l.flightMinutes),
    dutyMinutes: chain.dutyMinutes,
    distanceNm: sum((l) => l.distanceNm),
    fuelUsedL: sum((l) => l.fuelUsedL),
    landings: chain.landings,
    earnings: chain.earnings,
  }
  g.flightLogs.unshift(summary)
  const full: FlightLog = {
    ...summary,
    simAircraftTitle: chain.simAircraftTitle,
    simAtcModel: chain.simAtcModel,
    track: chain.track,
  }
  saveFlightLog(full).catch((err) => console.warn('[flightlog] could not persist track', err))
  delete g.openChain
}

/** Ensure a chain is open for `aircraftId` (D14 fix): finalizes a different
 *  aircraft's open chain first, creates a fresh one if none is open, and
 *  backfills empty title fields on an already-open chain for this aircraft
 *  (covers stopAt's identity-less defensive open). Mutates g. Idempotent. */
function ensureOpenChain(g: GameState, aircraftId: string, simTitle: string, simAtcModel: string): void {
  if (g.openChain && g.openChain.aircraftId !== aircraftId) finalizeChainInto(g)
  if (!g.openChain) {
    const chain: OpenChain = {
      aircraftId,
      startDay: g.day,
      simAircraftTitle: simTitle,
      simAtcModel: simAtcModel,
      legs: [],
      landings: 0,
      dutyMinutes: 0,
      earnings: 0,
      missionIds: [],
      track: [],
    }
    g.openChain = chain
    return
  }
  // Already open for this aircraft — backfill an empty title left by a
  // defensive stopAt-side open (stopAt has no sim identity to seed it with).
  if (!g.openChain.simAircraftTitle && simTitle) g.openChain.simAircraftTitle = simTitle
  if (!g.openChain.simAtcModel && simAtcModel) g.openChain.simAtcModel = simAtcModel
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
          g.armedMissions = g.armedMissions.filter((r) => r.missionId !== missionId)
          return { game: g }
        }),

      dismissMission: (missionId) =>
        set((s) => {
          if (!s.game) return s
          const g = structuredClone(s.game)
          const idx = g.availableMissions.findIndex((m) => m.id === missionId)
          if (idx === -1) return s // accepted missions go through abandonMission
          g.availableMissions.splice(idx, 1)
          g.reputation = clamp(g.reputation - DISMISS_REP, 0, 100)
          return { game: g }
        }),

      setMissionBoardTarget: (target) =>
        set((s) => {
          if (!s.game) return s
          const snapped = snapBoardTarget(target)
          if (snapped === s.game.missionBoardTarget) return s
          const g = structuredClone(s.game)
          g.missionBoardTarget = snapped
          return { game: g }
        }),

      flyMission: (report) => {
        const s = get()
        if (!s.game) return { ok: false, message: 'No active game.' }
        const g = structuredClone(s.game)

        const mission = g.acceptedMissions.find((m) => m.id === report.missionId)
        if (!mission) return { ok: false, message: 'Mission not found.' }
        // Time-critical missions (#11) are settled live by the always-on sim
        // session against their countdown — the honour path can't judge the
        // window, so it must not complete them.
        if (mission.windowMinutes != null)
          return { ok: false, message: 'Time-critical missions book themselves via SimConnect — fly it in the simulator.' }
        const ac = g.fleet.find((a) => a.id === report.aircraftId)
        if (!ac) return { ok: false, message: 'Aircraft not found.' }
        if (ac.offField)
          return { ok: false, message: `${ac.registration} is parked off-field — recover it in the sim or ferry it out first.` }
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

        const maint = maintenanceCost(report.blockMinutes, spec.maintPerHour)
        const onTime = g.day <= mission.expiresDay
        const dry = report.fuelLitres > ac.fuelL

        // Income and expenses (fuel is pre-paid at refuel — not charged here).
        post(g, 'MISSION', `${mission.title}`, mission.reward)
        post(g, 'MAINTENANCE', `Maintenance — ${ac.registration}`, -maint)

        // Aircraft wear, fuel draw-down and relocation.
        ac.hoursFlown = +(ac.hoursFlown + report.blockMinutes / 60).toFixed(2)
        const arrivalWear = landingWear(getAirport(mission.toIcao), spec)
        ac.condition = clamp(
          +(ac.condition - conditionLoss(report.blockMinutes) - arrivalWear).toFixed(2),
          0,
          100
        )
        ac.fuelL = Math.max(0, +(ac.fuelL - report.fuelLitres).toFixed(2))
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

        const dutyMinutes = computeDutyMinutes(report.blockMinutes, report.landings)
        const { factor: dutyFactor, withheld } = applyDuty(g, dutyMinutes, 'MISSION', mission.id, mission.reward)

        set({ game: g, operator })
        const net = mission.reward - withheld - maint - (onTime ? 0 : mission.penalty)
        const dryNote = dry ? ' Tank ran dry — a fuel stop was needed.' : ''
        const wearNote =
          arrivalWear > 0
            ? ` Rough field at ${mission.toIcao} — extra wear ${arrivalWear.toFixed(2)}%.`
            : ''
        return {
          ok: true,
          onTime,
          reward: mission.reward,
          maintenance: maint,
          net,
          dutyFactor,
          message:
            (onTime
              ? `Mission complete. Net ${net >= 0 ? '+' : ''}$${net.toLocaleString()}. +${xp} XP.`
              : `Completed late — reputation and a penalty applied. Net ${net >= 0 ? '+' : ''}$${net.toLocaleString()}. +${xp} XP.`) +
            (withheld > 0 ? ` ⚠ Duty-time violation: ${dutyFactor === 0 ? '100%' : '50%'} of the reward withheld.` : '') +
            dryNote +
            wearNote,
        }
      },

      repositionAircraft: (aircraftId, toIcao, blockMinutes, fuelLitres) => {
        const s = get()
        if (!s.game) return { ok: false, message: 'No active game.' }
        const g = structuredClone(s.game)
        const ac = g.fleet.find((a) => a.id === aircraftId)
        if (!ac) return { ok: false, message: 'Aircraft not found.' }
        if (ac.locationIcao === toIcao && !ac.offField) return { ok: false, message: 'Aircraft is already there.' }
        if (blockMinutes <= 0 || fuelLitres < 0) return { ok: false, message: 'Enter a valid block time and fuel figure.' }
        const spec = getSpec(ac.specId)
        const maint = maintenanceCost(blockMinutes, spec.maintPerHour)
        const dry = fuelLitres > ac.fuelL

        post(g, 'MAINTENANCE', `Maintenance — ${ac.registration}`, -maint)
        ac.hoursFlown = +(ac.hoursFlown + blockMinutes / 60).toFixed(2)
        const arrivalWear = landingWear(getAirport(toIcao), spec)
        ac.condition = clamp(
          +(ac.condition - conditionLoss(blockMinutes) - arrivalWear).toFixed(2),
          0,
          100
        )
        ac.fuelL = Math.max(0, +(ac.fuelL - fuelLitres).toFixed(2))
        ac.locationIcao = toIcao
        delete ac.offField
        g.pilotLocationIcao = toIcao
        delete g.pilotOffField
        g.stats.hoursFlown = +(g.stats.hoursFlown + blockMinutes / 60).toFixed(2)

        applyDuty(g, computeDutyMinutes(blockMinutes, 1), 'FERRY', undefined, 0)

        set({ game: g })
        return {
          ok: true,
          message:
            `Repositioned ${ac.registration} to ${toIcao}. Cost $${maint.toLocaleString()}.` +
            (dry ? ' Tank ran dry — a fuel stop was needed.' : '') +
            (arrivalWear > 0 ? ` Rough field — extra wear ${arrivalWear.toFixed(2)}%.` : ''),
        }
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
          registration: randomRegistration(g.regionId),
          hoursFlown: 0,
          condition: 100,
          locationIcao: baseIcao,
          fuelL: spec.fuelCapacityL,
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

      refuel: (aircraftId, litres, maxCapacityL) => {
        const s = get()
        if (!s.game) return { ok: false, message: 'No active game.' }
        const g = structuredClone(s.game)
        const ac = g.fleet.find((a) => a.id === aircraftId)
        if (!ac) return { ok: false, message: 'Aircraft not found.' }
        const spec = getSpec(ac.specId)
        if (!airportOffersFuel(ac.locationIcao, spec.fuelType))
          return { ok: false, message: `${ac.locationIcao} has no ${spec.fuelType}.` }
        if (litres <= 0) return { ok: false, message: 'Enter a positive number of litres.' }
        const cap = maxCapacityL ?? spec.fuelCapacityL
        // Reject only a genuine overfill; allow a <=0.5 L rounding slop so a
        // "fill to full" button that rounds the gap up still succeeds.
        if (ac.fuelL + litres > cap + 0.5)
          return { ok: false, message: `Tank holds ${Math.round(cap)} L; that would overfill by ${Math.round(ac.fuelL + litres - cap)} L.` }
        const airport = getAirport(ac.locationIcao)
        const newLevel = Math.min(cap, +(ac.fuelL + litres).toFixed(2)) // clamp so a rounded-up fill lands exactly at cap
        const added = +(newLevel - ac.fuelL).toFixed(2)                 // charge only for what actually went in
        if (added <= 0) return { ok: false, message: 'Tank is already full.' }
        const cost = refuelCost(added, g.fuel[spec.fuelType], airport.fuelPriceMult)
        if (g.balance < cost) return { ok: false, message: `Not enough funds. Need $${cost.toLocaleString()}.` }
        post(g, 'FUEL', `Refuel — ${ac.registration} (${Math.round(added)} L ${spec.fuelType} @ ${airport.icao})`, -cost)
        ac.fuelL = newLevel
        set({ game: g })
        return { ok: true, cost, message: `Loaded ${Math.round(added)} L ${spec.fuelType} into ${ac.registration} for $${cost.toLocaleString()}.` }
      },

      // ——— Always-on sim session (#20). These are the ONLY mutation points for
      // session effects; the reducer in game/simSession.ts stays pure. All
      // return { messages } for useSimSession to toast — never notify here.

      armMissions: (aircraftId, icao, opts) => {
        const s = get()
        if (!s.game) return { messages: [] }
        const g = structuredClone(s.game)
        const messages = armInto(g, aircraftId, icao, opts)
        set({ game: g })
        return { messages }
      },

      stopAt: (aircraftId, icao, opts) => {
        const s = get()
        if (!s.game) return { messages: [] }
        const g = structuredClone(s.game)
        // Defensively ensure a chain exists (D14 fix): in the normal flow
        // commitLeg's off-block already opened one, but a mid-air attach that
        // missed off-block hasn't. No sim identity is available here, so seed
        // an empty title — commitLeg's ensureOpenChain call backfills it later.
        ensureOpenChain(g, aircraftId, '', '')
        const { messages, operator } = settleStop(g, s.operator, aircraftId, icao, opts)
        set({ game: g, operator })
        return { messages }
      },

      // Liftoff (#33): the load measured at engine start is provisional — the
      // player may load or unload while taxiing, and an ordinary armed mission
      // survives a disconnect or a day rollover (finalizeChainInto only un-arms
      // time-critical ones), so its stamp can be a session old. What the
      // aeroplane left the ground with is the figure that counts.
      lockArmedLoad: (aircraftId, loadedKg) => {
        const s = get()
        if (!s.game || loadedKg == null) return
        const mine = s.game.armedMissions.filter((r) => r.aircraftId === aircraftId)
        if (mine.length === 0 || mine.every((r) => r.loadedKg === loadedKg)) return
        const g = structuredClone(s.game)
        for (const r of g.armedMissions) {
          if (r.aircraftId === aircraftId) r.loadedKg = loadedKg
        }
        set({ game: g })
      },

      beginChain: (aircraftId, simTitle, simAtcModel) => {
        const s = get()
        if (!s.game) return
        const g = structuredClone(s.game)
        ensureOpenChain(g, aircraftId, simTitle, simAtcModel)
        set({ game: g })
      },

      commitLeg: (input) => {
        const s = get()
        if (!s.game) return { messages: [] }
        const g = structuredClone(s.game)
        const ac = g.fleet.find((a) => a.id === input.aircraftId)
        if (!ac) return { messages: [] }
        const spec = getSpec(ac.specId)
        const messages: string[] = []
        let operator = s.operator

        // 0. Open the chain BEFORE settling — a mission completing on the
        //    first leg of a fresh chain must land in THIS chain's earnings/
        //    missionIds, not be dropped because no chain existed yet (D14 fix).
        ensureOpenChain(g, input.aircraftId, input.simTitle, input.simAtcModel)

        // 1. Complete at a catalogued field (idempotent with STOP_AT; no longer arms — R2, #33 review).
        if ('icao' in input.pos) {
          const r = settleStop(g, operator, input.aircraftId, input.pos.icao, { atT: input.atT })
          messages.push(...r.messages)
          operator = r.operator
        }

        // 2. Per-leg accounting: maintenance, wear, hours, duty (D14).
        const maint = maintenanceCost(input.leg.blockMinutes, spec.maintPerHour)
        post(g, 'MAINTENANCE', `Maintenance — ${ac.registration}`, -maint)
        ac.hoursFlown = +(ac.hoursFlown + input.leg.blockMinutes / 60).toFixed(2)
        // Landing wear only where we have runway data — an off-field shutdown
        // has none, even though it is the roughest surface of all (B10).
        const arrivalWear = 'icao' in input.pos ? landingWear(getAirport(input.pos.icao), spec) : 0
        ac.condition = clamp(
          +(ac.condition - conditionLoss(input.leg.blockMinutes) - arrivalWear).toFixed(2),
          0,
          100
        )
        if (arrivalWear > 0 && 'icao' in input.pos) {
          messages.push(`Rough field at ${input.pos.icao} — extra wear ${arrivalWear.toFixed(2)}%.`)
        }
        g.stats.hoursFlown = +(g.stats.hoursFlown + input.leg.blockMinutes / 60).toFixed(2)
        const firstToday = !g.dutyLog.some((e) => e.day === g.day)
        const dutyMinutes = Math.round(input.leg.blockMinutes + 30 + (firstToday ? 30 : 0))
        applyDuty(g, dutyMinutes, g.openChain?.missionIds.length ? 'MISSION' : 'FREE', undefined, 0)

        // 3. External fuel (sim-menu refills + pre-connect seed) billed at
        //    arrival rates; base market price where the field sells none (D14).
        if (input.externalFuelL > 0.5) {
          const arrival = 'icao' in input.pos ? getAirport(input.pos.icao) : null
          const mult = arrival && airportOffersFuel(arrival.icao, spec.fuelType) ? arrival.fuelPriceMult : 1.0
          const cost = refuelCost(input.externalFuelL, g.fuel[spec.fuelType], mult)
          post(g, 'FUEL', `External refuel detected — ${Math.round(input.externalFuelL)} L billed${arrival ? ` at ${arrival.icao} rates` : ''}`, -cost)
          messages.push(`External fuel detected: ${Math.round(input.externalFuelL)} L billed for $${cost.toLocaleString()}.`)
        }

        // 4. Sim → game state sync (D7/D9).
        ac.fuelL = +input.simFuelL.toFixed(2)
        if ('icao' in input.pos) {
          ac.locationIcao = input.pos.icao
          delete ac.offField
          g.pilotLocationIcao = input.pos.icao
          delete g.pilotOffField
        } else {
          ac.offField = { lat: input.pos.lat, lon: input.pos.lon }
          g.pilotOffField = { lat: input.pos.lat, lon: input.pos.lon }
          messages.push('Parked off-field — position saved. No fuel or missions here; fly or ferry out to resume.')
        }

        // 5. Chain bookkeeping (one logbook entry per contiguous chain — D14).
        //    ensureOpenChain (step 0) already guarantees g.openChain exists.
        const chain = g.openChain!
        chain.legs.push(input.leg)
        chain.landings += input.landings
        chain.dutyMinutes += dutyMinutes
        // Deliberate: external-fuel billing is NOT folded into earnings — fuel
        // is a resource purchase (it lives on in the tank), not a per-flight
        // cost, matching how in-app refuels are ledgered outside flight nets.
        chain.earnings -= maint
        chain.track.push(...input.track)

        set({ game: g, operator })
        return { messages }
      },

      finalizeChain: () => {
        const s = get()
        if (!s.game?.openChain) return
        const g = structuredClone(s.game)
        finalizeChainInto(g)
        set({ game: g })
      },

      advanceDay: () =>
        set((s) => {
          if (!s.game) return s
          const g = structuredClone(s.game)
          finalizeChainInto(g)
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
              g.armedMissions = g.armedMissions.filter((r) => r.missionId !== m.id)
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

          // Refill the board — near wherever the pilot has ended up (#30).
          const need = g.missionBoardTarget - g.availableMissions.length
          if (need > 0) {
            const fleetSpecs = g.fleet.map((a) => getSpec(a.specId))
            const pilot = g.pilotOffField ?? getAirport(g.pilotLocationIcao)
            g.availableMissions.push(
              ...generateMissions(need, g.day, g.reputation, fleetSpecs, g.regionId, pilot)
            )
          }

          return { game: g }
        }),
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      // IndexedDB-backed (falls back to localStorage); see idbStorage.ts.
      storage: createJSONStorage(() => persistentStorage),
      // Time-critical arms carry a wall-clock deadline (windowEndsAtT) that is
      // meaningless across a reload — strip them from the persisted copy so a
      // crash/close reverts them to plain accepted (they re-arm next session).
      partialize: (s) => ({
        game: s.game
          ? { ...s.game, armedMissions: s.game.armedMissions.filter((r) => r.windowEndsAtT == null) }
          : s.game,
        operator: s.operator,
      }),
      migrate: (persisted, version) => migratePersistedState(persisted, version),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          hydrationError = error
          hydrationErrorListeners.forEach((cb) => cb(error))
        }
      },
    }
  )
)

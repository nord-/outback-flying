export type FuelType = 'AVGAS' | 'JETA'

export type FieldType = 'hub' | 'regional' | 'strip'

export type Surface = 'sealed' | 'gravel' | 'dirt' | 'grass' | 'sand'

export interface Airport {
  icao: string
  name: string
  state: string // sub-locale label (state / territory / country)
  region: string // id of the world region this airport belongs to
  lat: number
  lon: number
  type: FieldType // game role: where missions originate, where the market is
  runwayM: number // longest non-closed runway, rounded to 10 m
  surface: Surface // surface of that longest runway
  lighted: boolean // runway lighting — shown as information, no mechanic
  fuelTypes: FuelType[] // which fuel types the field offers; [] = no fuel
  fuelPriceMult: number // multiplier over the region's market fuel price (1.0 = hub)
}

/** A raw coordinate for positions that aren't a catalogued airport (D9). */
export interface GeoPos {
  lat: number
  lon: number
}

export interface AircraftSpec {
  id: string
  name: string
  category: 'Light piston' | 'High-performance piston' | 'Turboprop' | 'Jet'
  seats: number // passenger/patient seats (excl. crew)
  cruiseKts: number // cruise true airspeed
  rangeNm: number // practical still-air range
  minRunwayM: number // practical runway requirement on sealed, dry ground, reserve included
  fuelType: FuelType
  fuelCapacityL: number
  burnLph: number // cruise fuel burn, litres/hour
  purchaseCost: number
  maintPerHour: number // maintenance $ accrued per flight hour
  dailyFixedCost: number // hangar + insurance per day owned
  // Lowercase keywords matched against the sim's reported ATC MODEL / TITLE
  // (see game/flightlog.ts matchesAircraft) so a real-world variant (e.g. a
  // Bonanza A36) is accepted for this spec (e.g. the G36) — issue #9's
  // "be forgiving" requirement.
  simMatch?: string[]
}

export interface OwnedAircraft {
  id: string // unique instance id
  specId: string
  registration: string // e.g. VH-ABC
  hoursFlown: number
  condition: number // 0..100, airworthiness / wear
  locationIcao: string // where the aircraft currently sits
  fuelL: number // current fuel in tank, litres
  // Set => the aircraft is parked at these coordinates, NOT at locationIcao
  // (which then only anchors the "Off-field, N nm from X" display). Cleared
  // when the aircraft next shuts down at a catalogued field or is ferried out.
  offField?: GeoPos
}

export type MissionType =
  | 'MEDEVAC'
  | 'DOCTOR_TRANSPORT'
  | 'PATIENT_TRANSFER'
  | 'SUPPLY_RUN'
  | 'CLINIC_FLIGHT'
  | 'ORGAN_TRANSPORT'
  | 'EMERGENCY_MEDEVAC'

export type Urgency = 'ROUTINE' | 'PRIORITY' | 'EMERGENCY'

export interface Mission {
  id: string
  type: MissionType
  title: string
  description: string
  fromIcao: string
  toIcao: string
  distanceNm: number
  seatsRequired: number
  urgency: Urgency
  reward: number
  penalty: number // paid if the mission expires unaccepted-after-accept or fails
  postedDay: number
  expiresDay: number // last day the mission can be completed
  reputationReward: number
  windowMinutes?: number // present only for time-critical types; countdown length in minutes
}

export type LedgerCategory =
  | 'MISSION'
  | 'FUEL'
  | 'MAINTENANCE'
  | 'AIRCRAFT_PURCHASE'
  | 'AIRCRAFT_SALE'
  | 'DAILY_COST'
  | 'REPAIR'
  | 'PENALTY'
  | 'OPENING'

export interface LedgerEntry {
  id: string
  day: number
  category: LedgerCategory
  description: string
  amount: number // positive = income, negative = expense
  balanceAfter: number
}

export interface DutyEntry {
  id: string
  day: number // game day the duty was incurred
  minutes: number // duty minutes (computeDutyMinutes result)
  kind: 'MISSION' | 'FERRY' | 'FREE'
  missionId?: string
}

export interface FuelPrices {
  AVGAS: number // $ per litre
  JETA: number
}

/**
 * The persistent career identity. It survives region transfers — the active
 * station (GameState) is recreated per region, but the operator carries on,
 * keeping the company name and accumulated experience.
 */
export interface OperatorProfile {
  name: string
  xp: number // career experience; rank is derived from this
  startRegionId: string // region the career began in
}

// SimConnect-recorded flight log (issue #9). A "flight" can span multiple legs
// (fuel/overnight stops); ICAOs are null when the recorded position didn't
// match any airport in our catalogue within tolerance (game/flightlog.ts).
export interface TrackPoint {
  t: number // epoch ms when the sample was read
  lat: number
  lon: number
  hdg: number // degrees true
  gs: number // groundspeed, knots
  alt: number // indicated altitude, feet
  onGround: boolean
}

export interface FlightLeg {
  fromIcao: string | null
  toIcao: string | null
  blockMinutes: number
  flightMinutes: number
  distanceNm: number
  fuelUsedL: number
}

// The full record, including its (RDP-simplified) track. Kept out of
// GameState — see FlightLogSummary — and persisted as its own IndexedDB
// record so a long game's track data doesn't bloat the main save.
export interface FlightLog {
  id: string
  day: number // game day it was committed
  missionId?: string // absent = free flight / reposition, not tied to a mission
  missionIds?: string[] // all missions settled during this chain (D14); missionId kept for old entries
  aircraftId: string
  simAircraftTitle: string // sim TITLE, for the forgiveness audit trail
  simAtcModel: string // sim ATC MODEL, ditto
  legs: FlightLeg[]
  startIcao: string | null
  endIcao: string | null
  intermediates: string[]
  blockMinutes: number
  flightMinutes: number
  dutyMinutes: number
  distanceNm: number
  fuelUsedL: number
  landings: number
  earnings: number
  track: TrackPoint[]
}

// What actually lives in GameState — everything from FlightLog except the
// heavy `track` (and the sim-matching audit fields, which aren't needed once
// the flight is committed).
export type FlightLogSummary = Omit<FlightLog, 'simAircraftTitle' | 'simAtcModel' | 'track'>

// A contiguous run of engine-legs being assembled into one logbook entry;
// finalized (→ FlightLog) at disconnect, day advance, or aircraft re-match.
export interface OpenChain {
  aircraftId: string
  startDay: number
  simAircraftTitle: string
  simAtcModel: string
  legs: FlightLeg[]
  landings: number
  dutyMinutes: number
  earnings: number
  missionIds: string[]
  track: TrackPoint[]
}

// A mission "underway" between off-block and its destination stop, tagged
// with the aircraft that armed it — settlement only pays out to that same
// aircraft, so a different aircraft merely passing through the destination
// can't collect a reward it didn't carry the mission for (#22 review).
export interface ArmedMission {
  missionId: string
  aircraftId: string
  // Time-critical only: wall-clock (sim sample `t`, epoch ms) by which the
  // aircraft must be parked at the destination, stamped when the mission arms
  // at its origin. Absent for ordinary missions.
  windowEndsAtT?: number
}

export interface GameState {
  version: number
  companyName: string
  regionId: string // world region this station operates in
  homeBaseIcao: string // operation's home base (RFDS-style); default YBAS
  pilotLocationIcao: string // where the single pilot currently is
  pilotOffField?: GeoPos // set => the pilot is at coordinates, not pilotLocationIcao
  balance: number
  reputation: number // 0..100
  day: number
  missionBoardTarget: number // postings the board refills to; one of MISSION_BOARD_STEPS
  fuel: FuelPrices
  fleet: OwnedAircraft[]
  availableMissions: Mission[]
  acceptedMissions: Mission[]
  ledger: LedgerEntry[]
  flightLogs: FlightLogSummary[]
  dutyLog: DutyEntry[]
  armedMissions: ArmedMission[] // accepted missions currently "underway" (armed at off-block/stop — D8)
  openChain?: OpenChain
  stats: {
    missionsCompleted: number
    missionsFailed: number
    hoursFlown: number
    totalEarned: number
  }
}

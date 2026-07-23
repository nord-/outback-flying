export type FuelType = 'AVGAS' | 'JETA'

export interface Airport {
  icao: string
  name: string
  state: string // sub-locale label (state / territory / country)
  region: string // id of the world region this airport belongs to
  lat: number
  lon: number
  isBase: boolean // major hub where missions tend to originate
}

export interface AircraftSpec {
  id: string
  name: string
  category: 'Light piston' | 'High-performance piston' | 'Turboprop' | 'Jet'
  seats: number // passenger/patient seats (excl. crew)
  cruiseKts: number // cruise true airspeed
  rangeNm: number // practical still-air range
  fuelType: FuelType
  fuelCapacityL: number
  burnLph: number // cruise fuel burn, litres/hour
  purchaseCost: number
  maintPerHour: number // maintenance $ accrued per flight hour
  dailyFixedCost: number // hangar + insurance per day owned
}

export interface OwnedAircraft {
  id: string // unique instance id
  specId: string
  registration: string // e.g. VH-ABC
  hoursFlown: number
  condition: number // 0..100, airworthiness / wear
  locationIcao: string // where the aircraft currently sits
}

export type MissionType =
  | 'MEDEVAC'
  | 'DOCTOR_TRANSPORT'
  | 'PATIENT_TRANSFER'
  | 'SUPPLY_RUN'
  | 'CLINIC_FLIGHT'

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

export interface GameState {
  version: number
  companyName: string
  regionId: string // world region this station operates in
  homeBaseIcao: string // operation's home base (RFDS-style); default YBAS
  pilotLocationIcao: string // where the single pilot currently is
  balance: number
  reputation: number // 0..100
  day: number
  fuel: FuelPrices
  fleet: OwnedAircraft[]
  availableMissions: Mission[]
  acceptedMissions: Mission[]
  ledger: LedgerEntry[]
  stats: {
    missionsCompleted: number
    missionsFailed: number
    hoursFlown: number
    totalEarned: number
  }
}

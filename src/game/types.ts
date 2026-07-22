export type FuelType = 'AVGAS' | 'JETA'

export interface Airport {
  icao: string
  name: string
  state: string // Australian state/territory code
  lat: number
  lon: number
  isBase: boolean // Royal Flying Doctor Service-style base / major hub
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

export interface GameState {
  version: number
  companyName: string
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

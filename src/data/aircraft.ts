import type { AircraftSpec } from '../game/types'

// Aircraft roughly modelled on real types used across Australian outback GA
// and Royal Flying Doctor Service-style operations. Numbers are gameplay
// approximations, not certified performance figures.
export const AIRCRAFT_SPECS: AircraftSpec[] = [
  {
    id: 'c152',
    name: 'Cessna 152',
    category: 'Light piston',
    seats: 2,
    cruiseKts: 105,
    rangeNm: 415,
    fuelType: 'AVGAS',
    fuelCapacityL: 98,
    burnLph: 22,
    purchaseCost: 120000,
    maintPerHour: 35,
    dailyFixedCost: 45,
  },
  {
    id: 'c172',
    name: 'Cessna 172 Skyhawk',
    category: 'Light piston',
    seats: 3,
    cruiseKts: 120,
    rangeNm: 640,
    fuelType: 'AVGAS',
    fuelCapacityL: 200,
    burnLph: 32,
    purchaseCost: 220000,
    maintPerHour: 45,
    dailyFixedCost: 60,
  },
  {
    id: 'xcub',
    name: 'CubCrafters XCub',
    category: 'Light piston',
    seats: 2,
    cruiseKts: 130,
    rangeNm: 750,
    fuelType: 'AVGAS',
    fuelCapacityL: 190,
    burnLph: 38,
    purchaseCost: 380000,
    maintPerHour: 55,
    dailyFixedCost: 70,
  },
  {
    id: 'bonanza',
    name: 'Beechcraft Bonanza G36',
    category: 'High-performance piston',
    seats: 5,
    cruiseKts: 170,
    rangeNm: 900,
    fuelType: 'AVGAS',
    fuelCapacityL: 400,
    burnLph: 60,
    purchaseCost: 480000,
    maintPerHour: 85,
    dailyFixedCost: 120,
  },
  {
    id: 'baron',
    name: 'Beechcraft Baron G58',
    category: 'High-performance piston',
    seats: 6,
    cruiseKts: 200,
    rangeNm: 1000,
    fuelType: 'AVGAS',
    fuelCapacityL: 700,
    burnLph: 130,
    purchaseCost: 700000,
    maintPerHour: 160,
    dailyFixedCost: 190,
  },
  {
    id: 'pc6',
    name: 'Pilatus PC-6 Porter',
    category: 'Turboprop',
    seats: 9,
    cruiseKts: 120,
    rangeNm: 690,
    fuelType: 'JETA',
    fuelCapacityL: 640,
    burnLph: 180,
    purchaseCost: 1400000,
    maintPerHour: 180,
    dailyFixedCost: 260,
  },
  {
    id: 'kodiak',
    name: 'Kodiak 100',
    category: 'Turboprop',
    seats: 9,
    cruiseKts: 170,
    rangeNm: 1000,
    fuelType: 'JETA',
    fuelCapacityL: 1130,
    burnLph: 210,
    purchaseCost: 2000000,
    maintPerHour: 230,
    dailyFixedCost: 310,
  },
  {
    id: 'c208',
    name: 'Cessna 208B Grand Caravan EX',
    category: 'Turboprop',
    seats: 9,
    cruiseKts: 175,
    rangeNm: 1000,
    fuelType: 'JETA',
    fuelCapacityL: 1250,
    burnLph: 210,
    purchaseCost: 2200000,
    maintPerHour: 240,
    dailyFixedCost: 320,
  },
  {
    id: 'b200',
    name: 'Beechcraft King Air 350i',
    category: 'Turboprop',
    seats: 8,
    cruiseKts: 290,
    rangeNm: 1800,
    fuelType: 'JETA',
    fuelCapacityL: 1650,
    burnLph: 380,
    purchaseCost: 3600000,
    maintPerHour: 340,
    dailyFixedCost: 480,
  },
  {
    id: 'pc12',
    name: 'Pilatus PC-12 NGX',
    category: 'Turboprop',
    seats: 9,
    cruiseKts: 280,
    rangeNm: 1800,
    fuelType: 'JETA',
    fuelCapacityL: 1520,
    burnLph: 300,
    purchaseCost: 4500000,
    maintPerHour: 300,
    dailyFixedCost: 520,
  },
]

const BY_ID = new Map(AIRCRAFT_SPECS.map((s) => [s.id, s]))

export function getSpec(id: string): AircraftSpec {
  const s = BY_ID.get(id)
  if (!s) throw new Error(`Unknown aircraft spec: ${id}`)
  return s
}

/**
 * The aircraft a new operation can start with, in display order. The starter is
 * granted for free; `startingBalance` is the player's cash on day 1 (negative =
 * a startup loan). Cheaper aircraft leave more cash.
 */
export const STARTER_OPTIONS: readonly { specId: string; startingBalance: number }[] = [
  { specId: 'c152', startingBalance: 30000 },
  { specId: 'c172', startingBalance: 20000 },
  { specId: 'bonanza', startingBalance: 1000 },
  { specId: 'pc6', startingBalance: -20000 },
]

/** The starter offered when no explicit choice is made or the chosen id is invalid. */
export const DEFAULT_STARTER = 'c172'

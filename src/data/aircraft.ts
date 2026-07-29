import type { AircraftSpec } from '../game/types'

// Aircraft roughly modelled on real types used across Australian outback GA
// and Royal Flying Doctor Service-style operations. Numbers are gameplay
// approximations, not certified performance figures.
//
// `minRunwayM` is a practical minimum with reserve baked in, not a POH ground
// roll: the game models neither temperature nor density altitude, so a literal
// ground roll would read misleadingly optimistic (see #5 design spec, §3.2).
export const AIRCRAFT_SPECS: AircraftSpec[] = [
  {
    id: 'c152',
    name: 'Cessna 152',
    category: 'Light piston',
    seats: 1, // two-seat cockpit is pilot + ONE passenger, not two on top of the pilot (#33)
    cruiseKts: 105,
    rangeNm: 415,
    minRunwayM: 350,
    fuelType: 'AVGAS',
    fuelCapacityL: 98,
    burnLph: 22,
    purchaseCost: 120000,
    maintPerHour: 35,
    dailyFixedCost: 45,
    usefulLoadKg: 245, // MTOW 757 kg − empty ≈ 512 kg (C152 published figures)
    simMatch: ['152'],
  },
  {
    id: 'c172',
    name: 'Cessna 172 Skyhawk',
    category: 'Light piston',
    seats: 3,
    cruiseKts: 120,
    rangeNm: 640,
    minRunwayM: 400,
    fuelType: 'AVGAS',
    fuelCapacityL: 200,
    burnLph: 32,
    purchaseCost: 220000,
    maintPerHour: 45,
    dailyFixedCost: 60,
    usefulLoadKg: 390, // MTOW 1157 kg − empty ≈ 767 kg (C172S published figures)
    simMatch: ['172', 'skyhawk'],
  },
  {
    id: 'xcub',
    name: 'CubCrafters XCub',
    category: 'Light piston',
    seats: 1, // tandem two-seater is pilot + ONE passenger, not two on top of the pilot (#33)
    cruiseKts: 130,
    rangeNm: 750,
    minRunwayM: 150,
    fuelType: 'AVGAS',
    fuelCapacityL: 190,
    burnLph: 38,
    purchaseCost: 380000,
    maintPerHour: 55,
    dailyFixedCost: 70,
    usefulLoadKg: 493, // CubCrafters: useful load 1088 lb (published XCub figures)
    simMatch: ['xcub', 'x-cub', 'cub'],
  },
  {
    id: 'bonanza',
    name: 'Beechcraft Bonanza G36',
    category: 'High-performance piston',
    seats: 5,
    cruiseKts: 170,
    rangeNm: 900,
    minRunwayM: 550,
    fuelType: 'AVGAS',
    fuelCapacityL: 400,
    burnLph: 60,
    purchaseCost: 480000,
    maintPerHour: 85,
    dailyFixedCost: 120,
    usefulLoadKg: 636, // Beechcraft: useful payload 1403 lb (published Bonanza G36 figures)
    simMatch: ['bonanza'],
  },
  {
    id: 'baron',
    name: 'Beechcraft Baron G58',
    category: 'High-performance piston',
    seats: 5, // six-seat cabin is pilot + FIVE passengers, not six on top of the pilot (#33)
    cruiseKts: 200,
    rangeNm: 1000,
    minRunwayM: 650,
    fuelType: 'AVGAS',
    fuelCapacityL: 700,
    burnLph: 130,
    purchaseCost: 700000,
    maintPerHour: 160,
    dailyFixedCost: 190,
    usefulLoadKg: 765, // MTOW 2495 kg − empty ≈ 1730 kg (Baron G58 published figures)
    simMatch: ['baron'],
  },
  {
    id: 'pc6',
    name: 'Pilatus PC-6 Porter',
    category: 'Turboprop',
    seats: 6, // bush-configured cabin seats SIX passengers behind the pilot, not nine on top of the pilot (#33)
    cruiseKts: 120,
    rangeNm: 690,
    minRunwayM: 250,
    fuelType: 'JETA',
    fuelCapacityL: 640,
    burnLph: 180,
    purchaseCost: 1400000,
    maintPerHour: 180,
    dailyFixedCost: 260,
    usefulLoadKg: 1000, // Pilatus publishes ≈2381 lb (~1080 kg) payload WITH MAX FUEL, not useful load —
    // useful load is that figure PLUS the fuel it excludes (~1080 + 640 L × 0.8 kg/L ≈ 1592 kg); 1000 kg
    // is used anyway as a deliberately conservative round figure, comfortably under that derived number.
    simMatch: ['pc-6', 'pc6', 'porter'],
  },
  {
    id: 'kodiak',
    name: 'Kodiak 100',
    category: 'Turboprop',
    seats: 10, // high-density cabin seats TEN passengers behind the pilot (#33)
    cruiseKts: 170,
    rangeNm: 1000,
    minRunwayM: 400,
    fuelType: 'JETA',
    fuelCapacityL: 1130,
    burnLph: 210,
    purchaseCost: 2000000,
    maintPerHour: 230,
    dailyFixedCost: 310,
    usefulLoadKg: 1601, // Daher: base aircraft useful load 3530 lb (published Kodiak 100 figures)
    simMatch: ['kodiak'],
  },
  {
    id: 'c208',
    name: 'Cessna 208B Grand Caravan EX',
    category: 'Turboprop',
    seats: 9,
    cruiseKts: 175,
    rangeNm: 1000,
    minRunwayM: 500,
    fuelType: 'JETA',
    fuelCapacityL: 1250,
    burnLph: 210,
    purchaseCost: 2200000,
    maintPerHour: 240,
    dailyFixedCost: 320,
    usefulLoadKg: 1830, // MTOW 4110 kg − empty ≈ 2280 kg (Grand Caravan EX published useful load ≈ 4032 lb, utility category)
    simMatch: ['208', 'caravan'],
  },
  {
    id: 'b200',
    name: 'Beechcraft King Air 350i',
    category: 'Turboprop',
    seats: 8,
    cruiseKts: 290,
    rangeNm: 1800,
    minRunwayM: 750,
    fuelType: 'JETA',
    fuelCapacityL: 1650,
    burnLph: 380,
    purchaseCost: 3600000,
    maintPerHour: 340,
    dailyFixedCost: 480,
    usefulLoadKg: 2495, // MTOW 6804 kg − empty ≈ 4310 kg (King Air 350i published useful load ≈ 5500 lb)
    simMatch: ['king air', 'kingair', 'b350', '350i'],
  },
  {
    id: 'pc12',
    name: 'Pilatus PC-12 NGX',
    category: 'Turboprop',
    seats: 8, // typical commuter cabin seats EIGHT passengers behind the pilot, not nine on top of the pilot (#33)
    cruiseKts: 280,
    rangeNm: 1800,
    minRunwayM: 700,
    fuelType: 'JETA',
    fuelCapacityL: 1520,
    burnLph: 300,
    purchaseCost: 4500000,
    maintPerHour: 300,
    dailyFixedCost: 520,
    usefulLoadKg: 1680, // MTOW 4740 kg − empty ≈ 3060 kg (PC-12 NGX published figures)
    simMatch: ['pc-12', 'pc12'],
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

import type { AircraftSpec } from '../game/types'

// Aircraft roughly modelled on real types used across Australian outback GA
// and Royal Flying Doctor Service-style operations. Numbers are gameplay
// approximations, not certified performance figures.
export const AIRCRAFT_SPECS: AircraftSpec[] = [
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
    id: 'c210',
    name: 'Cessna 210 Centurion',
    category: 'High-performance piston',
    seats: 5,
    cruiseKts: 165,
    rangeNm: 900,
    fuelType: 'AVGAS',
    fuelCapacityL: 340,
    burnLph: 55,
    purchaseCost: 420000,
    maintPerHour: 80,
    dailyFixedCost: 110,
  },
  {
    id: 'pa31',
    name: 'Piper PA-31 Navajo',
    category: 'High-performance piston',
    seats: 6,
    cruiseKts: 200,
    rangeNm: 1000,
    fuelType: 'AVGAS',
    fuelCapacityL: 700,
    burnLph: 130,
    purchaseCost: 650000,
    maintPerHour: 160,
    dailyFixedCost: 190,
  },
  {
    id: 'c208',
    name: 'Cessna 208 Caravan',
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
    name: 'Beechcraft King Air B200',
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
    name: 'Pilatus PC-12',
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

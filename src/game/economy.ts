import type { AircraftSpec, Mission, Urgency } from './types'

export const URGENCY_MULT: Record<Urgency, number> = {
  ROUTINE: 1.0,
  PRIORITY: 1.35,
  EMERGENCY: 1.8,
}

/** Suggested block time (minutes) for a leg, allowing for climb/descent/taxi. */
export function suggestedBlockMinutes(distanceNm: number, cruiseKts: number): number {
  const cruiseHours = distanceNm / cruiseKts
  const overheadHours = 0.25 // taxi, climb, approach
  return Math.round((cruiseHours + overheadHours) * 60)
}

/** Suggested fuel burn (litres) for a leg at cruise burn plus overhead. */
export function suggestedFuelLitres(blockMinutes: number, burnLph: number): number {
  return Math.round((blockMinutes / 60) * burnLph)
}

/** Fuel cost for a leg, in dollars. */
export function fuelCost(litres: number, pricePerLitre: number): number {
  return Math.round(litres * pricePerLitre)
}

/** Maintenance accrued for a leg, in dollars. */
export function maintenanceCost(blockMinutes: number, maintPerHour: number): number {
  return Math.round((blockMinutes / 60) * maintPerHour)
}

/** Condition (wear) lost flying a leg. Longer legs wear more. */
export function conditionLoss(blockMinutes: number): number {
  return +(blockMinutes / 60 * 0.9).toFixed(2)
}

/**
 * Reward for a mission, scaled by distance, seats, urgency and reputation.
 * Reputation gives up to a 25% bonus at 100.
 */
export function computeReward(
  distanceNm: number,
  seatsRequired: number,
  urgency: Urgency,
  reputation: number
): number {
  const base = 1800
  const perNm = 9.5
  const perSeat = 220
  const raw = (base + distanceNm * perNm + seatsRequired * perSeat) * URGENCY_MULT[urgency]
  const repBonus = 1 + (reputation / 100) * 0.25
  return Math.round((raw * repBonus) / 10) * 10
}

/** Estimated profit of flying a mission with a given aircraft, for the UI. */
export function estimateProfit(
  mission: Mission,
  spec: AircraftSpec,
  fuelPricePerLitre: number
): number {
  const block = suggestedBlockMinutes(mission.distanceNm, spec.cruiseKts)
  const fuel = suggestedFuelLitres(block, spec.burnLph)
  return (
    mission.reward -
    fuelCost(fuel, fuelPricePerLitre) -
    maintenanceCost(block, spec.maintPerHour)
  )
}

import type { Airport, AircraftSpec, Surface } from './types'

/**
 * What a field demands of an aircraft. Reads ONLY physical facts — runway
 * length and surface against the spec's requirement — and never the field's
 * `type`. A hub with 1800 m of gravel is gravel; a strip that happens to be
 * sealed costs nothing (see #5 design spec, B5/B6).
 */

/** Extra runway an unsealed surface demands, as a multiplier on the requirement. */
export const SURFACE_FACTOR: Record<Surface, number> = {
  sealed: 1.0,
  grass: 1.1,
  gravel: 1.1,
  dirt: 1.15,
  sand: 1.25,
  unknown: 1.25, // no verified surface — assume the worst factor we know of
}

/** Condition points lost per landing to the surface alone, regardless of margin. */
export const SURFACE_WEAR: Record<Surface, number> = {
  sealed: 0,
  grass: 0.05,
  gravel: 0.12,
  dirt: 0.15,
  sand: 0.25,
  unknown: 0.25,
}

export const MARGIN_OK = 1.15
const MARGIN_BAND_PENALTY = 0.3
const SHORT_SLOPE = 8
const MARGIN_PENALTY_CAP = 4.0

export type Suitability = 'ok' | 'marginal' | 'short' | 'unknown'

/** Runway this spec needs on the given surface, in metres. */
export function requiredRunwayM(spec: AircraftSpec, surface: Surface): number {
  return spec.minRunwayM * SURFACE_FACTOR[surface]
}

/** Available runway over what the aircraft needs. 1.0 = exactly enough. NaN when the field's length is unverified. */
export function runwayMargin(airport: Airport, spec: AircraftSpec): number {
  if (airport.runwayM == null) return NaN
  return airport.runwayM / requiredRunwayM(spec, airport.surface)
}

/**
 * How well this aircraft fits this field. Bands are closed below and open
 * above: exactly 1.0 is 'marginal', exactly 1.15 is 'ok'. Never blocks
 * anything — the UI warns, the player decides (B2/B3). A field with no
 * verified runway length is 'unknown' — it may be unlandable.
 */
export function fieldSuitability(airport: Airport, spec: AircraftSpec): Suitability {
  if (airport.runwayM == null) return 'unknown'
  const m = runwayMargin(airport, spec)
  if (m < 1) return 'short'
  if (m < MARGIN_OK) return 'marginal'
  return 'ok'
}

/**
 * Condition points lost landing this aircraft at this field, on top of the
 * time-based `conditionLoss`. Length shortfall dominates; the surface is
 * nearly a rounding term (B7). An unverified field charges the same
 * worst-case penalty as a genuinely too-short landing, since the risk can't
 * be ruled out.
 */
export function landingWear(airport: Airport, spec: AircraftSpec): number {
  if (airport.runwayM == null) return +(SURFACE_WEAR.unknown + MARGIN_PENALTY_CAP).toFixed(2)
  const m = runwayMargin(airport, spec)
  let penalty = 0
  if (m < 1) {
    penalty = Math.min(MARGIN_PENALTY_CAP, MARGIN_BAND_PENALTY + (1 - m) * SHORT_SLOPE)
  } else if (m < MARGIN_OK) {
    penalty = MARGIN_BAND_PENALTY * ((MARGIN_OK - m) / (MARGIN_OK - 1))
  }
  return +(SURFACE_WEAR[airport.surface] + penalty).toFixed(2)
}

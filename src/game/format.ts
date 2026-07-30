import type { Airport, FuelType, Surface, Urgency } from './types'

/** Display labels for fuel types. The stored enum value stays `JETA`; only the UI reads `JET A1`. */
export const FUEL_LABEL: Record<FuelType, string> = {
  AVGAS: 'AVGAS',
  JETA: 'JET A1',
}

export const money = (n: number): string =>
  (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU')

/** Money with cents — for per-litre fuel prices and other small amounts. */
export const price = (n: number): string =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const signedMoney = (n: number): string => (n >= 0 ? '+' : '-') + '$' + Math.abs(Math.round(n)).toLocaleString('en-AU')

export const hoursMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  ROUTINE: 'Routine',
  PRIORITY: 'Priority',
  EMERGENCY: 'Emergency',
}

/** Display labels for runway surface. `unknown` covers both an unverified surface with a known length, and no data at all. */
export const SURFACE_LABEL: Record<Surface, string> = {
  sealed: 'sealed',
  gravel: 'gravel',
  dirt: 'dirt',
  grass: 'grass',
  sand: 'sand',
  unknown: 'unverified surface',
}

/**
 * "1240 m gravel" — the field's physical facts, for any decision UI.
 * Deliberately omits lighting: OurAirports reports no lighting for all four
 * runways at PAFA Fairbanks International, so the `lighted` field is not
 * trustworthy enough to show the player as fact. It stays on `Airport` for
 * when a better source exists, it just isn't displayed here for now.
 */
export function fieldSummary(a: Airport): string {
  if (a.runwayM == null) return 'unverified field data'
  return `${a.runwayM} m, ${SURFACE_LABEL[a.surface]}`
}

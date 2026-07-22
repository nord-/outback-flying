import type { FuelType, Urgency } from './types'

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

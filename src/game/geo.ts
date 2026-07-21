import type { Airport } from './types'

const EARTH_RADIUS_NM = 3440.065 // nautical miles

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance between two airports, in nautical miles. */
export function distanceNm(a: Airport, b: Airport): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial great-circle bearing from a to b, in degrees (0..360). */
export function bearingDeg(a: Airport, b: Airport): number {
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLon = toRad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function compass(bearing: number): string {
  return COMPASS[Math.round(bearing / 45) % 8]
}

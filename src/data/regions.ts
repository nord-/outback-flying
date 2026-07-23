import type { FuelPrices } from '../game/types'

export interface Region {
  id: string
  name: string
  flag: string // emoji
  blurb: string
  homeBaseIcao: string // default starting station
  startingFuel: FuelPrices
}

// World regions the player can operate in. Each has its own airport set
// (see airports.ts), a default home base and baseline fuel prices reflecting
// how remote and expensive flying there is.
export const REGIONS: Region[] = [
  {
    id: 'outback',
    name: 'Australian Outback',
    flag: '🇦🇺',
    blurb:
      'The red centre and the vast strips of the interior. Long legs between isolated stations and remote communities.',
    homeBaseIcao: 'YBAS',
    startingFuel: { AVGAS: 2.9, JETA: 2.4 },
  },
  {
    id: 'africa',
    name: 'East Africa',
    flag: '🌍',
    blurb:
      'Kenya, Tanzania, Uganda and beyond. Bush strips, highland clinics and coastal towns served from busy regional hubs.',
    homeBaseIcao: 'HKNW',
    startingFuel: { AVGAS: 3.4, JETA: 2.9 },
  },
  {
    id: 'namerica',
    name: 'Alaska & the North',
    flag: '🏔️',
    blurb:
      'Alaska and the Canadian north. Short daylight, big distances and villages reachable only by air.',
    homeBaseIcao: 'PANC',
    startingFuel: { AVGAS: 3.1, JETA: 2.7 },
  },
]

export const DEFAULT_REGION = 'outback'

const BY_ID = new Map(REGIONS.map((r) => [r.id, r]))

export function getRegion(id: string): Region {
  const r = BY_ID.get(id)
  if (!r) throw new Error(`Unknown region: ${id}`)
  return r
}

export function tryGetRegion(id: string): Region | undefined {
  return BY_ID.get(id)
}

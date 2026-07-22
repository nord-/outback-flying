import type { GameState, Mission, Urgency } from './types'
import { AIRPORTS, getAirport } from '../data/airports'

export interface MapPoint {
  icao: string
  name: string
  lat: number
  lon: number
}

export interface MapAircraft {
  registration: string
  point: MapPoint
}

export interface MissionLine {
  id: string
  title: string // mission title, shown in the tooltip
  urgency: Urgency
  from: MapPoint
  to: MapPoint
  pilotLeg?: { from: MapPoint; to: MapPoint } // accepted missions only
}

export interface MapView {
  airports: MapPoint[] // all airports — faint background dots
  homeBase: MapPoint
  pilot: MapPoint
  aircraft: MapAircraft[]
  availableMissions: MissionLine[] // pilotLeg undefined
  acceptedMissions: MissionLine[] // pilotLeg set: pilot -> mission start
}

function toPoint(icao: string): MapPoint {
  const a = getAirport(icao)
  return { icao: a.icao, name: a.name, lat: a.lat, lon: a.lon }
}

export function deriveMapView(game: GameState): MapView {
  const pilot = toPoint(game.pilotLocationIcao)
  return {
    airports: AIRPORTS.map((a) => ({ icao: a.icao, name: a.name, lat: a.lat, lon: a.lon })),
    homeBase: toPoint(game.homeBaseIcao),
    pilot,
    aircraft: game.fleet.map((a) => ({
      registration: a.registration,
      point: toPoint(a.locationIcao),
    })),
    availableMissions: game.availableMissions.map((m) => ({
      id: m.id,
      title: m.title,
      urgency: m.urgency,
      from: toPoint(m.fromIcao),
      to: toPoint(m.toIcao),
    })),
    acceptedMissions: game.acceptedMissions.map((m) => ({
      id: m.id,
      title: m.title,
      urgency: m.urgency,
      from: toPoint(m.fromIcao),
      to: toPoint(m.toIcao),
      pilotLeg: { from: pilot, to: toPoint(m.fromIcao) },
    })),
  }
}

export interface MissionAtAirport {
  id: string
  title: string
  fromIcao: string
  toIcao: string
  reward: number
  role: 'from' | 'to'
  status: 'available' | 'accepted'
}

/**
 * Every mission (available or accepted) whose start or end is `icao`.
 * UI-agnostic: the map dialog renders this list; the airport dot that was
 * clicked is guaranteed to appear as at least one entry's from/to.
 */
export function missionsAtAirport(game: GameState, icao: string): MissionAtAirport[] {
  const collect = (missions: Mission[], status: 'available' | 'accepted'): MissionAtAirport[] =>
    missions
      .filter((m) => m.fromIcao === icao || m.toIcao === icao)
      .map((m) => ({
        id: m.id,
        title: m.title,
        fromIcao: m.fromIcao,
        toIcao: m.toIcao,
        reward: m.reward,
        role: m.toIcao === icao ? 'to' : 'from',
        status,
      }))
  return [
    ...collect(game.availableMissions, 'available'),
    ...collect(game.acceptedMissions, 'accepted'),
  ]
}

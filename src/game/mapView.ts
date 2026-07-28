import type { GameState, GeoPos, Mission, Urgency, FieldType } from './types'
import { airportsInRegion, getAirport } from '../data/airports'

export interface MapPoint {
  icao: string
  name: string
  lat: number
  lon: number
  type: FieldType | null // null = not a catalogued field (off-field position)
}

export interface MapAircraft {
  registration: string
  point: MapPoint
  // Present only while the always-on sim session is tracking this aircraft:
  // `point` is then the live coordinate rather than a parked position (#29).
  live?: { groundKts: number; altFt: number; onGround: boolean }
}

/** The live sim position of one fleet aircraft, fed in by the map component
 *  from the always-on session. Positions are guaranteed plausible: the caller
 *  reads `session.lastSample`, which `reduceSession` only ever advances with a
 *  sample that passed `isPlausibleSample` (#28). */
export interface LiveFlight {
  aircraftId: string
  lat: number
  lon: number
  groundKts: number
  altFt: number
  onGround: boolean
  track: GeoPos[]
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
  liveTrack?: GeoPos[] // set only while a live flight is being tracked
}

function toPoint(icao: string): MapPoint {
  const a = getAirport(icao)
  return { icao: a.icao, name: a.name, lat: a.lat, lon: a.lon, type: a.type }
}

function offPoint(pos: GeoPos): MapPoint {
  return { icao: '', name: 'Off-field', lat: pos.lat, lon: pos.lon, type: null }
}

function livePoint(live: LiveFlight): MapPoint {
  return { icao: '', name: 'In flight', lat: live.lat, lon: live.lon, type: null }
}

export function deriveMapView(game: GameState, live?: LiveFlight): MapView {
  // A live flight for an aircraft that is no longer in the fleet (sold
  // mid-session) is ignored rather than plotted as a ghost.
  const flying = live && game.fleet.some((a) => a.id === live.aircraftId) ? live : undefined
  // The pilot is in the aircraft. Leaving the pin at the departure field would
  // put two contradictory claims about their position on the same map — and it
  // is what makes each accepted mission's pilotLeg answer "how far am I from
  // picking this up?" while airborne.
  const pilot = flying
    ? livePoint(flying)
    : game.pilotOffField
      ? offPoint(game.pilotOffField)
      : toPoint(game.pilotLocationIcao)
  return {
    airports: airportsInRegion(game.regionId).map((a) => ({ icao: a.icao, name: a.name, lat: a.lat, lon: a.lon, type: a.type })),
    homeBase: toPoint(game.homeBaseIcao),
    pilot,
    aircraft: game.fleet.map((a) => {
      if (flying && a.id === flying.aircraftId) {
        return {
          registration: a.registration,
          point: livePoint(flying),
          live: { groundKts: flying.groundKts, altFt: flying.altFt, onGround: flying.onGround },
        }
      }
      return {
        registration: a.registration,
        point: a.offField ? offPoint(a.offField) : toPoint(a.locationIcao),
      }
    }),
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
    ...(flying ? { liveTrack: flying.track } : {}),
  }
}

export type LatLngBoundsTuple = [[number, number], [number, number]]

/**
 * Bounding box ([[swLat, swLon], [neLat, neLon]]) around a region's airports,
 * used as the map's initial view and its empty-state fallback. Padded slightly
 * so edge airports aren't flush against the frame.
 */
export function regionBounds(regionId: string): LatLngBoundsTuple {
  const airports = airportsInRegion(regionId)
  if (airports.length === 0) return [[-44, 112], [-10, 154]] // fall back to Australia
  const lats = airports.map((a) => a.lat)
  const lons = airports.map((a) => a.lon)
  const pad = 1
  return [
    [Math.min(...lats) - pad, Math.min(...lons) - pad],
    [Math.max(...lats) + pad, Math.max(...lons) + pad],
  ]
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

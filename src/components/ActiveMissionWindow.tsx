import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Tooltip } from 'react-leaflet'
import * as L from 'leaflet'
import type { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getAirport } from '../data/airports'
import { distanceNm } from '../game/geo'
import { useGame } from '../game/store'
import { useSessionState } from '../sim/useSimSession'

const planeIcon = L.divIcon({ className: 'map-pin', html: '🛩️', iconSize: [22, 22], iconAnchor: [11, 11] })

function clock(ms: number): string {
  const neg = ms < 0
  const total = Math.floor(Math.abs(ms) / 1000)
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${neg ? '-' : ''}${mm}:${String(ss).padStart(2, '0')}`
}

/**
 * Live countdown for a time-critical mission (#11). Self-contained: it reads
 * the always-on session, the live sample and the game store, and renders
 * nothing unless the matched aircraft's live session (SIM_ACTIVE — engines
 * running, whether taxiing at the ramp or airborne) has a time-critical
 * mission armed. The window deadline (`windowEndsAtT`) is stamped by the store
 * when the mission arms at its origin; the clock here is just that deadline
 * minus the latest sample time.
 */
export function ActiveMissionWindow() {
  const game = useGame((s) => s.game)
  const session = useSessionState()
  const sample = session.lastSample

  if (!game || session.phase !== 'SIM_ACTIVE' || !session.aircraftId || !sample) return null

  // Soonest-ending time-critical mission armed by the aircraft in flight.
  const armed = game.armedMissions
    .filter((r) => r.aircraftId === session.aircraftId && r.windowEndsAtT != null)
    .sort((a, b) => (a.windowEndsAtT ?? 0) - (b.windowEndsAtT ?? 0))[0]
  if (!armed) return null
  const mission = game.acceptedMissions.find((m) => m.id === armed.missionId)
  if (!mission || mission.windowMinutes == null) return null

  const from = getAirport(mission.fromIcao)
  const to = getAirport(mission.toIcao)
  const windowMs = mission.windowMinutes * 60_000
  const remainingMs = (armed.windowEndsAtT as number) - sample.t

  const live = { lat: sample.lat, lon: sample.lon, groundKts: sample.groundKts }
  const distanceRemaining = distanceNm(live, to)
  const etaMs = live.groundKts > 5 ? (distanceRemaining / live.groundKts) * 3_600_000 : null
  const marginMs = etaMs !== null ? remainingMs - etaMs : null

  const missed = remainingMs <= 0
  const bounds = new L.LatLngBounds([[from.lat, from.lon], [to.lat, to.lon]])
  const ll = (p: { lat: number; lon: number }): LatLngExpression => [p.lat, p.lon]

  return (
    <div className="card mb">
      <div className="tc-window">
        <div className="tc-map">
          <MapContainer bounds={bounds} boundsOptions={{ padding: [24, 24] }} scrollWheelZoom={false} className="leaflet-root">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              attribution='&copy; OpenStreetMap &copy; CARTO'
            />
            <Polyline positions={[ll(from), ll(to)]} pathOptions={{ color: '#e8b23c', weight: 2, dashArray: '4 6' }} />
            <CircleMarker center={ll(from)} radius={5} pathOptions={{ color: '#e8b23c', fillOpacity: 0.9 }}>
              <Tooltip>{from.icao} · pickup</Tooltip>
            </CircleMarker>
            <CircleMarker center={ll(to)} radius={5} pathOptions={{ color: '#e05a5a', fillOpacity: 0.9 }}>
              <Tooltip>{to.icao} · {to.name}</Tooltip>
            </CircleMarker>
            <Marker position={ll(live)} icon={planeIcon} zIndexOffset={1000}>
              <Tooltip>{live.groundKts.toFixed(0)} kt</Tooltip>
            </Marker>
          </MapContainer>
        </div>

        <div className="tc-figures">
          <span className="badge emergency">⏱ {mission.type === 'ORGAN_TRANSPORT' ? 'Organ' : 'Medevac'}</span>
          <div className="tc-label">Time remaining</div>
          <div className={`tc-clock${missed ? ' missed' : ''}`}>{clock(remainingMs)}</div>
          <div className="tc-bar">
            <i style={{ width: `${Math.max(0, Math.min(100, (remainingMs / windowMs) * 100))}%` }} />
          </div>
          <div className="tc-stat"><span>Destination</span><b>{to.icao}</b></div>
          <div className="tc-stat"><span>Distance left</span><b>{distanceRemaining.toFixed(0)} nm</b></div>
          <div className="tc-stat"><span>Margin</span><b className={marginMs === null ? '' : marginMs < 0 ? 'neg' : 'pos'}>{marginMs !== null ? clock(marginMs) : '—'}</b></div>
          <div className="tc-stat"><span>Window</span><b>{mission.windowMinutes} min</b></div>
        </div>
      </div>
    </div>
  )
}

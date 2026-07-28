import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Polyline,
  Tooltip,
  useMap,
} from 'react-leaflet'
// leaflet has no default export and tsconfig has neither esModuleInterop nor
// allowSyntheticDefaultImports, so import the namespace, not a default binding.
import * as L from 'leaflet'
import type { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useGame } from '../game/store'
import { deriveMapView, regionBounds, type LiveFlight, type MapPoint } from '../game/mapView'
import { simplifyTrack } from '../game/flightlog'
import { useSessionState } from '../sim/useSimSession'
import type { Urgency } from '../game/types'
import { useNav } from './ui'
import { MissionPickerDialog } from './MissionPickerDialog'

const URGENCY_COLOR: Record<Urgency, string> = {
  EMERGENCY: '#e05a5a',
  PRIORITY: '#e8b23c',
  ROUTINE: '#5aa9e0',
}

const homeIcon = L.divIcon({ className: 'map-pin', html: '🏠', iconSize: [24, 24], iconAnchor: [12, 12] })
const pilotIcon = L.divIcon({ className: 'map-pin', html: '🧑‍✈️', iconSize: [26, 26], iconAnchor: [13, 13] })
const planeIcon = L.divIcon({ className: 'map-pin', html: '🛩️', iconSize: [22, 22], iconAnchor: [11, 11] })

const ll = (p: MapPoint): LatLngExpression => [p.lat, p.lon]

function MissionEndpointMarkers({
  points,
  color,
  onSelect,
}: {
  points: [MapPoint, MapPoint]
  color: string
  onSelect: (icao: string) => void
}) {
  return (
    <>
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={ll(p)}
          radius={4}
          pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.9 }}
          eventHandlers={{ click: () => onSelect(p.icao) }}
        >
          <Tooltip>{p.icao} · {p.name}</Tooltip>
        </CircleMarker>
      ))}
    </>
  )
}

function FitBounds({ points, regionId }: { points: MapPoint[]; regionId: string }) {
  const map = useMap()
  // Refit only when the SET of plotted airports (or the region) changes — not
  // on every render. `focusPoints` is a fresh array each render, so depending
  // on it directly would reset the user's pan/zoom whenever the Dashboard
  // re-renders (e.g. a toast or an Advance-day). Keying on the joined ICAO
  // list makes the dependency stable; regionId is included so a future region
  // transfer (no remount) still refits to the new region's fallback bounds.
  const boundsKey = Array.from(new Set(points.map((p) => p.icao))).sort().join(',')
  useEffect(() => {
    // `animate: false` — an instant fit. Animated fits queue a zoom transition
    // whose end-callback can fire after the pane is gone (rapid board refreshes,
    // unmount), throwing inside Leaflet; a data map also reads better snapping.
    if (points.length === 0) {
      map.fitBounds(regionBounds(regionId), { maxZoom: 6, animate: false })
      return
    }
    const bounds = new L.LatLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]))
    // Small pixel padding (not a ratio pad, which over-zooms out) and a maxZoom
    // cap so a tight cluster — or everything sharing one field, e.g. no missions
    // yet — still lands on a sensible regional view instead of street level.
    map.fitBounds(bounds, { padding: [16, 16], maxZoom: 6, animate: false })
  }, [map, boundsKey, regionId])
  return null
}

export function OperationsMap() {
  const game = useGame((s) => s.game)!
  const session = useSessionState()

  // Recorded track points arrive about once a second and the array is only
  // ever appended to, so its length identifies its contents. Keying on the
  // exact length would re-run RDP over the *whole* track every sample, which
  // grows without bound on a long flight (measured ~9 ms at 1 h, ~56 ms at
  // 5 h — every second, on the default tab). Shifting the length right by 4
  // coarsens the key to one re-run per ~16 samples, which amortizes to ~0.6
  // and ~3.5 ms per sample respectively.
  // The visual loss is nil: the trailing ≤16 s of track is a few pixels at any
  // sensible zoom, and the aircraft marker is a separate element outside this
  // memo, so the plane itself still moves at the full sample rate. The same
  // coarsening also means the track stays empty for a flight's first ~16
  // samples (trackChunk is 0 for lengths 0-15) — cosmetic for the same reason,
  // and moot for a flight shorter than that.
  const trackChunk = (session.recorder?.fullTrack.length ?? 0) >> 4
  const liveTrack = useMemo(
    () => simplifyTrack(session.recorder?.fullTrack ?? []).map((p) => ({ lat: p.lat, lon: p.lon })),
    [trackChunk]
  )

  // session.lastSample is the guarded sample (#28); the raw useSim() stream is
  // deliberately NOT read here — it still carries the sim's shutdown zeros.
  const s = session.lastSample
  const live: LiveFlight | undefined =
    session.phase === 'SIM_ACTIVE' && session.aircraftId && s
      ? {
          aircraftId: session.aircraftId,
          lat: s.lat,
          lon: s.lon,
          groundKts: s.groundKts,
          altFt: s.altFt,
          onGround: s.onGround,
          track: liveTrack,
        }
      : undefined

  const view = deriveMapView(game, live)
  const { setTab, setSelectedMissionId } = useNav()
  const [pickerIcao, setPickerIcao] = useState<string | null>(null)

  // Initial view / empty-state fallback: the current region's bounding box.
  const bounds = new L.LatLngBounds(regionBounds(game.regionId))

  // The live position is deliberately excluded: FitBounds keys off this set, and
  // a moving aircraft would re-fit the map every second.
  const focusPoints: MapPoint[] = [
    view.homeBase,
    ...(live ? [] : [view.pilot]),
    ...view.aircraft.filter((a) => !a.live).map((a) => a.point),
    ...view.availableMissions.flatMap((m) => [m.from, m.to]),
    ...view.acceptedMissions.flatMap((m) => [m.from, m.to]),
  ]

  return (
    <div className="card">
      <h3>Operations map</h3>
      <div className="map-wrap">
        <MapContainer bounds={bounds} scrollWheelZoom className="leaflet-root">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <FitBounds points={focusPoints} regionId={game.regionId} />

          {view.airports.map((a) => (
            <CircleMarker
              key={a.icao}
              center={ll(a)}
              radius={a.type === 'hub' ? 4 : a.type === 'strip' ? 2 : 2.5}
              pathOptions={
                a.type === 'strip'
                  ? { color: '#e08a3c', weight: 1, fillOpacity: 0 }
                  : { color: '#64748b', weight: 0, fillOpacity: 0.5 }
              }
            >
              <Tooltip>{a.icao} · {a.name}</Tooltip>
            </CircleMarker>
          ))}

          {view.availableMissions.map((m) => (
            <Fragment key={m.id}>
              <Polyline
                positions={[ll(m.from), ll(m.to)]}
                pathOptions={{ color: URGENCY_COLOR[m.urgency], weight: 2, dashArray: '2 6', opacity: 0.8 }}
                eventHandlers={{ click: () => setPickerIcao(m.to.icao) }}
              >
                <Tooltip>{m.title} · {m.urgency} · {m.from.icao} → {m.to.icao}</Tooltip>
              </Polyline>
              <MissionEndpointMarkers
                points={[m.from, m.to]}
                color={URGENCY_COLOR[m.urgency]}
                onSelect={setPickerIcao}
              />
            </Fragment>
          ))}

          {view.acceptedMissions.map((m) => (
            <Fragment key={m.id}>
              <Polyline
                positions={[ll(m.pilotLeg!.from), ll(m.pilotLeg!.to)]}
                pathOptions={{ color: URGENCY_COLOR[m.urgency], weight: 1.5, dashArray: '6 6', opacity: 0.7 }}
              />
              <Polyline
                positions={[ll(m.from), ll(m.to)]}
                pathOptions={{ color: URGENCY_COLOR[m.urgency], weight: 3.5, opacity: 1 }}
                eventHandlers={{ click: () => setPickerIcao(m.to.icao) }}
              >
                <Tooltip>Accepted · {m.title} · {m.urgency} · {m.from.icao} → {m.to.icao}</Tooltip>
              </Polyline>
              <MissionEndpointMarkers
                points={[m.from, m.to]}
                color={URGENCY_COLOR[m.urgency]}
                onSelect={setPickerIcao}
              />
            </Fragment>
          ))}

          {view.liveTrack && view.liveTrack.length > 1 && (
            <Polyline
              positions={view.liveTrack.map((p) => [p.lat, p.lon] as [number, number])}
              pathOptions={{ color: '#7ee0a0', weight: 2, opacity: 0.9 }}
            />
          )}

          {view.aircraft.map((a, i) => (
            <Marker key={`${a.registration}-${i}`} position={ll(a.point)} icon={planeIcon}>
              <Tooltip>
                {a.registration} ·{' '}
                {a.live
                  ? `${a.live.groundKts.toFixed(0)} kt · ${a.live.altFt.toFixed(0)} ft`
                  : a.point.icao || 'Off-field'}
              </Tooltip>
            </Marker>
          ))}

          <Marker position={ll(view.homeBase)} icon={homeIcon}>
            <Tooltip>Home base · {view.homeBase.icao}</Tooltip>
          </Marker>
          <Marker position={ll(view.pilot)} icon={pilotIcon} zIndexOffset={1000}>
            <Tooltip>Pilot · {view.pilot.icao || (live ? 'In flight' : 'Off-field')}</Tooltip>
          </Marker>
        </MapContainer>
      </div>
      {pickerIcao && (
        <MissionPickerDialog
          icao={pickerIcao}
          onClose={() => setPickerIcao(null)}
          onSelect={(id) => {
            setSelectedMissionId(id)
            setTab('missions')
            setPickerIcao(null)
          }}
        />
      )}
    </div>
  )
}

import { Fragment, useEffect, useState } from 'react'
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
import { deriveMapView, regionBounds, type MapPoint } from '../game/mapView'
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

function FitBounds({ points, fallback }: { points: MapPoint[]; fallback: L.LatLngBoundsExpression }) {
  const map = useMap()
  // Refit only when the SET of plotted airports changes — not on every render.
  // `focusPoints` is a fresh array each render, so depending on it directly would
  // reset the user's pan/zoom whenever the Dashboard re-renders (e.g. a toast or
  // an Advance-day). Keying on the joined ICAO list makes the dependency stable.
  const boundsKey = Array.from(new Set(points.map((p) => p.icao))).sort().join(',')
  useEffect(() => {
    // `animate: false` — an instant fit. Animated fits queue a zoom transition
    // whose end-callback can fire after the pane is gone (rapid board refreshes,
    // unmount), throwing inside Leaflet; a data map also reads better snapping.
    if (points.length === 0) {
      map.fitBounds(fallback, { maxZoom: 6, animate: false })
      return
    }
    const bounds = new L.LatLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]))
    // Small pixel padding (not a ratio pad, which over-zooms out) and a maxZoom
    // cap so a tight cluster — or everything sharing one field, e.g. no missions
    // yet — still lands on a sensible regional view instead of street level.
    map.fitBounds(bounds, { padding: [16, 16], maxZoom: 6, animate: false })
  }, [map, boundsKey])
  return null
}

export function OperationsMap() {
  const game = useGame((s) => s.game)!
  const view = deriveMapView(game)
  const { setTab, setSelectedMissionId } = useNav()
  const [pickerIcao, setPickerIcao] = useState<string | null>(null)

  // Initial view / empty-state fallback: the current region's bounding box.
  const bounds = new L.LatLngBounds(regionBounds(game.regionId))

  const focusPoints: MapPoint[] = [
    view.homeBase,
    view.pilot,
    ...view.aircraft.map((a) => a.point),
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
          <FitBounds points={focusPoints} fallback={bounds} />

          {view.airports.map((a) => (
            <CircleMarker
              key={a.icao}
              center={ll(a)}
              radius={2.5}
              pathOptions={{ color: '#64748b', weight: 0, fillOpacity: 0.5 }}
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

          {view.aircraft.map((a, i) => (
            <Marker key={`${a.registration}-${i}`} position={ll(a.point)} icon={planeIcon}>
              <Tooltip>{a.registration} · {a.point.icao}</Tooltip>
            </Marker>
          ))}

          <Marker position={ll(view.homeBase)} icon={homeIcon}>
            <Tooltip>Home base · {view.homeBase.icao}</Tooltip>
          </Marker>
          <Marker position={ll(view.pilot)} icon={pilotIcon} zIndexOffset={1000}>
            <Tooltip>Pilot · {view.pilot.icao}</Tooltip>
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

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import type { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useGame } from '../game/store'
import { getFlightLog } from '../game/flightLogStorage'
import { money, hoursMinutes } from '../game/format'
import type { FlightLog, FlightLogSummary } from '../game/types'

// Continental Australia, used as the fallback view (same as OperationsMap).
const AUSTRALIA_BOUNDS = new L.LatLngBounds([-44, 112], [-10, 154])

function FitTrack({ log }: { log: FlightLog }) {
  const map = useMap()
  useEffect(() => {
    if (log.track.length === 0) {
      map.fitBounds(AUSTRALIA_BOUNDS, { maxZoom: 6 })
      return
    }
    const bounds = new L.LatLngBounds(log.track.map((p) => [p.lat, p.lon] as [number, number]))
    map.fitBounds(bounds, { padding: [16, 16], maxZoom: 9 })
  }, [map, log.id])
  return null
}

function TrackMap({ log }: { log: FlightLog }) {
  const positions: LatLngExpression[] = log.track.map((p) => [p.lat, p.lon])
  return (
    <div className="map-wrap" style={{ height: 260 }}>
      <MapContainer bounds={AUSTRALIA_BOUNDS} scrollWheelZoom className="leaflet-root">
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <FitTrack log={log} />
        {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#5aa9e0', weight: 3 }} />}
      </MapContainer>
    </div>
  )
}

function routeLabel(summary: FlightLogSummary): string {
  return [summary.startIcao ?? 'unrecognised field', ...summary.intermediates, summary.endIcao ?? 'unrecognised field'].join(' → ')
}

export function Logbook() {
  const game = useGame((s) => s.game)!
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [full, setFull] = useState<FlightLog | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedId) {
      setFull(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getFlightLog(selectedId)
      .then((log) => {
        if (cancelled) return
        setFull(log)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[logbook] could not load flight track', err)
        setFull(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  return (
    <div>
      <div className="card">
        <h2 className="page-title" style={{ marginTop: 0 }}>Flight log ({game.flightLogs.length})</h2>
        {game.flightLogs.length === 0 ? (
          <div className="empty">No recorded flights yet. Complete a flight to see it here.</div>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Day</th>
                <th>Route</th>
                <th style={{ width: 90 }}>Block</th>
                <th style={{ width: 90 }}>Duty</th>
                <th style={{ width: 100 }}>Distance</th>
                <th style={{ textAlign: 'right', width: 120 }}>Earnings</th>
              </tr>
            </thead>
            <tbody>
              {game.flightLogs.map((l) => (
                <tr
                  key={l.id}
                  className={`logbook-row${selectedId === l.id ? ' selected' : ''}`}
                  onClick={() => setSelectedId(l.id === selectedId ? null : l.id)}
                >
                  <td className="muted">{l.day}</td>
                  <td>{routeLabel(l)}</td>
                  <td>{hoursMinutes(l.blockMinutes)}</td>
                  <td>{hoursMinutes(l.dutyMinutes)}</td>
                  <td>{Math.round(l.distanceNm)} nm</td>
                  <td style={{ textAlign: 'right' }} className={`amount ${l.earnings >= 0 ? 'pos' : 'neg'}`}>
                    {money(l.earnings)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Track</h3>
          {loading && <div className="empty">Loading track…</div>}
          {!loading && full && <TrackMap log={full} />}
          {!loading && !full && (
            <div className="empty">Track unavailable for this flight (not saved, or local storage was cleared).</div>
          )}
        </div>
      )}
    </div>
  )
}

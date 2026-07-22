import { useGame } from '../game/store'
import { getAirport } from '../data/airports'
import { missionsAtAirport } from '../game/mapView'
import { money } from '../game/format'

export function MissionPickerDialog({
  icao,
  onSelect,
  onClose,
}: {
  icao: string
  onSelect: (missionId: string) => void
  onClose: () => void
}) {
  const game = useGame((s) => s.game)!
  const airport = getAirport(icao)
  const missions = missionsAtAirport(game, icao)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <span className="badge type">📍 Missions</span>
          <h2 style={{ marginLeft: 4 }}>{airport.icao} · {airport.name}</h2>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <div className="m-body">
          {missions.length === 0 ? (
            <div className="empty">No missions touch this airport right now.</div>
          ) : (
            missions.map((m) => (
              <button key={m.id} className="picker-row" onClick={() => onSelect(m.id)}>
                <span className="pr-title">{m.title}</span>
                <span className="pr-route">{m.fromIcao} → {m.toIcao}</span>
                <span className="pr-reward reward">{money(m.reward)}</span>
                <span className={`badge ${m.status === 'accepted' ? 'type' : 'routine'}`}>{m.status}</span>
              </button>
            ))
          )}
        </div>
        <div className="m-foot">
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

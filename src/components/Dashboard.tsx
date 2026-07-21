import { useGame } from '../game/store'
import { getSpec } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { money, price } from '../game/format'
import { OperationsMap } from './OperationsMap'

export function Dashboard() {
  const game = useGame((s) => s.game)!
  const dailyBurn = game.fleet.reduce((s, a) => s + getSpec(a.specId).dailyFixedCost, 0)
  const emergencies = game.availableMissions.filter((m) => m.urgency === 'EMERGENCY').length

  return (
    <div>
      <h2 className="page-title">Operations overview</h2>
      <div className="grid cols-3 mb">
        <div className="card kpi">
          <span className="k-label">Cash balance</span>
          <span className="k-value" style={{ color: game.balance >= 0 ? 'var(--text)' : 'var(--red)' }}>{money(game.balance)}</span>
          <span className="tiny muted">Daily overheads {money(dailyBurn)}</span>
        </div>
        <div className="card">
          <span className="k-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--faint)' }}>Reputation</span>
          <div className="k-value" style={{ fontSize: 26, fontWeight: 700 }}>{game.reputation.toFixed(0)}<span className="tiny muted"> / 100</span></div>
          <div className="meter rep mt"><span style={{ width: `${game.reputation}%` }} /></div>
        </div>
        <div className="card kpi">
          <span className="k-label">Operating day</span>
          <span className="k-value">Day {game.day}</span>
          <span className="tiny muted">{game.acceptedMissions.length} active · {emergencies} emergencies waiting</span>
        </div>
      </div>

      <div className="grid cols-3 mb">
        <div className="card kpi"><span className="k-label">Missions completed</span><span className="k-value" style={{ color: 'var(--green)' }}>{game.stats.missionsCompleted}</span></div>
        <div className="card kpi"><span className="k-label">Missions failed</span><span className="k-value" style={{ color: game.stats.missionsFailed ? 'var(--red)' : 'var(--text)' }}>{game.stats.missionsFailed}</span></div>
        <div className="card kpi"><span className="k-label">Hours flown</span><span className="k-value">{game.stats.hoursFlown.toFixed(1)}</span></div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Fuel prices</h3>
          <div className="facts mission mt">
            <span>Avgas <b>{price(game.fuel.AVGAS)}</b>/L</span>
            <span>Jet A-1 <b>{price(game.fuel.JETA)}</b>/L</span>
          </div>
          <p className="tiny muted mt">Prices drift a little each day. Fuel is billed from your reported burn.</p>
        </div>
        <div className="card">
          <h3>Fleet at a glance</h3>
          {game.fleet.length === 0 ? (
            <p className="tiny muted mt">No aircraft yet — visit the Market.</p>
          ) : (
            <div className="mt" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {game.fleet.map((a) => {
                const spec = getSpec(a.specId)
                const loc = getAirport(a.locationIcao)
                return (
                  <div className="spread tiny" key={a.id}>
                    <span><b>{a.registration}</b> <span className="muted">{spec.name}</span></span>
                    <span className="muted">📍 {loc.icao} · {a.condition.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt">
        <OperationsMap />
      </div>
    </div>
  )
}

import { useGame } from '../game/store'
import { getSpec } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { money, price, FUEL_LABEL } from '../game/format'
import { rankFor, rankProgress } from '../game/progression'
import { OperationsMap } from './OperationsMap'

export function Dashboard() {
  const game = useGame((s) => s.game)!
  const operator = useGame((s) => s.operator)
  const dailyBurn = game.fleet.reduce((s, a) => s + getSpec(a.specId).dailyFixedCost, 0)
  const emergencies = game.availableMissions.filter((m) => m.urgency === 'EMERGENCY').length
  const xp = operator?.xp ?? 0
  const rank = rankFor(xp)
  const progress = rankProgress(xp)

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

      <div className="card mb">
        <div className="spread">
          <div>
            <span className="k-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--faint)' }}>Pilot rank</span>
            <div className="k-value" style={{ fontSize: 22, fontWeight: 700 }}>{rank.title}</div>
          </div>
          <div className="tiny muted" style={{ textAlign: 'right' }}>
            {xp.toLocaleString()} XP
            {progress.next ? <><br />{progress.toNext.toLocaleString()} XP to {progress.next.title}</> : <><br />Top rank reached</>}
          </div>
        </div>
        <div className="meter rep mt"><span style={{ width: `${Math.round(progress.pct * 100)}%` }} /></div>
        <p className="tiny muted mt">Experience carries with you across region transfers.</p>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Fuel prices</h3>
          <div className="facts mission mt">
            <span>{FUEL_LABEL.AVGAS} <b>{price(game.fuel.AVGAS)}</b>/L</span>
            <span>{FUEL_LABEL.JETA} <b>{price(game.fuel.JETA)}</b>/L</span>
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

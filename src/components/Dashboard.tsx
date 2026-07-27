import { useGame } from '../game/store'
import { getSpec } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { money, price, FUEL_LABEL } from '../game/format'
import { rankFor, rankProgress } from '../game/progression'
import { dutyStatus, isOverAnyLimit } from '../game/duty'
import { GALLONS_TO_LITRES } from '../game/flightlog'
import { useSessionState } from '../sim/useSimSession'
import { useSim } from '../sim/useSim'
import { OperationsMap } from './OperationsMap'

export function Dashboard() {
  const game = useGame((s) => s.game)!
  const operator = useGame((s) => s.operator)
  const dailyBurn = game.fleet.reduce((s, a) => s + getSpec(a.specId).dailyFixedCost, 0)
  const emergencies = game.availableMissions.filter((m) => m.urgency === 'EMERGENCY').length
  const xp = operator?.xp ?? 0
  const rank = rankFor(xp)
  const progress = rankProgress(xp)
  const duty = dutyStatus(game.dutyLog, game.day)
  const DUTY_LABEL: Record<number, string> = { 1: 'Today', 7: '7 days', 14: '14 days', 28: '28 days' }
  const session = useSessionState()
  const { sample } = useSim()
  const liveAc = game.fleet.find((a) => a.id === session.aircraftId)

  return (
    <div>
      <h2 className="page-title">Operations overview</h2>
      {session.phase === 'SIM_ACTIVE' && sample && liveAc && (
        <div className="card mb">
          <div className="spread">
            <h3 style={{ margin: 0 }}>✈ Live flight — {liveAc.registration}</h3>
            {isOverAnyLimit(game.dutyLog, game.day) && (
              <span className="badge warn">Duty limit exceeded — rewards forfeited</span>
            )}
          </div>
          <div className="facts mission mt">
            <span>{sample.onGround ? 'GND' : 'AIR'} · <b>{sample.groundKts.toFixed(0)}</b> kt · <b>{sample.altFt.toFixed(0)}</b> ft</span>
            <span>Fuel <b>{(sample.fuelGal * GALLONS_TO_LITRES).toFixed(0)}</b> L (live)</span>
            <span>Legs <b>{session.recorder?.legs.length ?? 0}</b> · Landings <b>{session.recorder?.landings ?? 0}</b></span>
            <span>Underway <b>{game.armedMissions.length}</b> mission{game.armedMissions.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      )}
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

      <div className="card mb">
        <h3>Duty time</h3>
        <div className="grid cols-4 mt">
          {duty.map((d) => {
            // Truncate to 0.1 h (never round up — 599 min must not read as 10.0 h
            // and imply the player is at the limit when they are still under it).
            const usedH = (Math.floor(d.used / 6) / 10).toFixed(1)
            const limitH = (d.limit / 60).toFixed(0)
            const pct = Math.min(100, (d.used / d.limit) * 100)
            return (
              <div key={d.days}>
                <span className="k-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--faint)' }}>
                  {DUTY_LABEL[d.days]}
                </span>
                <div className="k-value" style={{ fontSize: 18, fontWeight: 700, color: d.over ? 'var(--red)' : 'var(--text)' }}>
                  {usedH}<span className="tiny muted"> / {limitH} h</span>
                </div>
                <div className="meter rep mt">
                  <span style={{ width: `${pct}%`, background: d.over ? 'var(--red)' : undefined }} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="tiny muted mt">Duty = block time + 30 min per stop. Flying over a limit withholds reward.</p>
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

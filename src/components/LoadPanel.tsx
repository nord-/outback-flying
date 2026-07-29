import { useGame } from '../game/store'
import { getAirport } from '../data/airports'
import { loadedKg, missionPayload, planLoad, payoutRatio } from '../game/payload'
import { useSessionState } from '../sim/useSimSession'
import type { Mission } from '../game/types'

/**
 * Live load readout (#33). Renders only when a sim aircraft is matched and there
 * are accepted missions departing where it sits — the moment the player can
 * still do something about the loading. Missions not yet underway are shown with
 * `planLoad`'s verdict, which is the SAME function the store's arming gate runs,
 * fed the SAME committed-weight figure (R3, #33 review) — cargo this aircraft
 * already has armed from an earlier engine start, on any route — so what is
 * displayed here is what will actually happen at the next engine start.
 * Missions already underway are shown against the load locked at liftoff.
 */
export function LoadPanel() {
  const game = useGame((s) => s.game)
  const session = useSessionState()
  const sample = session.lastSample
  const ac = game?.fleet.find((a) => a.id === session.aircraftId)
  if (!game || !ac || !sample) return null

  // An off-field aircraft has no missions it can act on — the player must
  // reposition first (store.ts's flyMission rejects it outright), and its
  // `locationIcao` is deliberately stale in that state, naming an earlier
  // field rather than where it sits. Predicting arming against that field
  // would be a confident lie, so the panel stays silent instead.
  if (ac.offField) return null

  const aboard = loadedKg(sample)
  const here = game.acceptedMissions.filter((m) => m.fromIcao === ac.locationIcao)
  if (here.length === 0) return null

  const armedForAc = game.armedMissions.filter((r) => r.aircraftId === ac.id)
  const armedIds = new Set(armedForAc.map((r) => r.missionId))
  // What this aircraft already has armed is physically aboard on EVERY route,
  // not just the ones departing from here (R3, #33 review) — the same total
  // armInto computes, so the panel predicts exactly the gate it feeds.
  const committedKg = armedForAc.reduce((sum, r) => {
    const m = game.acceptedMissions.find((mm) => mm.id === r.missionId)
    return m ? sum + missionPayload(m).totalKg : sum
  }, 0)
  const pending = here.filter((m) => !armedIds.has(m.id))
  const plan = planLoad(pending, aboard, committedKg)
  const underway = here.filter((m) => armedIds.has(m.id))
  const lockedKg = (m: Mission) =>
    game.armedMissions.find((r) => r.missionId === m.id && r.aircraftId === ac.id)?.loadedKg ?? null

  const byRoute = new Map<string, typeof plan>()
  for (const entry of plan) {
    const key = entry.mission.toIcao
    const group = byRoute.get(key)
    if (group) group.push(entry)
    else byRoute.set(key, [entry])
  }

  return (
    <div className="card mb">
      <div className="spread">
        <h3 style={{ margin: 0 }}>⚖ Load — {ac.registration}</h3>
        <span className="badge type">
          {aboard === null ? 'Load unknown' : `${Math.round(aboard)} kg aboard`}
        </span>
      </div>

      {aboard === null && (
        <div className="tiny muted mt">
          The simulator is not reporting usable weights — every mission here will be treated as correctly
          loaded.
        </div>
      )}

      {committedKg > 0 && (
        <div className="tiny muted mt">
          {Math.round(committedKg)} kg already committed to missions underway —{' '}
          {aboard === null ? 'free load unknown' : `${Math.round(Math.max(0, aboard - committedKg))} kg free`}.
        </div>
      )}

      {[...byRoute.entries()].map(([toIcao, entries]) => (
        <div key={toIcao} className="mt">
          <div className="tiny muted">
            {ac.locationIcao} → {toIcao} {getAirport(toIcao).name}
          </div>
          {entries.map((e) => {
            // Raw `aboard`, not the committed-adjusted budget planLoad judged
            // arming against — correct only because arming (R5, #33 review)
            // guarantees any entry with `arms: true` and committedKg > 0 has
            // requiredKg <= aboard - committedKg + tolerance, so its ratio is
            // 1; the short-and-arming case only happens at committedKg === 0.
            // Revisit this if the arming rule ever changes.
            const ratio = payoutRatio(e.requiredKg, aboard)
            return (
              <div key={e.mission.id} className="facts">
                <span>{e.mission.title}</span>
                <span>
                  needs <b>{e.requiredKg} kg</b>
                </span>
                {e.arms && ratio === 1 && <span style={{ color: 'var(--green)' }}>will arm</span>}
                {e.arms && ratio < 1 && (
                  <span style={{ color: 'var(--amber)' }}>
                    ⚠ short {Math.round(e.requiredKg - (aboard ?? 0))} kg — pays {Math.floor(ratio * 100)}%
                  </span>
                )}
                {!e.arms && (
                  <span style={{ color: 'var(--red)' }}>
                    ✗ will not arm — {e.cumulativeKg} kg needed for this route
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {underway.map((m) => {
        const locked = lockedKg(m)
        const ratio = payoutRatio(missionPayload(m).totalKg, locked)
        return (
          <div key={m.id} className="facts mt">
            <span>{m.title}</span>
            <span className="muted">
              underway · {locked === null ? 'load unmeasured' : `${Math.round(locked)} kg locked`}
            </span>
            {ratio < 1 && <span style={{ color: 'var(--amber)' }}>pays {Math.floor(ratio * 100)}%</span>}
          </div>
        )
      })}
    </div>
  )
}

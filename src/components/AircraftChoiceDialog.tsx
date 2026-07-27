import { useGame } from '../game/store'
import { getSpec } from '../data/aircraft'
import { useSessionState } from '../sim/useSimSession'

/** D1: several same-type aircraft share the pilot's position — ask which one
 *  the sim is flying. The choice sticks until disconnect. */
export function AircraftChoiceDialog({ choose }: { choose: (aircraftId: string) => void }) {
  const session = useSessionState()
  const game = useGame((s) => s.game)
  if (!game || !session.pendingChoice) return null
  const options = session.pendingChoice
    .map((id) => game.fleet.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a)

  return (
    <div className="overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <span className="badge type">🛩 Which aircraft?</span>
          <h2 style={{ marginLeft: 4 }}>Several match</h2>
        </div>
        <div className="m-body">
          <p className="tiny muted" style={{ margin: 0 }}>
            More than one of your aircraft of this type is parked here. Pick the one you're flying —
            the choice holds until the sim disconnects.
          </p>
          <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {options.map((a) => (
              <button key={a.id} className="btn" onClick={() => choose(a.id)}>
                {a.registration} — {getSpec(a.specId).name} · {a.fuelL.toFixed(0)} L · cond {a.condition.toFixed(0)}%
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

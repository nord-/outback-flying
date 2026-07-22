import { useState } from 'react'
import { useGame } from '../game/store'
import { STARTER_OPTIONS, DEFAULT_STARTER, getSpec } from '../data/aircraft'
import { money, FUEL_LABEL } from '../game/format'

export function StartScreen() {
  const newGame = useGame((s) => s.newGame)
  const [name, setName] = useState('')
  const [specId, setSpecId] = useState(DEFAULT_STARTER)

  // specId state is only ever set to a valid STARTER_OPTIONS id (initial DEFAULT_STARTER), so find always hits.
  const chosen = STARTER_OPTIONS.find((o) => o.specId === specId)!
  const chosenSpec = getSpec(chosen.specId)

  return (
    <div className="start">
      <div className="panel">
        <div className="logo-big">🛩️</div>
        <h1>Outback Flying</h1>
        <p className="tagline">
          Run a flying-doctor operation across the Australian outback. The game hands you
          missions and keeps the books — <b>you</b> fly every leg in the simulator of your
          choice, then report the flight when you land.
        </p>
        <div className="field mb">
          <label htmlFor="co">Name your operation</label>
          <input
            id="co"
            value={name}
            placeholder="e.g. Red Centre Air Rescue"
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newGame(name, specId)}
          />
        </div>

        <div className="field mb">
          <label>Choose your first aircraft</label>
          <div className="grid auto">
            {STARTER_OPTIONS.map((o) => {
              const spec = getSpec(o.specId)
              const selected = o.specId === specId
              return (
                <button
                  type="button"
                  key={o.specId}
                  className={`card starter${selected ? ' selected' : ''}`}
                  onClick={() => setSpecId(o.specId)}
                  aria-pressed={selected}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                >
                  <div className="spread">
                    <div>
                      <h3>{spec.name}</h3>
                      <div className="sub">{spec.category}</div>
                    </div>
                    <span className="pill">{FUEL_LABEL[spec.fuelType]}</span>
                  </div>
                  <div className="facts mission" style={{ marginTop: 12 }}>
                    <span><b>{spec.seats}</b> seats</span>
                    <span><b>{spec.cruiseKts}</b> kt cruise</span>
                    <span><b>{spec.rangeNm}</b> nm range</span>
                  </div>
                  <div className="kpi mt">
                    <span className="k-label">Day-1 balance</span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: o.startingBalance < 0 ? 'var(--red)' : undefined,
                      }}
                    >
                      {money(o.startingBalance)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
          <span className="hint">
            You'll start at Alice Springs (YBAS). Your aircraft is provided free — a cheaper
            aircraft leaves you more operating cash, a pricier one starts you closer to (or in) debt.
          </span>
        </div>

        <button
          className="btn primary"
          style={{ width: '100%' }}
          onClick={() => newGame(name, specId)}
        >
          Start operation with the {chosenSpec.name} · {money(chosen.startingBalance)}
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useGame } from '../game/store'
import { getSpec } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { money, FUEL_LABEL } from '../game/format'
import type { OwnedAircraft } from '../game/types'
import { RepositionModal } from './RepositionModal'

function conditionColor(c: number): string {
  if (c >= 70) return 'var(--green)'
  if (c >= 40) return 'var(--amber)'
  return 'var(--red)'
}

function repairCost(specCost: number, condition: number): number {
  return Math.round(specCost * 0.0009 * (100 - condition))
}

function AircraftCard({ ac, onReposition }: { ac: OwnedAircraft; onReposition: (a: OwnedAircraft) => void }) {
  const game = useGame((s) => s.game)!
  const repair = useGame((s) => s.repairAircraft)
  const sell = useGame((s) => s.sellAircraft)
  const spec = getSpec(ac.specId)
  const loc = getAirport(ac.locationIcao)
  const rCost = repairCost(spec.purchaseCost, ac.condition)
  const resale = Math.round(spec.purchaseCost * 0.7 * (ac.condition / 100))

  return (
    <div className="card">
      <div className="spread">
        <div>
          <h3>{ac.registration}</h3>
          <div className="sub">{spec.name} · {spec.category}</div>
        </div>
        <span className="pill">{FUEL_LABEL[spec.fuelType]}</span>
      </div>

      <div className="facts mission" style={{ marginTop: 12 }}>
        <span>📍 <b>{loc.icao}</b> {loc.name}</span>
        <span>{spec.seats} seats · {spec.cruiseKts} kt · {spec.rangeNm} nm</span>
        <span>{ac.hoursFlown.toFixed(1)} h flown</span>
      </div>

      <div className="mt mb">
        <div className="spread tiny muted"><span>Condition</span><span style={{ color: conditionColor(ac.condition) }}>{ac.condition.toFixed(0)}%</span></div>
        <div className="meter"><span style={{ width: `${ac.condition}%`, background: conditionColor(ac.condition) }} /></div>
      </div>

      <div className="actions">
        <button className="btn sm" onClick={() => onReposition(ac)}>Reposition</button>
        <button
          className="btn sm"
          disabled={ac.condition >= 100 || game.balance < rCost}
          title={ac.condition >= 100 ? 'Airworthy' : `Repair to 100% for ${money(rCost)}`}
          onClick={() => repair(ac.id)}
        >
          {ac.condition >= 100 ? 'Airworthy' : `Repair (${money(rCost)})`}
        </button>
        <button
          className="btn danger sm"
          onClick={() => {
            if (confirm(`Sell ${ac.registration} for ${money(resale)}?`)) sell(ac.id)
          }}
        >
          Sell ({money(resale)})
        </button>
      </div>
    </div>
  )
}

export function Fleet() {
  const fleet = useGame((s) => s.game!.fleet)
  const [repositioning, setRepositioning] = useState<OwnedAircraft | null>(null)

  return (
    <div>
      <h2 className="page-title">Your fleet ({fleet.length})</h2>
      {fleet.length === 0 ? (
        <div className="empty">You have no aircraft. Buy one from the Market tab.</div>
      ) : (
        <div className="grid auto">
          {fleet.map((ac) => (
            <AircraftCard key={ac.id} ac={ac} onReposition={setRepositioning} />
          ))}
        </div>
      )}
      {repositioning && (
        <RepositionModal aircraft={repositioning} onClose={() => setRepositioning(null)} />
      )}
    </div>
  )
}

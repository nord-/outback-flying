import { useMemo, useState } from 'react'
import { useGame } from '../game/store'
import { useUI } from './ui'
import { getSpec } from '../data/aircraft'
import { AIRPORTS, getAirport } from '../data/airports'
import { distanceNm } from '../game/geo'
import {
  fuelCost,
  maintenanceCost,
  suggestedBlockMinutes,
  suggestedFuelLitres,
} from '../game/economy'
import { money, price } from '../game/format'
import type { OwnedAircraft } from '../game/types'

export function RepositionModal({ aircraft, onClose }: { aircraft: OwnedAircraft; onClose: () => void }) {
  const game = useGame((s) => s.game)!
  const reposition = useGame((s) => s.repositionAircraft)
  const { notify } = useUI()
  const spec = getSpec(aircraft.specId)
  const from = getAirport(aircraft.locationIcao)

  const destinations = useMemo(
    () =>
      AIRPORTS.filter((a) => a.icao !== aircraft.locationIcao)
        .map((a) => ({ a, dist: Math.round(distanceNm(from, a)) }))
        .filter((d) => d.dist <= spec.rangeNm)
        .sort((x, y) => x.dist - y.dist),
    [aircraft.locationIcao, from, spec.rangeNm]
  )

  const [toIcao, setToIcao] = useState(destinations[0]?.a.icao ?? '')
  const dest = destinations.find((d) => d.a.icao === toIcao)
  const dist = dest?.dist ?? 0
  const sBlock = suggestedBlockMinutes(dist, spec.cruiseKts)
  const sFuel = suggestedFuelLitres(sBlock, spec.burnLph)

  const [block, setBlock] = useState(String(sBlock))
  const [fuel, setFuel] = useState(String(sFuel))
  const [err, setErr] = useState('')
  const [lastTo, setLastTo] = useState(toIcao)
  if (toIcao !== lastTo) {
    setLastTo(toIcao)
    setBlock(String(sBlock))
    setFuel(String(sFuel))
  }

  const fuelPrice = game.fuel[spec.fuelType]
  const cost = fuelCost(Number(fuel) || 0, fuelPrice) + maintenanceCost(Number(block) || 0, spec.maintPerHour)

  const submit = () => {
    const res = reposition(aircraft.id, toIcao, Math.round(Number(block)), Math.round(Number(fuel)))
    if (!res.ok) return setErr(res.message)
    notify(res.message)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <span className="badge type">⇄ Reposition (ferry)</span>
          <h2 style={{ marginLeft: 4 }}>{aircraft.registration}</h2>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <div className="m-body">
          <p className="tiny muted" style={{ margin: 0 }}>
            Ferry {spec.name} from <b>{from.icao} {from.name}</b> with no fare — you pay fuel and
            maintenance only. Fly it in your sim, then report the leg.
          </p>
          <div className="field">
            <label>Destination (within {spec.rangeNm} nm range)</label>
            <select value={toIcao} onChange={(e) => setToIcao(e.target.value)}>
              {destinations.map((d) => (
                <option key={d.a.icao} value={d.a.icao}>
                  {d.a.icao} {d.a.name} — {d.dist} nm
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <div className="field">
              <label>Block time (minutes)</label>
              <input type="number" min={1} value={block} onChange={(e) => setBlock(e.target.value)} />
              <span className="hint">Suggested {sBlock} min</span>
            </div>
            <div className="field">
              <label>Fuel used (litres, {spec.fuelType})</label>
              <input type="number" min={0} value={fuel} onChange={(e) => setFuel(e.target.value)} />
              <span className="hint">Suggested {sFuel} L @ {price(fuelPrice)}/L</span>
            </div>
          </div>
          <div className="summary-box">
            <div className="line total"><span>Estimated cost</span><span className="amount neg">-{money(cost)}</span></div>
          </div>
          {err && <div className="notice err">{err}</div>}
        </div>
        <div className="m-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!toIcao} onClick={submit}>Complete ferry</button>
        </div>
      </div>
    </div>
  )
}

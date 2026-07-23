import { useState } from 'react'
import { useGame } from '../game/store'
import { AIRCRAFT_SPECS } from '../data/aircraft'
import { basesInRegion } from '../data/airports'
import { useUI } from './ui'
import { money, FUEL_LABEL } from '../game/format'

export function Market() {
  const game = useGame((s) => s.game)!
  const buy = useGame((s) => s.buyAircraft)
  const { notify } = useUI()
  const bases = basesInRegion(game.regionId)
  const [base, setBase] = useState(bases[0].icao)

  return (
    <div>
      <div className="spread mb">
        <h2 className="page-title" style={{ margin: 0 }}>Aircraft market</h2>
        <div className="field" style={{ minWidth: 260 }}>
          <label className="tiny">Deliver new aircraft to</label>
          <select value={base} onChange={(e) => setBase(e.target.value)}>
            {bases.map((b) => (
              <option key={b.icao} value={b.icao}>{b.icao} — {b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid auto">
        {AIRCRAFT_SPECS.map((spec) => {
          const afford = game.balance >= spec.purchaseCost
          return (
            <div className="card" key={spec.id}>
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
                <span><b>{spec.burnLph}</b> L/h burn</span>
                <span>Maint <b>{money(spec.maintPerHour)}</b>/h</span>
                <span>Daily <b>{money(spec.dailyFixedCost)}</b></span>
              </div>
              <div className="spread mt">
                <div className="kpi">
                  <span className="k-label">Price</span>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{money(spec.purchaseCost)}</span>
                </div>
                <button
                  className="btn primary"
                  disabled={!afford}
                  onClick={() => {
                    const res = buy(spec.id, base)
                    notify(res.message)
                  }}
                >
                  {afford ? 'Buy' : 'Insufficient funds'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

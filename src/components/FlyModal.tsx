import { useMemo, useState } from 'react'
import { useGame } from '../game/store'
import { useUI } from './ui'
import { getSpec } from '../data/aircraft'
import { getAirport } from '../data/airports'
import {
  fuelCost,
  maintenanceCost,
  suggestedBlockMinutes,
  suggestedFuelLitres,
} from '../game/economy'
import { money, price, signedMoney, FUEL_LABEL } from '../game/format'
import type { Mission } from '../game/types'

export function FlyModal({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  const game = useGame((s) => s.game)!
  const flyMission = useGame((s) => s.flyMission)
  const { notify } = useUI()

  const from = getAirport(mission.fromIcao)
  const to = getAirport(mission.toIcao)

  // Aircraft that are physically at the departure airport and capable.
  const eligible = useMemo(
    () =>
      game.fleet
        .map((a) => ({ a, spec: getSpec(a.specId) }))
        .filter(
          ({ a, spec }) =>
            a.locationIcao === mission.fromIcao &&
            spec.seats >= mission.seatsRequired &&
            spec.rangeNm >= mission.distanceNm
        ),
    [game.fleet, mission]
  )

  const [aircraftId, setAircraftId] = useState(eligible[0]?.a.id ?? '')
  const selected = eligible.find((e) => e.a.id === aircraftId)

  const suggested = selected
    ? {
        block: suggestedBlockMinutes(mission.distanceNm, selected.spec.cruiseKts),
        fuel: suggestedFuelLitres(
          suggestedBlockMinutes(mission.distanceNm, selected.spec.cruiseKts),
          selected.spec.burnLph
        ),
      }
    : { block: 0, fuel: 0 }

  const [block, setBlock] = useState(String(suggested.block))
  const [fuel, setFuel] = useState(String(suggested.fuel))
  const [landings, setLandings] = useState('1')
  const [err, setErr] = useState('')

  // Re-seed suggestions when the aircraft changes.
  const [lastAc, setLastAc] = useState(aircraftId)
  if (aircraftId !== lastAc && selected) {
    setLastAc(aircraftId)
    setBlock(String(suggested.block))
    setFuel(String(suggested.fuel))
  }

  const blockN = Number(block)
  const fuelN = Number(fuel)
  const fuelPrice = selected ? game.fuel[selected.spec.fuelType] : 0
  const fCost = selected ? fuelCost(fuelN || 0, fuelPrice) : 0
  const mCost = selected ? maintenanceCost(blockN || 0, selected.spec.maintPerHour) : 0
  const net = mission.reward - fCost - mCost

  const submit = () => {
    setErr('')
    const res = flyMission({
      missionId: mission.id,
      aircraftId,
      blockMinutes: Math.round(blockN),
      fuelLitres: Math.round(fuelN),
      landings: Number(landings),
    })
    if (!res.ok) {
      setErr(res.message)
      return
    }
    notify(res.message)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <span className="badge type">✈ File flight report</span>
          <h2 style={{ marginLeft: 4 }}>{mission.title}</h2>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <div className="m-body">
          <div className="mission facts">
            <span><b>{from.icao}</b> {from.name} → <b>{to.icao}</b> {to.name}</span>
            <span><b>{mission.distanceNm}</b> nm</span>
            <span>Seats needed <b>{mission.seatsRequired}</b></span>
            <span>Reward <b className="reward">{money(mission.reward)}</b></span>
          </div>

          {eligible.length === 0 ? (
            <div className="notice err">
              No eligible aircraft at {from.icao}. You need an aircraft parked there with at least{' '}
              {mission.seatsRequired} seat(s) and {mission.distanceNm} nm range. Reposition one from the Fleet tab.
            </div>
          ) : (
            <>
              <div className="field">
                <label>Aircraft (at {from.icao})</label>
                <select value={aircraftId} onChange={(e) => setAircraftId(e.target.value)}>
                  {eligible.map(({ a, spec }) => (
                    <option key={a.id} value={a.id}>
                      {a.registration} — {spec.name} · {spec.cruiseKts} kt · cond {a.condition.toFixed(0)}%
                    </option>
                  ))}
                </select>
              </div>

              <p className="tiny muted" style={{ margin: 0 }}>
                Fly the leg in your simulator, then enter what actually happened. Suggested figures are pre-filled.
              </p>

              <div className="row">
                <div className="field">
                  <label>Block time (minutes)</label>
                  <input type="number" min={1} value={block} onChange={(e) => setBlock(e.target.value)} />
                  <span className="hint">Suggested {suggested.block} min</span>
                </div>
                <div className="field">
                  <label>Fuel used (litres, {selected && FUEL_LABEL[selected.spec.fuelType]})</label>
                  <input type="number" min={0} value={fuel} onChange={(e) => setFuel(e.target.value)} />
                  <span className="hint">Suggested {suggested.fuel} L @ {price(fuelPrice)}/L</span>
                </div>
                <div className="field" style={{ maxWidth: 110 }}>
                  <label>Landings</label>
                  <input type="number" min={1} value={landings} onChange={(e) => setLandings(e.target.value)} />
                </div>
              </div>

              <div className="summary-box">
                <div className="line"><span>Mission reward</span><span className="amount pos">{signedMoney(mission.reward)}</span></div>
                <div className="line"><span>Fuel ({fuelN || 0} L)</span><span className="amount neg">{signedMoney(-fCost)}</span></div>
                <div className="line"><span>Maintenance</span><span className="amount neg">{signedMoney(-mCost)}</span></div>
                <div className="line total"><span>Estimated net</span><span className={net >= 0 ? 'amount pos' : 'amount neg'}>{signedMoney(net)}</span></div>
                {game.day > mission.expiresDay && (
                  <div className="tiny" style={{ color: 'var(--red)', marginTop: 6 }}>
                    ⚠ Past deadline (day {mission.expiresDay}). A late penalty of {money(mission.penalty)} will apply.
                  </div>
                )}
              </div>

              {err && <div className="notice err">{err}</div>}
            </>
          )}
        </div>
        <div className="m-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={eligible.length === 0} onClick={submit}>
            Complete flight
          </button>
        </div>
      </div>
    </div>
  )
}

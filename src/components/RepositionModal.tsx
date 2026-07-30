import { useMemo, useState } from 'react'
import { useGame } from '../game/store'
import { useUI } from './ui'
import { getSpec } from '../data/aircraft'
import { airportsInRegion, getAirport } from '../data/airports'
import { distanceNm } from '../game/geo'
import {
  maintenanceCost,
  suggestedBlockMinutes,
  suggestedFuelLitres,
} from '../game/economy'
import { fieldSuitability, requiredRunwayM, MARGIN_OK } from '../game/fields'
import { money, fieldSummary, SURFACE_LABEL, FUEL_LABEL } from '../game/format'
import { computeDutyMinutes } from '../game/flightlog'
import { wouldBeOver, isOverAnyLimit } from '../game/duty'
import type { OwnedAircraft } from '../game/types'

export function RepositionModal({ aircraft, onClose }: { aircraft: OwnedAircraft; onClose: () => void }) {
  const game = useGame((s) => s.game)!
  const reposition = useGame((s) => s.repositionAircraft)
  const { notify } = useUI()
  const spec = getSpec(aircraft.specId)
  const fromPos = aircraft.offField ?? getAirport(aircraft.locationIcao)
  const fromLabel = aircraft.offField
    ? `off-field (${aircraft.offField.lat.toFixed(2)}, ${aircraft.offField.lon.toFixed(2)})`
    : `${getAirport(aircraft.locationIcao).icao} ${getAirport(aircraft.locationIcao).name}`

  const destinations = useMemo(
    () =>
      airportsInRegion(game.regionId)
        .filter((a) => aircraft.offField || a.icao !== aircraft.locationIcao)
        .map((a) => ({ a, dist: Math.round(distanceNm(fromPos, a)) }))
        .filter((d) => d.dist <= spec.rangeNm)
        .sort((x, y) => x.dist - y.dist),
    [game.regionId, aircraft.locationIcao, aircraft.offField, fromPos, spec.rangeNm]
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

  const cost = maintenanceCost(Number(block) || 0, spec.maintPerHour)
  const ferryDutyEst = computeDutyMinutes(Number(block) || 0, 1)
  const dutyAlreadyOver = isOverAnyLimit(game.dutyLog, game.day)
  const dutyWouldExceed = wouldBeOver(game.dutyLog, game.day, ferryDutyEst)

  const suitability = dest ? fieldSuitability(dest.a, spec) : null
  // The runway needed to clear the *current* band: the short-threshold when
  // short, but the ok-threshold when merely marginal — otherwise the copy
  // reads as self-contradictory ("has 863 m, wants 863 m" while still warning).
  const wantsM = dest
    ? Math.round(requiredRunwayM(spec, dest.a.surface) * (suitability === 'marginal' ? MARGIN_OK : 1))
    : 0

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
            Ferry {spec.name} from <b>{fromLabel}</b> with no fare — you pay fuel and
            maintenance only. Fly it in your sim, then report the leg.
          </p>
          <div className="field">
            <label>Destination (within {spec.rangeNm} nm range)</label>
            <select value={toIcao} onChange={(e) => setToIcao(e.target.value)}>
              {destinations.map((d) => (
                <option key={d.a.icao} value={d.a.icao}>
                  {d.a.icao} {d.a.name} — {d.dist} nm · {fieldSummary(d.a)}
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
              <label>Fuel used (litres, {FUEL_LABEL[spec.fuelType]})</label>
              <input type="number" min={0} value={fuel} onChange={(e) => setFuel(e.target.value)} />
              <span className="hint">Suggested {sFuel} L · tank {aircraft.fuelL.toFixed(0)} L</span>
            </div>
          </div>
          <div className="summary-box">
            <div className="line total"><span>Estimated cost</span><span className="amount neg">-{money(cost)}</span></div>
            {(dutyAlreadyOver || dutyWouldExceed) && (
              <div className="tiny" style={{ color: 'var(--red)', marginTop: 6 }}>
                ⚠ {dutyAlreadyOver
                  ? 'You are already over a duty-time limit — this ferry adds to it.'
                  : 'This ferry will put you over a duty-time limit.'}
              </div>
            )}
            {dest && suitability && suitability !== 'ok' && (
              <div
                className="tiny"
                style={{
                  color: suitability === 'short' || suitability === 'unknown' ? 'var(--red)' : 'var(--amber)',
                  marginTop: 6,
                }}
              >
                {suitability === 'unknown' ? (
                  <>⚠ {dest.a.icao}'s runway data is unverified — it may be unlandable. Plan an alternate.</>
                ) : (
                  <>
                    ⚠ {dest.a.icao} has {dest.a.runwayM} m of {SURFACE_LABEL[dest.a.surface]}; {spec.name} wants{' '}
                    {wantsM} m.{' '}
                    {suitability === 'short'
                      ? 'Too short — expect heavy wear on landing.'
                      : 'Marginal — expect some extra wear.'}
                  </>
                )}
              </div>
            )}
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

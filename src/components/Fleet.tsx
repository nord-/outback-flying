import { useState } from 'react'
import { useGame } from '../game/store'
import { useSessionState } from '../sim/useSimSession'
import { getSpec } from '../data/aircraft'
import { getAirport, airportOffersFuel } from '../data/airports'
import { simCapacityL, GALLONS_TO_LITRES, nearestAirport } from '../game/flightlog'
import { distanceNm } from '../game/geo'
import { money, FUEL_LABEL } from '../game/format'
import type { OwnedAircraft, GeoPos } from '../game/types'
import { RepositionModal } from './RepositionModal'
import { RefuelModal } from './RefuelModal'

function conditionColor(c: number): string {
  if (c >= 70) return 'var(--green)'
  if (c >= 40) return 'var(--amber)'
  return 'var(--red)'
}

function repairCost(specCost: number, condition: number): number {
  return Math.round(specCost * 0.0009 * (100 - condition))
}

function offFieldLabel(pos: GeoPos, regionId: string): string {
  const near = nearestAirport(pos.lat, pos.lon, regionId, 10_000) // no tolerance cap — nearest whatever the distance
  return near ? `${Math.round(distanceNm(pos, near))} nm from ${near.icao}` : `${pos.lat.toFixed(2)}, ${pos.lon.toFixed(2)}`
}

function AircraftCard({
  ac,
  onReposition,
  onRefuel,
}: {
  ac: OwnedAircraft
  onReposition: (a: OwnedAircraft) => void
  onRefuel: (a: OwnedAircraft) => void
}) {
  const game = useGame((s) => s.game)!
  const repair = useGame((s) => s.repairAircraft)
  const sell = useGame((s) => s.sellAircraft)
  const session = useSessionState()
  // session.lastSample is the guarded sample (#28); the raw useSim() stream is
  // deliberately NOT read here — it still carries the sim's shutdown zeros,
  // which would zero the capacity and the live fuel readout.
  const sample = session.lastSample
  const spec = getSpec(ac.specId)
  const loc = getAirport(ac.locationIcao)
  const rCost = repairCost(spec.purchaseCost, ac.condition)
  const resale = Math.round(spec.purchaseCost * 0.7 * (ac.condition / 100))
  const simCapL = simCapacityL(spec, sample)
  const capacityL = simCapL ?? spec.fuelCapacityL
  const isMatched = session.aircraftId === ac.id && session.phase !== 'UNMATCHED'
  const liveFuelL = isMatched && sample ? sample.fuelGal * GALLONS_TO_LITRES : null
  const shownFuelL = liveFuelL ?? ac.fuelL
  const canFuel = !ac.offField && airportOffersFuel(ac.locationIcao, spec.fuelType)
  const toFull = Math.max(0, Math.round(capacityL - ac.fuelL))
  const fuelPct = capacityL > 0 ? Math.min(100, (shownFuelL / capacityL) * 100) : 0
  const inFlight = session.aircraftId === ac.id && session.phase === 'SIM_ACTIVE'

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
        {ac.offField ? (
          <span>📍 <b>Off-field</b> {offFieldLabel(ac.offField, game.regionId)}</span>
        ) : (
          <span>📍 <b>{loc.icao}</b> {loc.name}</span>
        )}
        <span>{spec.seats} seats · {spec.cruiseKts} kt · {spec.rangeNm} nm</span>
        <span>{ac.hoursFlown.toFixed(1)} h flown</span>
      </div>

      <div className="mt mb">
        <div className="spread tiny muted"><span>Condition</span><span style={{ color: conditionColor(ac.condition) }}>{ac.condition.toFixed(0)}%</span></div>
        <div className="meter"><span style={{ width: `${ac.condition}%`, background: conditionColor(ac.condition) }} /></div>
      </div>

      <div className="mt mb">
        <div className="spread tiny muted"><span>Fuel ({FUEL_LABEL[spec.fuelType]}){liveFuelL !== null ? ' · LIVE' : ''}</span><span>{shownFuelL.toFixed(0)} / {capacityL.toFixed(0)} L</span></div>
        <div className="meter"><span style={{ width: `${fuelPct}%`, background: 'var(--blue, #5aa9e0)' }} /></div>
      </div>

      <div className="actions">
        <button
          className="btn sm"
          disabled={inFlight}
          title={inFlight ? 'This aircraft is flying in the sim — its flight books itself.' : undefined}
          onClick={() => onReposition(ac)}
        >
          Reposition
        </button>
        <button
          className="btn sm"
          disabled={ac.condition >= 100 || game.balance < rCost}
          title={ac.condition >= 100 ? 'Airworthy' : `Repair to 100% for ${money(rCost)}`}
          onClick={() => repair(ac.id)}
        >
          {ac.condition >= 100 ? 'Airworthy' : `Repair (${money(rCost)})`}
        </button>
        <button
          className="btn sm"
          disabled={!canFuel || toFull === 0}
          title={ac.offField ? 'No fuel service off-field' : !canFuel ? `No ${FUEL_LABEL[spec.fuelType]} at ${loc.icao}` : toFull === 0 ? 'Tank full' : `Refuel (up to ${toFull} L)`}
          onClick={() => onRefuel(ac)}
        >
          {canFuel ? (toFull === 0 ? 'Tank full' : 'Refuel...') : 'No fuel here'}
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
  const [refuelling, setRefuelling] = useState<OwnedAircraft | null>(null)

  return (
    <div>
      <h2 className="page-title">Your fleet ({fleet.length})</h2>
      {fleet.length === 0 ? (
        <div className="empty">You have no aircraft. Buy one from the Market tab.</div>
      ) : (
        <div className="grid auto">
          {fleet.map((ac) => (
            <AircraftCard key={ac.id} ac={ac} onReposition={setRepositioning} onRefuel={setRefuelling} />
          ))}
        </div>
      )}
      {repositioning && (
        <RepositionModal aircraft={repositioning} onClose={() => setRepositioning(null)} />
      )}
      {refuelling && (
        <RefuelModal aircraft={refuelling} onClose={() => setRefuelling(null)} />
      )}
    </div>
  )
}

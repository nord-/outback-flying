import { useState } from 'react'
import { useGame } from '../game/store'
import { useUI } from './ui'
import { useSim } from '../sim/useSim'
import { useSessionState } from '../sim/useSimSession'
import { getSpec } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { simCapacityL, GALLONS_TO_LITRES } from '../game/flightlog'
import { refuelCost } from '../game/economy'
import { money, FUEL_LABEL } from '../game/format'
import type { OwnedAircraft } from '../game/types'

export function RefuelModal({ aircraft, onClose }: { aircraft: OwnedAircraft; onClose: () => void }) {
  const game = useGame((s) => s.game)!
  const refuel = useGame((s) => s.refuel)
  const { notify } = useUI()
  const { sample } = useSim()
  const session = useSessionState()
  const spec = getSpec(aircraft.specId)
  const airport = getAirport(aircraft.locationIcao)

  const simCapL = simCapacityL(spec, sample)
  const capacityL = simCapL ?? spec.fuelCapacityL
  const isMatched = session.aircraftId === aircraft.id && session.phase !== 'UNMATCHED'
  const currentFuelL = isMatched && sample ? sample.fuelGal * GALLONS_TO_LITRES : aircraft.fuelL

  // The store's overfill guard clamps against ac.fuelL (the game-authoritative
  // level) with only 0.5 L slop, while the sim's live reading can sit a few
  // litres below it (per-tank write quantization) or transiently above it
  // while the divergence watcher's correction is in flight. Compute room to
  // fill from whichever level is higher so the Max button never trips the
  // store's "would overfill" rejection.
  const effectiveFuelL = Math.max(aircraft.fuelL, currentFuelL)
  const toFull = Math.max(0, Math.round(capacityL - effectiveFuelL))

  const [litres, setLitres] = useState(0)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const previewLitres = Math.min(litres, Math.max(0, capacityL - effectiveFuelL))
  const previewCost = refuelCost(previewLitres, game.fuel[spec.fuelType], airport.fuelPriceMult)

  const engineBlocked = isMatched && session.phase !== 'GROUND_SECURE'

  const submit = () => {
    if (submitting) return
    setSubmitting(true)
    const res = refuel(aircraft.id, litres, simCapL)
    if (!res.ok) {
      setErr(res.message)
      setSubmitting(false)
      return
    }
    notify(res.message)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <span className="badge type">⛽ Refuel</span>
          <h2 style={{ marginLeft: 4 }}>{aircraft.registration}</h2>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <div className="m-body">
          <p className="tiny muted" style={{ margin: 0 }}>
            Load {FUEL_LABEL[spec.fuelType]} into {spec.name} at <b>{airport.icao} {airport.name}</b>.
          </p>
          <div className="field">
            <div className="spread tiny muted">
              <span>Litres to add</span>
              <span>
                {litres} L{' '}
                <button
                  className="btn ghost sm"
                  style={{ marginLeft: 6 }}
                  onClick={() => {
                    setLitres(toFull)
                    setErr('')
                  }}
                >
                  Max
                </button>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={toFull}
              step={1}
              value={litres}
              onChange={(e) => {
                setLitres(Number(e.target.value))
                setErr('')
              }}
            />
            <span className="hint">Tank {currentFuelL.toFixed(0)} / {capacityL.toFixed(0)} L</span>
          </div>
          <div className="summary-box">
            <div className="line total"><span>Estimated cost</span><span className="amount neg">-{money(previewCost)}</span></div>
          </div>
          {engineBlocked && <div className="notice warn">Shut down all engines on the ground to refuel.</div>}
          {err && <div className="notice err">{err}</div>}
        </div>
        <div className="m-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={litres === 0 || submitting || engineBlocked} onClick={submit}>
            {submitting ? 'Syncing…' : 'Refuel'}
          </button>
        </div>
      </div>
    </div>
  )
}

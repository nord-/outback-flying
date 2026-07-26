import { useMemo, useState } from 'react'
import { useGame } from '../game/store'
import { useUI } from './ui'
import { useFlightRecorder } from '../sim/useFlightRecorder'
import { getSpec } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { matchesAircraft } from '../game/flightlog'
import {
  fuelCost,
  maintenanceCost,
  suggestedBlockMinutes,
  suggestedFuelLitres,
} from '../game/economy'
import { money, price, signedMoney, FUEL_LABEL } from '../game/format'
import type { Mission } from '../game/types'

type Mode = 'manual' | 'record'

export function FlyModal({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  const game = useGame((s) => s.game)!
  const flyMission = useGame((s) => s.flyMission)
  const commitFlightLog = useGame((s) => s.commitFlightLog)
  const { notify } = useUI()
  const recorder = useFlightRecorder()

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

  const [mode, setMode] = useState<Mode>('manual')

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
  const [recordErr, setRecordErr] = useState('')

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

  // Whether we actually have grounds to verify the sim aircraft against this
  // spec. A spec with no simMatch keywords can never "match" (see
  // matchesAircraft), so treating that as a confirmed mismatch would be a
  // false positive — there's just no data to check against.
  const canVerifyAircraft = !!selected?.spec.simMatch?.length

  const finishRecording = () => {
    setRecordErr('')
    const derived = recorder.finish()
    if (!derived) {
      setRecordErr("No completed landing yet — keep flying until you've landed, then finish the flight.")
      return
    }
    if (
      selected &&
      canVerifyAircraft &&
      !matchesAircraft(selected.spec, { title: derived.simAircraftTitle, atcModel: derived.simAtcModel })
    ) {
      setRecordErr(
        `The simulator reports "${derived.simAtcModel || derived.simAircraftTitle}", which doesn't look like the selected ${selected.spec.name}. Start a new recording in the correct aircraft, or pick the fleet aircraft that matches what you actually flew.`
      )
      return
    }
    const res = commitFlightLog({ derived, aircraftId, missionId: mission.id })
    if (!res.ok) {
      setRecordErr(res.message)
      return
    }
    notify(res.message)
    onClose()
  }

  // Live heads-up while recording, ahead of the harder block at Finish —
  // issue #9's "be forgiving" still applies: only surfaced when the spec has
  // simMatch keywords to actually verify against (see canVerifyAircraft).
  const aircraftMismatch =
    mode === 'record' && recorder.sample && selected && canVerifyAircraft && !matchesAircraft(selected.spec, recorder.sample)

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

              {recorder.simAvailable && (
                <div className="mode-toggle">
                  <button
                    type="button"
                    className={`btn sm ${mode === 'manual' ? 'primary' : 'ghost'}`}
                    onClick={() => setMode('manual')}
                  >
                    Manual entry
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${mode === 'record' ? 'primary' : 'ghost'}`}
                    onClick={() => setMode('record')}
                  >
                    Record with SimConnect
                  </button>
                </div>
              )}

              {mode === 'manual' ? (
                <>
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
              ) : (
                <div className="record-panel">
                  <div className={`sim-chip ${recorder.simStatus}`}>
                    <span className="sim-dot" />
                    <span className="sim-label">
                      {recorder.simStatus === 'connected'
                        ? 'Sim connected'
                        : recorder.simStatus === 'connecting'
                        ? 'Connecting…'
                        : 'Sim not connected — connect from the header chip first'}
                    </span>
                  </div>

                  {aircraftMismatch && (
                    <div className="notice warn">
                      ⚠ The simulator reports "{recorder.sample!.atcModel || recorder.sample!.title}", which doesn't
                      look like the selected {selected!.spec.name}. Recording will continue, but finishing the
                      flight will be blocked unless this clears up — pick the fleet aircraft that matches what
                      you're actually flying.
                    </div>
                  )}

                  {recorder.phase === 'idle' ? (
                    <button
                      className="btn primary"
                      disabled={recorder.simStatus !== 'connected'}
                      onClick={() => recorder.start(game.regionId)}
                    >
                      Start recording
                    </button>
                  ) : (
                    <>
                      <div className="summary-box">
                        <div className="line"><span>Legs completed</span><span>{recorder.snapshot.legsCompleted}</span></div>
                        <div className="line"><span>Landings</span><span>{recorder.snapshot.landings}</span></div>
                        <div className="line">
                          <span>Status</span>
                          <span>
                            {recorder.snapshot.isAirborne
                              ? 'Airborne'
                              : recorder.snapshot.isOnLeg
                              ? 'On the ground (leg in progress)'
                              : 'Between legs'}
                          </span>
                        </div>
                        {recorder.sample && (
                          <div className="line">
                            <span>Live</span>
                            <span>
                              {recorder.sample.onGround ? 'GND' : 'AIR'} · {recorder.sample.groundKts.toFixed(0)} kt ·{' '}
                              {recorder.sample.altFt.toFixed(0)} ft
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="row" style={{ marginTop: 10 }}>
                        <button className="btn ghost" onClick={recorder.cancel}>
                          Cancel recording
                        </button>
                        <button className="btn primary" onClick={finishRecording}>
                          Finish flight
                        </button>
                      </div>
                      {recordErr && <div className="notice err">{recordErr}</div>}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {mode === 'manual' && (
          <div className="m-foot">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={eligible.length === 0} onClick={submit}>
              Complete flight
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

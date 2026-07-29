import { useEffect, useRef, useState } from 'react'
import { useGame, MISSION_BOARD_STEPS } from '../game/store'
import { getAirport, classifyFuel } from '../data/airports'
import { getSpec } from '../data/aircraft'
import { estimateProfit, URGENCY_MULT } from '../game/economy'
import { missionTypeLabel, isTimeCritical } from '../game/missions'
import { missionPayload } from '../game/payload'
import { money, URGENCY_LABEL, FUEL_LABEL, fieldSummary } from '../game/format'
import { bearingDeg, compass } from '../game/geo'
import { estimateDutyMinutes, wouldBeOver, isOverAnyLimit } from '../game/duty'
import type { Mission } from '../game/types'
import { FlyModal } from './FlyModal'
import { OperationsMap } from './OperationsMap'
import { LoadPanel } from './LoadPanel'
import { useNav } from './ui'
import { useSim } from '../sim/useSim'

function deadlineText(m: Mission, day: number): { text: string; warn: boolean } {
  const left = m.expiresDay - day
  if (left < 0) return { text: 'Overdue', warn: true }
  if (left === 0) return { text: 'Due today', warn: true }
  if (left === 1) return { text: '1 day left', warn: true }
  return { text: `${left} days left`, warn: false }
}

function MissionCard({
  m,
  accepted,
  onFly,
  highlighted,
  cardRef,
  simAvailable,
}: {
  m: Mission
  accepted: boolean
  onFly: (m: Mission) => void
  highlighted: boolean
  cardRef: (el: HTMLDivElement | null) => void
  simAvailable: boolean
}) {
  const game = useGame((s) => s.game)!
  const accept = useGame((s) => s.acceptMission)
  const abandon = useGame((s) => s.abandonMission)
  const dismiss = useGame((s) => s.dismissMission)

  const from = getAirport(m.fromIcao)
  const to = getAirport(m.toIcao)
  const dir = compass(bearingDeg(from, to))
  const dl = deadlineText(m, game.day)
  const load = missionPayload(m)

  // Best-case profit estimate across the fleet (cheapest capable aircraft).
  const capable = game.fleet
    .map((a) => getSpec(a.specId))
    .filter((s) => s.seats >= m.seatsRequired && s.rangeNm >= m.distanceNm)
  const bestProfit = capable.length
    ? Math.max(...capable.map((s) => estimateProfit(m, s, game.fuel[s.fuelType] * getAirport(m.fromIcao).fuelPriceMult)))
    : null

  // Fuel-availability marker: dormant today (every field offers both fuel
  // types), but lights up once no-fuel/limited-fuel strips exist (#5).
  const fleetFuelTypes = Array.from(new Set(game.fleet.map((a) => getSpec(a.specId).fuelType)))
  const fuelWarnings = fleetFuelTypes.flatMap((ft) => {
    const notes: string[] = []
    for (const [label, icao] of [['origin', m.fromIcao], ['destination', m.toIcao]] as const) {
      const status = classifyFuel(getAirport(icao).fuelTypes, ft)
      if (status === 'no-fuel') notes.push(`⚠ No fuel at ${label} (${icao}) — plan return fuel.`)
      else if (status === 'wrong-type') notes.push(`⚠ Only other fuel at ${label} (${icao}) — no ${FUEL_LABEL[ft]}.`)
    }
    return notes
  })

  // Best-case (fastest capable owned aircraft) duty estimate. Warn only if even
  // the best case would breach a limit — the player cannot avoid it.
  const bestDutyEst = capable.length
    ? Math.min(...capable.map((s) => estimateDutyMinutes(m.distanceNm, s.cruiseKts)))
    : null
  const dutyAlreadyOver = isOverAnyLimit(game.dutyLog, game.day)
  const acceptWouldExceed =
    dutyAlreadyOver || (bestDutyEst !== null && wouldBeOver(game.dutyLog, game.day, bestDutyEst))
  const [confirmingAccept, setConfirmingAccept] = useState(false)
  const [confirmingDismiss, setConfirmingDismiss] = useState(false)

  return (
    <div className={`card mission${highlighted ? ' highlight' : ''}`} ref={cardRef}>
      <div className="head">
        <span className={`badge ${m.urgency.toLowerCase()}`}>{URGENCY_LABEL[m.urgency]}</span>
        <span className="badge type">{missionTypeLabel(m.type)}</span>
        {isTimeCritical(m) && <span className="badge emergency">⏱ Time-critical</span>}
        <span className="pill" style={dl.warn ? { color: 'var(--red)', borderColor: 'rgba(224,90,90,0.4)' } : {}}>
          {dl.text}
        </span>
      </div>
      <div className="route">{from.icao} {from.name} → {to.icao} {to.name}</div>
      <div className="desc">{m.description}</div>
      <div className="facts">
        <span><b>{m.distanceNm}</b> nm {dir}</span>
        <span>Seats <b>{m.seatsRequired}</b></span>
        <span>
          Load <b>{load.totalKg} kg</b>
          <span className="muted">
            {' '}
            ({m.seatsRequired} PAX {load.paxKg} kg{load.cargoKg > 0 ? ` + ${load.cargoKg} kg freight` : ''})
          </span>
        </span>
        <span>Reward <b className="reward">{money(m.reward)}</b></span>
        <span>×{URGENCY_MULT[m.urgency]} urgency</span>
        {bestProfit !== null && (
          <span>Est. net <b style={{ color: bestProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(bestProfit)}</b></span>
        )}
        <span className="muted">{to.icao} {fieldSummary(to)}</span>
      </div>
      {fuelWarnings.length > 0 && (
        <div className="fuel-warn tiny" style={{ color: 'var(--amber)', marginTop: 6 }}>
          {fuelWarnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
      <div className="actions">
        {accepted ? (
          <>
            {isTimeCritical(m) ? (
              <span className="pill" title="Time-critical: books itself when you fly it in the simulator with SimConnect connected.">
                ⏱ Books via SimConnect
              </span>
            ) : (
              <button className="btn primary sm" onClick={() => onFly(m)}>Fly this leg</button>
            )}
            <button className="btn danger sm" onClick={() => abandon(m.id)}>Abandon</button>
          </>
        ) : confirmingAccept ? (
          <div className="notice warn" style={{ width: '100%' }}>
            ⚠ {dutyAlreadyOver
              ? 'You are already over a duty-time limit — flying this earns no reward.'
              : 'This will put you over a duty-time limit — 50% of the reward will be withheld.'}
            <div className="actions mt">
              <button className="btn danger sm" onClick={() => { accept(m.id); setConfirmingAccept(false) }}>Accept anyway</button>
              <button className="btn ghost sm" onClick={() => setConfirmingAccept(false)}>Cancel</button>
            </div>
          </div>
        ) : confirmingDismiss ? (
          <div className="notice warn" style={{ width: '100%' }}>
            ⚠ Turning down a call-out costs 1 reputation. The slot fills with a new posting when you advance the day.
            <div className="actions mt">
              <button className="btn danger sm" onClick={() => { dismiss(m.id); setConfirmingDismiss(false) }}>Dismiss anyway</button>
              <button className="btn ghost sm" onClick={() => setConfirmingDismiss(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {isTimeCritical(m) && !simAvailable ? (
              <span className="pill" title="Time-critical missions can only be flown in the desktop app with SimConnect — accepting one here would be a guaranteed penalty.">
                ⏱ Requires SimConnect
              </span>
            ) : (
              <button
                className="btn primary sm"
                onClick={() => (acceptWouldExceed ? setConfirmingAccept(true) : accept(m.id))}
              >
                Accept
              </button>
            )}
            <button className="btn ghost sm" onClick={() => setConfirmingDismiss(true)}>Dismiss</button>
          </>
        )}
      </div>
    </div>
  )
}

export function Missions() {
  const game = useGame((s) => s.game)!
  const [flying, setFlying] = useState<Mission | null>(null)
  // One subscription for the whole board (not one per card): the SimConnect
  // bridge is only present in the desktop build, so this gates accepting a
  // time-critical mission that couldn't otherwise be flown (#11).
  const { available: simAvailable } = useSim()
  const setBoardTarget = useGame((s) => s.setMissionBoardTarget)

  const { selectedMissionId, setSelectedMissionId } = useNav()
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const highlightTimeout = useRef<number | null>(null)

  // When the map hands us a mission, scroll it into view and flash it.
  // Guard the case where the id has no matching card (e.g. it expired between
  // click and render): just clear the selection without touching a ref.
  // The fade timeout is (re)armed here too — selectedMissionId always cycles
  // through null between picks, so this fires even for the same mission id
  // twice in a row, unlike keying a separate effect off highlightId.
  useEffect(() => {
    if (!selectedMissionId) return
    const el = cardRefs.current.get(selectedMissionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(selectedMissionId)
      if (highlightTimeout.current) window.clearTimeout(highlightTimeout.current)
      highlightTimeout.current = window.setTimeout(() => setHighlightId(null), 2000)
    }
    setSelectedMissionId(null)
  }, [selectedMissionId, setSelectedMissionId])

  useEffect(() => {
    return () => {
      if (highlightTimeout.current) window.clearTimeout(highlightTimeout.current)
    }
  }, [])

  const registerCard = (id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }

  // Sort available by urgency then reward.
  const order = { EMERGENCY: 0, PRIORITY: 1, ROUTINE: 2 } as const
  const available = [...game.availableMissions].sort(
    (a, b) => order[a.urgency] - order[b.urgency] || b.reward - a.reward
  )
  const accepted = [...game.acceptedMissions].sort((a, b) => a.expiresDay - b.expiresDay)

  return (
    <div>
      <div className="mb">
        <OperationsMap />
      </div>
      <LoadPanel />
      <h2 className="page-title">Accepted — flight log ({accepted.length})</h2>
      {accepted.length === 0 ? (
        <div className="empty">No accepted missions. Take one from the board below.</div>
      ) : (
        <div className="grid auto">
          {accepted.map((m) => (
            <MissionCard
              key={m.id}
              m={m}
              accepted
              onFly={setFlying}
              highlighted={highlightId === m.id}
              cardRef={registerCard(m.id)}
              simAvailable={simAvailable}
            />
          ))}
        </div>
      )}

      <div className="spread" style={{ marginTop: 26 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Mission board ({available.length})</h2>
        <div className="actions">
          <span className="tiny muted">Board size</span>
          {MISSION_BOARD_STEPS.map((n) => (
            <button
              key={n}
              className={`btn sm ${n === game.missionBoardTarget ? 'primary' : 'ghost'}`}
              onClick={() => setBoardTarget(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {available.length === 0 ? (
        <div className="empty">The board is empty. Advance the day to see new call-outs.</div>
      ) : (
        <div className="grid auto">
          {available.map((m) => (
            <MissionCard
              key={m.id}
              m={m}
              accepted={false}
              onFly={setFlying}
              highlighted={highlightId === m.id}
              cardRef={registerCard(m.id)}
              simAvailable={simAvailable}
            />
          ))}
        </div>
      )}

      {flying && <FlyModal mission={flying} onClose={() => setFlying(null)} />}
    </div>
  )
}

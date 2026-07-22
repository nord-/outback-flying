import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { getAirport } from '../data/airports'
import { getSpec } from '../data/aircraft'
import { estimateProfit, URGENCY_MULT } from '../game/economy'
import { missionTypeLabel } from '../game/missions'
import { money, URGENCY_LABEL } from '../game/format'
import { bearingDeg, compass } from '../game/geo'
import type { Mission } from '../game/types'
import { FlyModal } from './FlyModal'
import { useNav } from './ui'

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
}: {
  m: Mission
  accepted: boolean
  onFly: (m: Mission) => void
  highlighted: boolean
  cardRef: (el: HTMLDivElement | null) => void
}) {
  const game = useGame((s) => s.game)!
  const accept = useGame((s) => s.acceptMission)
  const abandon = useGame((s) => s.abandonMission)

  const from = getAirport(m.fromIcao)
  const to = getAirport(m.toIcao)
  const dir = compass(bearingDeg(from, to))
  const dl = deadlineText(m, game.day)

  // Best-case profit estimate across the fleet (cheapest capable aircraft).
  const capable = game.fleet
    .map((a) => getSpec(a.specId))
    .filter((s) => s.seats >= m.seatsRequired && s.rangeNm >= m.distanceNm)
  const bestProfit = capable.length
    ? Math.max(...capable.map((s) => estimateProfit(m, s, game.fuel[s.fuelType])))
    : null

  return (
    <div className={`card mission${highlighted ? ' highlight' : ''}`} ref={cardRef}>
      <div className="head">
        <span className={`badge ${m.urgency.toLowerCase()}`}>{URGENCY_LABEL[m.urgency]}</span>
        <span className="badge type">{missionTypeLabel(m.type)}</span>
        <span className="pill" style={dl.warn ? { color: 'var(--red)', borderColor: 'rgba(224,90,90,0.4)' } : {}}>
          {dl.text}
        </span>
      </div>
      <div className="route">{from.icao} {from.name} → {to.icao} {to.name}</div>
      <div className="desc">{m.description}</div>
      <div className="facts">
        <span><b>{m.distanceNm}</b> nm {dir}</span>
        <span>Seats <b>{m.seatsRequired}</b></span>
        <span>Reward <b className="reward">{money(m.reward)}</b></span>
        <span>×{URGENCY_MULT[m.urgency]} urgency</span>
        {bestProfit !== null && (
          <span>Est. net <b style={{ color: bestProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(bestProfit)}</b></span>
        )}
      </div>
      <div className="actions">
        {accepted ? (
          <>
            <button className="btn primary sm" onClick={() => onFly(m)}>Fly this leg</button>
            <button className="btn danger sm" onClick={() => abandon(m.id)}>Abandon</button>
          </>
        ) : (
          <button className="btn primary sm" onClick={() => accept(m.id)}>Accept</button>
        )}
      </div>
    </div>
  )
}

export function Missions() {
  const game = useGame((s) => s.game)!
  const [flying, setFlying] = useState<Mission | null>(null)

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
            />
          ))}
        </div>
      )}

      <h2 className="page-title" style={{ marginTop: 26 }}>Mission board ({available.length})</h2>
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
            />
          ))}
        </div>
      )}

      {flying && <FlyModal mission={flying} onClose={() => setFlying(null)} />}
    </div>
  )
}

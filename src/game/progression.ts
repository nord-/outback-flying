import type { Mission, Urgency } from './types'

export interface Rank {
  title: string
  minXp: number
}

// Career ranks, ascending. The current rank is the highest whose minXp
// the operator has reached. XP and rank persist with the operator across
// region transfers.
export const RANKS: Rank[] = [
  { title: 'Cadet', minXp: 0 },
  { title: 'Junior Pilot', minXp: 500 },
  { title: 'Line Pilot', minXp: 1500 },
  { title: 'Senior Pilot', minXp: 3500 },
  { title: 'Captain', minXp: 7000 },
  { title: 'Chief Pilot', minXp: 12000 },
  { title: 'Director of Flying', minXp: 20000 },
]

const XP_URGENCY: Record<Urgency, number> = {
  ROUTINE: 5,
  PRIORITY: 12,
  EMERGENCY: 25,
}

/** Experience earned for completing a mission. */
export function xpForMission(m: Mission): number {
  return Math.round(m.distanceNm / 10 + XP_URGENCY[m.urgency] + m.seatsRequired * 3)
}

export function rankFor(xp: number): Rank {
  let current = RANKS[0]
  for (const r of RANKS) if (xp >= r.minXp) current = r
  return current
}

export function nextRank(xp: number): Rank | null {
  return RANKS.find((r) => r.minXp > xp) ?? null
}

/** Progress (0..1) toward the next rank, and the xp remaining to reach it. */
export function rankProgress(xp: number): { pct: number; toNext: number; next: Rank | null } {
  const cur = rankFor(xp)
  const next = nextRank(xp)
  if (!next) return { pct: 1, toNext: 0, next: null }
  const span = next.minXp - cur.minXp
  return { pct: (xp - cur.minXp) / span, toNext: next.minXp - xp, next }
}

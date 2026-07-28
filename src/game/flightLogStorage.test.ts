// fake-indexeddb/auto installs a working IndexedDB on the global object so
// this exercises the real IndexedDB path (jsdom ships none).
import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { saveFlightLog, getFlightLog, deleteFlightLog } from './flightLogStorage'
import type { FlightLog } from './types'

let seq = 0
const freshLog = (over: Partial<FlightLog> = {}): FlightLog => ({
  id: `fl-${seq++}`,
  day: 3,
  aircraftId: 'ac1',
  simAircraftTitle: 'Black Square A36TC Bonanza Professional N3475M',
  simAtcModel: 'Bonanza',
  legs: [{ fromIcao: 'YBAS', toIcao: 'YBHI', blockMinutes: 120, flightMinutes: 100, distanceNm: 635, fuelUsedL: 90 }],
  startIcao: 'YBAS',
  endIcao: 'YBHI',
  intermediates: [],
  blockMinutes: 120,
  flightMinutes: 100,
  dutyMinutes: 180,
  distanceNm: 635,
  fuelUsedL: 90,
  landings: 1,
  earnings: 4200,
  track: [{ t: 0, lat: -23.8, lon: 133.9, hdg: 90, gs: 150, alt: 6500, onGround: false }],
  ...over,
})

describe('flightLogStorage', () => {
  it('round-trips a full flight log, track included', async () => {
    const log = freshLog()
    await saveFlightLog(log)
    const loaded = await getFlightLog(log.id)
    expect(loaded).toEqual(log)
  })

  it('drops Null Island track points on read (#28)', async () => {
    // The exact coordinates recovered from the real #28 save: the sim reports
    // an all-but-zero position while it unloads the aircraft, and tracks
    // recorded before the guard landed still carry those points.
    const real = { t: 0, lat: -23.8, lon: 133.9, hdg: 90, gs: 150, alt: 6500, onGround: false }
    const nullIsland = {
      t: 1,
      lat: 0.0004074894422501528,
      lon: 0.013974503360709429,
      hdg: 0,
      gs: 0,
      alt: 0,
      onGround: true,
    }
    const log = freshLog({ track: [real, nullIsland] })
    await saveFlightLog(log)
    const loaded = await getFlightLog(log.id)
    expect(loaded?.track).toEqual([real])
  })

  it('returns null for an unknown id', async () => {
    expect(await getFlightLog('does-not-exist')).toBeNull()
  })

  it('deletes a stored log', async () => {
    const log = freshLog()
    await saveFlightLog(log)
    await deleteFlightLog(log.id)
    expect(await getFlightLog(log.id)).toBeNull()
  })

  it('stores multiple logs independently', async () => {
    const a = freshLog({ startIcao: 'YBAS' })
    const b = freshLog({ startIcao: 'YPAD' })
    await saveFlightLog(a)
    await saveFlightLog(b)
    expect((await getFlightLog(a.id))?.startIcao).toBe('YBAS')
    expect((await getFlightLog(b.id))?.startIcao).toBe('YPAD')
  })
})

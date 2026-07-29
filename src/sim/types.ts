// Types for the SimConnect bridge (issue #9, Phase 1). These describe the
// `window.outback.sim` surface exposed by electron/preload.js. The bridge is
// present only in the Electron desktop build; the web build has no `window.outback`.

/** A single live sample streamed from the simulator (~1×/s). */
export interface SimSample {
  t: number // epoch ms when the sample was read in the main process
  lat: number // degrees
  lon: number // degrees
  headingTrue: number // degrees
  groundKts: number // groundspeed, knots
  altFt: number // indicated altitude, feet
  onGround: boolean
  fuelGal: number // total fuel quantity, gallons
  title: string // full sim aircraft title (livery/add-on string)
  atcModel: string // ATC model — the clean family name, preferred for matching
  fuelCapacityGal: number // total fuel capacity, gallons
  enginesOn: boolean // any of GENERAL ENG COMBUSTION:1..4 — false once all engines are shut down
  // Payload weights (#33). Kilograms straight from the bridge so no layer above
  // has to convert. `pilotStationWeight:1` is the pilot seat by sim convention —
  // game/payload.ts subtracts it so the pilot is never counted as cargo.
  totalKg: number // TOTAL WEIGHT
  emptyKg: number // EMPTY WEIGHT — dry, no fuel, no payload
  fuelKg: number // FUEL TOTAL QUANTITY WEIGHT
  pilotStationKg: number // PAYLOAD STATION WEIGHT:1
}

/** Renderer-facing connection status. 'unavailable' is web-build only. */
export type SimConnStatus = 'unavailable' | 'disconnected' | 'connecting' | 'connected' | 'error'

/** Status transitions the main-process bridge emits (never 'unavailable'). */
export interface SimStatusEvent {
  status: Exclude<SimConnStatus, 'unavailable'>
  message?: string
}

export type SimProtocol = 'FSX_RTM' | 'FSX_SP1' | 'FSX_SP2' | 'KittyHawk' | 'SunRise'

export interface SimConnectOptions {
  protocol?: SimProtocol
  host?: string
  port?: number
  timeoutMs?: number
}

export interface SimConnectResult {
  ok: boolean
  appName?: string
  message?: string
  alreadyConnected?: boolean
}

/** The `window.outback.sim` API surface. */
export interface OutbackSim {
  connect: (options?: SimConnectOptions) => Promise<SimConnectResult>
  disconnect: () => Promise<{ ok: boolean }>
  getStatus: () => Promise<{ status: SimStatusEvent['status'] }>
  /** Write the loaded aircraft's fuel so its total matches `litres` (issue #20),
   *  via per-tank LEVEL fractions (FSUIPC's proven SimConnect write path), then
   *  read back to verify the sim took it. `ok: false` with a message when the
   *  sim isn't connected or the aircraft's fuel system ignored the write
   *  (modern [FUEL_SYSTEM] aircraft); `actualL` is the sim's post-write total. */
  setFuel: (litres: number) => Promise<{ ok: boolean; message?: string; actualL?: number }>
  /** Subscribe to live samples; returns an unsubscribe function. */
  onSample: (cb: (sample: SimSample) => void) => () => void
  /** Subscribe to status changes; returns an unsubscribe function. */
  onStatus: (cb: (event: SimStatusEvent) => void) => () => void
}

export interface OutbackBridge {
  platform: string
  isElectron: boolean
  sim?: OutbackSim
}

declare global {
  interface Window {
    outback?: OutbackBridge
  }
}

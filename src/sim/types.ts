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

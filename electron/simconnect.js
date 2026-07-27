// Main-process SimConnect bridge for issue #9 (Phase 1).
//
// Owns the connection to the simulator and streams live SimVars. This is the
// real, reusable version of what the Phase 0 spike proved out. It exposes a
// tiny surface — connect / disconnect / status — and pushes samples and status
// changes out through callbacks; main.js forwards those to the renderer over
// IPC, and the renderer reaches them via `window.outback.sim`.
//
// node-simconnect is CommonJS; import the namespace and destructure so this
// works in our ESM Electron context regardless of Node's CJS export detection.
import simconnect from 'node-simconnect'

const {
  open,
  Protocol,
  SimConnectDataType,
  SimConnectPeriod,
  SimConnectConstants,
  RawBuffer,
} = simconnect

const APP_NAME = 'Outback Flying'
const DEF_ID = 1
const REQ_ID = 1
// Separate data definitions for the fuel WRITE path (issue #20). Kept apart
// from DEF_ID/REQ_ID so the streaming/recording path is never disturbed.
const DEF_FUEL_INFO = 2 // total quantity + capacity (read once around a write)
const DEF_FUEL_SET = 3 // per-tank LEVEL fractions (the values we write)
const REQ_FUEL_INFO = 2
const DEFAULT_TIMEOUT_MS = 8000
const GALLONS_TO_LITRES = 3.785411784 // mirror of the src/game/flightlog.ts constant (separate runtime)

// Fuel writing follows FSUIPC's proven MSFS practice: the per-tank LEVEL
// SimVars ("Percent Over 100", 0..1 of that tank's capacity) are the ones
// SimConnect can actually set — FSUIPC's offset status marks the LEVEL
// offsets "Ok-SimC" (written via SimConnect) while QUANTITY/CAPACITY writes
// are "No". Writing the SAME fraction to every tank distributes fuel in
// proportion to each tank's capacity by construction, so hitting a target
// TOTAL needs only `fraction = target / FUEL TOTAL CAPACITY` — no per-tank
// capacity bookkeeping. Tanks the loaded aircraft doesn't have simply have
// zero capacity, so their write is a no-op. Modern [FUEL_SYSTEM] aircraft
// ignore these legacy vars entirely — the read-back in setFuel() detects
// that and reports it honestly instead of pretending the sync worked.
const FUEL_TANK_LEVEL = [
  'FUEL TANK CENTER LEVEL',
  'FUEL TANK CENTER2 LEVEL',
  'FUEL TANK CENTER3 LEVEL',
  'FUEL TANK LEFT MAIN LEVEL',
  'FUEL TANK LEFT AUX LEVEL',
  'FUEL TANK LEFT TIP LEVEL',
  'FUEL TANK RIGHT MAIN LEVEL',
  'FUEL TANK RIGHT AUX LEVEL',
  'FUEL TANK RIGHT TIP LEVEL',
  'FUEL TANK EXTERNAL1 LEVEL',
  'FUEL TANK EXTERNAL2 LEVEL',
]
const FUEL_INFO_VARS = [
  { name: 'FUEL TOTAL QUANTITY', unit: 'gallons', type: SimConnectDataType.FLOAT64 },
  { name: 'FUEL TOTAL CAPACITY', unit: 'gallons', type: SimConnectDataType.FLOAT64 },
]

// SimVars to stream. Order here MUST match the read order in readSample().
const VARS = [
  { name: 'PLANE LATITUDE', unit: 'degrees', type: SimConnectDataType.FLOAT64 },
  { name: 'PLANE LONGITUDE', unit: 'degrees', type: SimConnectDataType.FLOAT64 },
  { name: 'PLANE HEADING DEGREES TRUE', unit: 'degrees', type: SimConnectDataType.FLOAT64 },
  { name: 'GROUND VELOCITY', unit: 'knots', type: SimConnectDataType.FLOAT64 },
  { name: 'INDICATED ALTITUDE', unit: 'feet', type: SimConnectDataType.FLOAT64 },
  { name: 'SIM ON GROUND', unit: 'bool', type: SimConnectDataType.INT32 },
  { name: 'FUEL TOTAL QUANTITY', unit: 'gallons', type: SimConnectDataType.FLOAT64 },
  { name: 'TITLE', unit: null, type: SimConnectDataType.STRING256 },
  { name: 'ATC MODEL', unit: null, type: SimConnectDataType.STRING256 },
  { name: 'FUEL TOTAL CAPACITY', unit: 'gallons', type: SimConnectDataType.FLOAT64 },
  // Engine state (issue #20 always-on tracking). Generic across piston /
  // turboprop / jet; indexes beyond the aircraft's engine count read as off.
  // Appended LAST — order here MUST match the read order in readSample().
  { name: 'GENERAL ENG COMBUSTION:1', unit: 'bool', type: SimConnectDataType.INT32 },
  { name: 'GENERAL ENG COMBUSTION:2', unit: 'bool', type: SimConnectDataType.INT32 },
  { name: 'GENERAL ENG COMBUSTION:3', unit: 'bool', type: SimConnectDataType.INT32 },
  { name: 'GENERAL ENG COMBUSTION:4', unit: 'bool', type: SimConnectDataType.INT32 },
]

/** Read one sample from a RawBuffer in the same order VARS were defined. */
function readSample(buffer) {
  const base = {
    lat: buffer.readFloat64(),
    lon: buffer.readFloat64(),
    headingTrue: buffer.readFloat64(),
    groundKts: buffer.readFloat64(),
    altFt: buffer.readFloat64(),
    onGround: buffer.readInt32() !== 0,
    fuelGal: buffer.readFloat64(),
    title: buffer.readString256(),
    atcModel: buffer.readString256(),
    fuelCapacityGal: buffer.readFloat64(),
  }
  const eng1 = buffer.readInt32() !== 0
  const eng2 = buffer.readInt32() !== 0
  const eng3 = buffer.readInt32() !== 0
  const eng4 = buffer.readInt32() !== 0
  return { ...base, enginesOn: eng1 || eng2 || eng3 || eng4 }
}

/** Map a friendly protocol name to a node-simconnect Protocol value. */
function resolveProtocol(name) {
  if (typeof name === 'string' && Object.hasOwn(Protocol, name) && typeof Protocol[name] === 'number') {
    return Protocol[name]
  }
  return Protocol.KittyHawk // MSFS base protocol — works with 2020 and 2024
}

/**
 * Create the bridge.
 *
 * @param {(sample: object) => void} onSample  called ~1×/s with a live sample
 * @param {(event: {status: string, message?: string}) => void} onStatus
 *        called on every status transition
 *        (disconnected | connecting | connected | error)
 */
export function createSimBridge({ onSample, onStatus }) {
  let handle = null
  let status = 'disconnected'
  // Bumped on every connect()/disconnect() call. A connect() attempt only
  // acts on its `open()` result if the generation hasn't moved on — this is
  // what lets a stale (timed-out, or superseded by disconnect()) connection
  // get closed instead of resurrected or leaked once it resolves late.
  let generation = 0

  function setStatus(next, message) {
    status = next
    try {
      onStatus({ status: next, message })
    } catch {
      /* renderer gone — ignore */
    }
  }

  function teardown() {
    if (handle) {
      const h = handle
      handle = null
      // Detach first: h.close() below re-emits 'close', which would otherwise
      // re-run this same teardown/setStatus pair and stomp a more specific
      // status message (e.g. the 'quit' handler's "Simulator closed").
      try {
        h.removeAllListeners()
      } catch {
        /* ignore */
      }
      try {
        h.close()
      } catch {
        /* ignore */
      }
    }
  }

  async function connect(options = {}) {
    if (status === 'connecting' || status === 'connected') {
      return { ok: true, appName: undefined, alreadyConnected: true }
    }
    const protocol = resolveProtocol(options.protocol)
    const connectionOptions =
      options.host && options.port ? { host: options.host, port: Number(options.port) } : undefined
    const timeoutMs = Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

    const myGen = ++generation
    setStatus('connecting')

    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no connection within ${timeoutMs} ms`)), timeoutMs)
    })

    const openPromise = open(APP_NAME, protocol, connectionOptions)
    // If open() loses the race (or wins after we've moved on), close whatever
    // handle it eventually produces and swallow a late rejection so it never
    // surfaces as an unhandled promise rejection in the main process.
    openPromise.then(
      ({ handle: h }) => {
        if (generation !== myGen) {
          try {
            h.close()
          } catch {
            /* ignore */
          }
        }
      },
      () => {}
    )

    try {
      const { recvOpen, handle: h } = await Promise.race([openPromise, timeout])
      clearTimeout(timer)

      if (generation !== myGen) {
        // disconnect() (or a newer connect()) ran while we were awaiting —
        // don't resurrect a connection the caller already gave up on.
        try {
          h.close()
        } catch {
          /* ignore */
        }
        return { ok: false, message: 'cancelled' }
      }

      handle = h

      for (const v of VARS) handle.addToDataDefinition(DEF_ID, v.name, v.unit, v.type)
      // Fuel sync definitions (issue #20). Defined per-connection alongside the
      // stream; a fresh handle re-adds them, matching how DEF_ID is set up.
      for (const v of FUEL_INFO_VARS) handle.addToDataDefinition(DEF_FUEL_INFO, v.name, v.unit, v.type)
      for (const n of FUEL_TANK_LEVEL)
        handle.addToDataDefinition(DEF_FUEL_SET, n, 'percent over 100', SimConnectDataType.FLOAT64)
      handle.requestDataOnSimObject(
        REQ_ID,
        DEF_ID,
        SimConnectConstants.OBJECT_ID_USER,
        SimConnectPeriod.SECOND
      )

      handle.on('simObjectData', (recv) => {
        if (recv.requestID !== REQ_ID) return
        try {
          const sample = readSample(recv.data)
          onSample({ ...sample, t: Date.now() })
        } catch {
          /* malformed packet — skip this tick */
        }
      })
      handle.on('quit', () => {
        teardown()
        setStatus('disconnected', 'Simulator closed')
      })
      handle.on('close', () => {
        teardown()
        setStatus('disconnected')
      })
      handle.on('error', (err) => {
        teardown()
        setStatus('error', err && err.message ? err.message : String(err))
      })
      handle.on('exception', () => {
        /* non-fatal SimConnect exception — keep streaming */
      })

      setStatus('connected', recvOpen.applicationName)
      return { ok: true, appName: recvOpen.applicationName }
    } catch (err) {
      clearTimeout(timer)
      if (generation !== myGen) {
        return { ok: false, message: 'cancelled' }
      }
      // Mark this attempt as done so a late-resolving open() (the timeout
      // fired first, but the underlying connection can still land after)
      // gets closed by the background handler above instead of leaking.
      generation++
      teardown()
      const message = err && err.message ? err.message : String(err)
      setStatus('error', message)
      return { ok: false, message }
    }
  }

  function disconnect() {
    generation++
    teardown()
    setStatus('disconnected')
    return { ok: true }
  }

  // Read the total fuel quantity + capacity once (SimConnectPeriod.ONCE).
  // Uses a temporary listener filtered on REQ_FUEL_INFO; the streaming handler
  // ignores this request id, so the two never interfere.
  function requestFuelInfoOnce() {
    return new Promise((resolve, reject) => {
      if (!handle) return reject(new Error('not connected'))
      const h = handle
      const timer = setTimeout(() => {
        try {
          h.removeListener('simObjectData', onData)
        } catch {
          /* ignore */
        }
        reject(new Error('fuel info read timed out'))
      }, 3000)
      function onData(recv) {
        if (recv.requestID !== REQ_FUEL_INFO) return
        clearTimeout(timer)
        try {
          h.removeListener('simObjectData', onData)
        } catch {
          /* ignore */
        }
        try {
          resolve({ quantityGal: recv.data.readFloat64(), capacityGal: recv.data.readFloat64() })
        } catch (err) {
          reject(err)
        }
      }
      h.on('simObjectData', onData)
      h.requestDataOnSimObject(REQ_FUEL_INFO, DEF_FUEL_INFO, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.ONCE)
    })
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  // Write the loaded aircraft's fuel so its TOTAL matches `litres` (the game's
  // authoritative tank), by setting the same LEVEL fraction on every tank —
  // FSUIPC's proven SimConnect write path (see FUEL_TANK_LEVEL note above).
  // Read-back verifies the sim actually took it: modern [FUEL_SYSTEM] aircraft
  // ignore legacy LEVEL writes, and pretending otherwise would let the game
  // and sim silently drift apart. Never throws into the caller and never
  // touches the streaming path; a failed sync leaves the already-committed
  // game state untouched and returns { ok:false, message } for a soft notice.
  async function setFuel(litres) {
    if (!handle || status !== 'connected') return { ok: false, message: 'Sim not connected.' }
    const targetGal = Math.max(0, Number(litres) / GALLONS_TO_LITRES)
    if (!Number.isFinite(targetGal)) return { ok: false, message: 'Invalid fuel amount.' }
    try {
      const info = await requestFuelInfoOnce()
      if (!(info.capacityGal > 0)) return { ok: false, message: 'Aircraft reports no fuel capacity.' }
      const fraction = Math.min(1, targetGal / info.capacityGal)
      const buf = new RawBuffer(FUEL_TANK_LEVEL.length * 8)
      for (let i = 0; i < FUEL_TANK_LEVEL.length; i++) buf.writeFloat64(fraction)
      handle.setDataOnSimObject(DEF_FUEL_SET, SimConnectConstants.OBJECT_ID_USER, {
        buffer: buf,
        arrayCount: 0,
        tagged: false,
      })
      // Read back after a beat: a modern-fuel-system aircraft ignores the
      // write, which shows up as an unchanged total. 2% of capacity (min
      // half a gallon) absorbs float noise and unusable-fuel rounding.
      await sleep(500)
      const after = await requestFuelInfoOnce()
      const tolGal = Math.max(0.5, info.capacityGal * 0.02)
      if (Math.abs(after.quantityGal - targetGal) > tolGal) {
        return {
          ok: false,
          message: "The aircraft's fuel system did not accept the external refuel — set fuel in the sim manually.",
          actualL: after.quantityGal * GALLONS_TO_LITRES,
        }
      }
      return { ok: true, actualL: after.quantityGal * GALLONS_TO_LITRES }
    } catch (err) {
      return { ok: false, message: err && err.message ? err.message : String(err) }
    }
  }

  return {
    connect,
    disconnect,
    getStatus: () => ({ status }),
    setFuel,
  }
}

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
} = simconnect

const APP_NAME = 'Outback Flying'
const DEF_ID = 1
const REQ_ID = 1
const DEFAULT_TIMEOUT_MS = 8000

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
]

/** Read one sample from a RawBuffer in the same order VARS were defined. */
function readSample(buffer) {
  return {
    lat: buffer.readFloat64(),
    lon: buffer.readFloat64(),
    headingTrue: buffer.readFloat64(),
    groundKts: buffer.readFloat64(),
    altFt: buffer.readFloat64(),
    onGround: buffer.readInt32() !== 0,
    fuelGal: buffer.readFloat64(),
    title: buffer.readString256(),
    atcModel: buffer.readString256(),
  }
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

  return {
    connect,
    disconnect,
    getStatus: () => ({ status }),
  }
}

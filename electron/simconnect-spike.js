// Phase 0 spike (throwaway) for issue #9 — SimConnect flight recording.
//
// Goal: prove that `node-simconnect` can connect to the simulator, subscribe to
// the SimVars we care about, and stream them, and that it fails soft when no sim
// is reachable. This is NOT production code and is not wired into the app — it's
// a standalone script you run against a running sim to answer "does this work
// here?" before we build anything on top of it.
//
// Run it (with MSFS/FSX/P3D running):
//   node electron/simconnect-spike.js
//
// The sim runs on Windows, but this client does not have to. To reach a sim on
// another machine over the LAN, enable a SimConnect TCP port in SimConnect.xml
// and point the spike at it:
//   SIMCONNECT_HOST=192.168.1.50 SIMCONNECT_PORT=500 node electron/simconnect-spike.js
//
// Env knobs:
//   SIMCONNECT_HOST / SIMCONNECT_PORT  connect over TCP instead of auto-discovery
//   SIMCONNECT_PROTOCOL                one of FSX_RTM|FSX_SP1|FSX_SP2|KittyHawk|SunRise
//                                      (default SunRise = MSFS 2024; use KittyHawk for MSFS 2020)
//   SIMCONNECT_TIMEOUT_MS              how long to wait for a connection before giving up (default 8000)

// node-simconnect is CommonJS; import the namespace and destructure so this works
// regardless of Node's CJS named-export detection.
import simconnect from 'node-simconnect'

const {
  open,
  Protocol,
  SimConnectDataType,
  SimConnectPeriod,
  SimConnectConstants,
} = simconnect

const APP_NAME = 'Outback Flying (spike)'
const DEF_ID = 1
const REQ_ID = 1

// The SimVars from the brainstorm §2 table. Order here MUST match the read order
// in onSimObjectData below.
const VARS = [
  { name: 'PLANE LATITUDE', unit: 'degrees', type: SimConnectDataType.FLOAT64, read: (b) => b.readFloat64() },
  { name: 'PLANE LONGITUDE', unit: 'degrees', type: SimConnectDataType.FLOAT64, read: (b) => b.readFloat64() },
  { name: 'PLANE HEADING DEGREES TRUE', unit: 'degrees', type: SimConnectDataType.FLOAT64, read: (b) => b.readFloat64() },
  { name: 'GROUND VELOCITY', unit: 'knots', type: SimConnectDataType.FLOAT64, read: (b) => b.readFloat64() },
  { name: 'INDICATED ALTITUDE', unit: 'feet', type: SimConnectDataType.FLOAT64, read: (b) => b.readFloat64() },
  { name: 'SIM ON GROUND', unit: 'bool', type: SimConnectDataType.INT32, read: (b) => b.readInt32() },
  { name: 'FUEL TOTAL QUANTITY', unit: 'gallons', type: SimConnectDataType.FLOAT64, read: (b) => b.readFloat64() },
  { name: 'TITLE', unit: null, type: SimConnectDataType.STRING256, read: (b) => b.readString256() },
  { name: 'ATC MODEL', unit: null, type: SimConnectDataType.STRING256, read: (b) => b.readString256() },
]

function resolveProtocol() {
  const name = process.env.SIMCONNECT_PROTOCOL
  if (name && name in Protocol) return Protocol[name]
  return Protocol.SunRise // MSFS 2024; falls back gracefully to older sims per the lib
}

function resolveOptions() {
  const host = process.env.SIMCONNECT_HOST
  const port = process.env.SIMCONNECT_PORT
  if (host && port) return { host, port: Number(port) }
  return undefined // auto: SimConnect.cfg / Windows registry (named pipe or localhost port)
}

const TIMEOUT_MS = Number(process.env.SIMCONNECT_TIMEOUT_MS ?? 8000)

async function main() {
  const protocol = resolveProtocol()
  const options = resolveOptions()
  console.log(
    `Connecting to SimConnect (protocol=${Protocol[protocol]}, ${options ? `${options.host}:${options.port}` : 'auto-discover'})…`
  )

  // Fail-soft guard: open() can hang if it keeps retrying discovery, so race it.
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no connection within ${TIMEOUT_MS} ms`)), TIMEOUT_MS)
  })

  let handle
  try {
    const openEvent = await Promise.race([open(APP_NAME, protocol, options), timeout])
    clearTimeout(timer)
    handle = openEvent.handle
    console.log(`✅ Connected. Sim reports: "${openEvent.recvOpen.applicationName}"`)
  } catch (err) {
    clearTimeout(timer)
    console.error(`❌ Could not connect — is the simulator running and SimConnect enabled?`)
    console.error(`   (${err && err.message ? err.message : err})`)
    process.exitCode = 1
    return
  }

  for (const v of VARS) handle.addToDataDefinition(DEF_ID, v.name, v.unit, v.type)
  handle.requestDataOnSimObject(REQ_ID, DEF_ID, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND)
  console.log(`Subscribed to ${VARS.length} SimVars at 1 Hz. Ctrl-C to stop.\n`)

  handle.on('simObjectData', (recv) => {
    if (recv.requestID !== REQ_ID) return
    const b = recv.data
    const row = {}
    for (const v of VARS) row[v.name] = v.read(b)
    console.log(
      `${row['SIM ON GROUND'] ? 'GND' : 'AIR'}  ` +
        `${row['PLANE LATITUDE'].toFixed(4)}, ${row['PLANE LONGITUDE'].toFixed(4)}  ` +
        `hdg ${row['PLANE HEADING DEGREES TRUE'].toFixed(0)}°  ` +
        `gs ${row['GROUND VELOCITY'].toFixed(0)} kt  ` +
        `alt ${row['INDICATED ALTITUDE'].toFixed(0)} ft  ` +
        `fuel ${row['FUEL TOTAL QUANTITY'].toFixed(1)} gal  ` +
        `[${row['TITLE'] || '?'} / ${row['ATC MODEL'] || '?'}]`
    )
  })

  handle.on('exception', (e) => console.warn('⚠ SimConnect exception:', e.exception))
  handle.on('quit', () => {
    console.log('Sim is shutting down — connection will close.')
    process.exitCode = 0
  })
  handle.on('close', () => console.log('Connection closed.'))
  handle.on('error', (e) => console.error('Socket error:', e && e.message ? e.message : e))

  const shutdown = () => {
    console.log('\nStopping spike.')
    try {
      handle.close()
    } catch {
      /* ignore */
    }
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main()

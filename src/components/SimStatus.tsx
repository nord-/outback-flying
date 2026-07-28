import { useState } from 'react'
import { useSim } from '../sim/useSim'
import { useSessionState } from '../sim/useSimSession'
import { useGame } from '../game/store'
import type { SimProtocol } from '../sim/types'

const SIM_VERSIONS: { label: string; protocol: SimProtocol }[] = [
  { label: 'MSFS 2020', protocol: 'KittyHawk' },
  { label: 'MSFS 2024', protocol: 'SunRise' },
]

/**
 * Compact header chip showing the SimConnect connection and a live readout.
 * Renders nothing outside the desktop app (no `window.outback.sim`).
 */
export function SimStatus() {
  const { available, status, message, connect, disconnect } = useSim()
  const session = useSessionState()
  // session.lastSample is the guarded sample (#28); the raw useSim() stream is
  // deliberately NOT read here — it still carries the sim's shutdown zeros, and
  // this chip is the most persistently visible readout on screen.
  const sample = session.lastSample
  const game = useGame((s) => s.game)
  const [protocol, setProtocol] = useState<SimProtocol>('KittyHawk')
  const [busy, setBusy] = useState(false)

  if (!available) return null

  const onConnect = async () => {
    setBusy(true)
    try {
      await connect({ protocol })
    } finally {
      setBusy(false)
    }
  }
  const onDisconnect = async () => {
    setBusy(true)
    try {
      await disconnect()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`sim-chip ${status}`} title={message}>
      <span className="sim-dot" />

      {status === 'connected' && sample ? (
        <span className="sim-live">
          <b>
            {(() => {
              const ac = game?.fleet.find((a) => a.id === session.aircraftId)
              return ac ? `${ac.registration} · ${session.phase === 'GROUND_SECURE' ? 'Secured' : 'In flight'}` : sample.atcModel || 'Aircraft'
            })()}
          </b>
          <span className="sep">·</span>
          {sample.onGround ? 'GND' : 'AIR'}
          <span className="sep">·</span>
          {sample.groundKts.toFixed(0)} kt
          <span className="sep">·</span>
          {sample.altFt.toFixed(0)} ft
        </span>
      ) : (
        <span className="sim-label">
          {status === 'connecting'
            ? 'Connecting…'
            : status === 'error'
            ? message || 'Connection error'
            : 'Sim not connected'}
        </span>
      )}

      {status === 'connected' ? (
        <button className="btn ghost sm" onClick={onDisconnect} disabled={busy}>
          Disconnect
        </button>
      ) : (
        <>
          {status !== 'connecting' && (
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as SimProtocol)}
              disabled={busy}
              aria-label="Simulator version"
            >
              {SIM_VERSIONS.map((v) => (
                <option key={v.protocol} value={v.protocol}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn primary sm"
            onClick={onConnect}
            disabled={busy || status === 'connecting'}
          >
            {status === 'error' ? 'Retry' : 'Connect'}
          </button>
        </>
      )}
    </div>
  )
}

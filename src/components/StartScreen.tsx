import { useState } from 'react'
import { useGame } from '../game/store'

export function StartScreen() {
  const newGame = useGame((s) => s.newGame)
  const [name, setName] = useState('')

  return (
    <div className="start">
      <div className="panel">
        <div className="logo-big">🛩️</div>
        <h1>Outback Flying</h1>
        <p className="tagline">
          Run a flying-doctor operation across the Australian outback. The game hands you
          missions and keeps the books — <b>you</b> fly every leg in the simulator of your
          choice, then report the flight when you land.
        </p>
        <div className="field mb">
          <label htmlFor="co">Name your operation</label>
          <input
            id="co"
            value={name}
            placeholder="e.g. Red Centre Air Rescue"
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newGame(name)}
          />
          <span className="hint">You'll start at Alice Springs (YBAS) with $50,000 and a Cessna 210.</span>
        </div>
        <button className="btn primary" style={{ width: '100%' }} onClick={() => newGame(name)}>
          Start operation
        </button>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from './game/store'
import { useHydrated } from './useHydrated'
import { money } from './game/format'
import { UIContext, NavContext, type Tab } from './components/ui'
import { StartScreen } from './components/StartScreen'
import { Dashboard } from './components/Dashboard'
import { Missions } from './components/Missions'
import { Fleet } from './components/Fleet'
import { Market } from './components/Market'
import { Ledger } from './components/Ledger'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'missions', label: 'Missions' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'market', label: 'Market' },
  { id: 'ledger', label: 'Ledger' },
]

export function App() {
  const game = useGame((s) => s.game)
  const advanceDay = useGame((s) => s.advanceDay)
  const resetGame = useGame((s) => s.resetGame)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const notify = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3600)
  }, [])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const hydrated = useHydrated()

  // Persistence is async (IndexedDB), so the store is empty until the saved
  // game rehydrates. Wait for that before deciding whether to offer a new game,
  // otherwise a returning player would see the StartScreen flash — and could
  // start over on top of their existing save.
  if (!hydrated) {
    return (
      <div className="app boot">
        <div className="boot-inner">
          <span className="logo">🛩️</span>
          <p>Loading your operation…</p>
        </div>
      </div>
    )
  }

  if (!game) return <StartScreen />

  return (
    <UIContext.Provider value={{ notify }}>
      <NavContext.Provider value={{ tab, setTab, selectedMissionId, setSelectedMissionId }}>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="logo">🛩️</span>
            <div>
              <h1>Outback Flying</h1>
              <div className="company">{game.companyName}</div>
            </div>
          </div>

          <div className="stats-strip">
            <div className="stat">
              <div className="label">Balance</div>
              <div className={`value ${game.balance >= 0 ? 'pos' : 'neg'}`}>{money(game.balance)}</div>
            </div>
            <div className="stat">
              <div className="label">Reputation</div>
              <div className="value">{game.reputation.toFixed(0)}</div>
            </div>
            <div className="stat">
              <div className="label">Day</div>
              <div className="value">{game.day}</div>
            </div>
            <button
              className="btn primary"
              onClick={() => {
                advanceDay()
                notify(`Advanced to day ${game.day + 1}. Overheads charged; board refreshed.`)
              }}
            >
              Advance day →
            </button>
            <button
              className="btn ghost sm"
              title="Abandon this operation and start over"
              onClick={() => {
                if (confirm('Start a new operation? Your current save will be erased.')) resetGame()
              }}
            >
              New game
            </button>
          </div>
        </header>

        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'missions' && game.acceptedMissions.length > 0 && (
                <span className="count">{game.acceptedMissions.length}</span>
              )}
              {t.id === 'fleet' && <span className="count">{game.fleet.length}</span>}
            </button>
          ))}
        </nav>

        <main className="content">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'missions' && <Missions />}
          {tab === 'fleet' && <Fleet />}
          {tab === 'market' && <Market />}
          {tab === 'ledger' && <Ledger />}
        </main>

        {toast && <div className="toast">{toast}</div>}
      </div>
      </NavContext.Provider>
    </UIContext.Provider>
  )
}

import { useGame } from '../game/store'
import { money, signedMoney } from '../game/format'
import type { LedgerCategory } from '../game/types'

const CAT_LABEL: Record<LedgerCategory, string> = {
  MISSION: 'Mission',
  FUEL: 'Fuel',
  MAINTENANCE: 'Maintenance',
  AIRCRAFT_PURCHASE: 'Aircraft',
  AIRCRAFT_SALE: 'Aircraft',
  DAILY_COST: 'Overheads',
  REPAIR: 'Repair',
  PENALTY: 'Penalty',
  OPENING: 'Opening',
}

export function Ledger() {
  const game = useGame((s) => s.game)!
  const income = game.ledger.filter((e) => e.category !== 'OPENING' && e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const expense = game.ledger.filter((e) => e.category !== 'OPENING' && e.amount < 0).reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <div className="grid cols-3 mb">
        <div className="card kpi"><span className="k-label">Total income</span><span className="k-value" style={{ color: 'var(--green)' }}>{money(income)}</span></div>
        <div className="card kpi"><span className="k-label">Total expenses</span><span className="k-value" style={{ color: 'var(--red)' }}>{money(expense)}</span></div>
        <div className="card kpi"><span className="k-label">Net</span><span className="k-value">{signedMoney(income + expense)}</span></div>
      </div>

      <div className="card">
        <h2 className="page-title" style={{ marginTop: 0 }}>Ledger ({game.ledger.length})</h2>
        {game.ledger.length === 0 ? (
          <div className="empty">No transactions yet.</div>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Day</th>
                <th style={{ width: 110 }}>Category</th>
                <th>Description</th>
                <th style={{ textAlign: 'right', width: 120 }}>Amount</th>
                <th style={{ textAlign: 'right', width: 130 }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {game.ledger.map((e) => (
                <tr key={e.id}>
                  <td className="muted">{e.day}</td>
                  <td><span className="cat">{CAT_LABEL[e.category]}</span></td>
                  <td>{e.description}</td>
                  <td style={{ textAlign: 'right' }} className={`amount ${e.amount >= 0 ? 'pos' : 'neg'}`}>{signedMoney(e.amount)}</td>
                  <td style={{ textAlign: 'right' }} className="muted">{money(e.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

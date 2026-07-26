# 🛩️ Outback Flying

A **Royal Flying Doctor Service–inspired career manager** for flight simulators.

Inspired by *The Flying Doctors*, the game hands you emergency and routine
call-outs across the Australian outback and keeps the whole business running —
income, expenses, your fleet, reputation and the calendar. **You fly every leg
yourself, in whatever simulator you like** (MSFS, X-Plane, DCS, or even a paper
map). When you land, you file a short flight report and the game settles the
books.

It's a desktop app (Electron) built on a Vite + React + TypeScript core.

## The gameplay loop

1. **Take a call-out** from the mission board — medevacs, doctor transports,
   patient transfers, supply runs and clinic flights between real outback strips
   (Alice Springs, Broken Hill, Charleville, Mount Isa, Birdsville, Kununurra…).
   Each has a distance, seat requirement, urgency, reward and a deadline.
2. **Fly it yourself** in your simulator of choice.
3. **File the flight report** — block time, fuel burned, landings. The game
   charges fuel and maintenance, pays the fare, adds airframe wear and parks the
   aircraft at the destination.
4. **Manage the business** — buy and sell aircraft, repair worn airframes,
   reposition (ferry) aircraft to where the next job is, and watch your cash,
   reputation and fuel prices.
5. **Advance the day** to accrue overheads, expire old jobs and refresh the board.

You start as *Alice Springs*–based operation with **$50,000** and a **Cessna 210
Centurion**. Reputation unlocks better-paying work.

### Key mechanics

- **Aircraft matter.** Seats, range, cruise speed, fuel type (Avgas / Jet A-1)
  and running costs all gate which jobs you can take and how profitable they are.
- **Logistics matter.** An aircraft stays wherever you last landed it. If the
  next job departs elsewhere, you fly a (non-paying) ferry leg first.
- **Honesty system.** The game trusts your reported figures — it pre-fills
  sensible suggestions based on distance and the aircraft's performance.
- **Everything is saved locally** (browser `localStorage`), so you can close and
  come back to your operation.

## Running it

```bash
npm install       # installs deps (Electron downloads its runtime here)
npm run dev       # web dev server at http://localhost:5173
npm run electron:dev   # run inside the Electron desktop shell (hot reload)
```

### Build

```bash
npm run build          # type-check + production web build → dist/
npm run electron:build # package a desktop app → release/
```

> **Note:** `npm install` downloads the Electron runtime binary. If you're behind
> a proxy that blocks it, the *web* build still works; set
> `ELECTRON_SKIP_BINARY_DOWNLOAD=1` to install without the desktop runtime.

## Branching, CI & releases

- **`master`** is the default and production branch. GitHub Actions validates every PR into `master` and every push to it (`npm ci`, typecheck, tests, build).
- **Versioning is driven by PR labels.** Label a PR `major`, `minor`, or `patch` before merging it into `master` — on merge, a workflow bumps `package.json`, tags the commit (`vX.Y.Z`), builds a Windows installer, and publishes a GitHub Release with the installer attached. No label → no release.
- See `.github/workflows/ci.yml` and `.github/workflows/release.yml`.

## Project layout

```
electron/          Electron main + preload (desktop shell)
src/
  data/            Airport and aircraft catalogues (real-world inspired)
  game/            Pure game logic — types, geo, economy, missions, store
  components/      React UI (Dashboard, Missions, Fleet, Market, Ledger, modals)
```

The game state and rules live in `src/game/` and are UI-agnostic — the React
components only render state and dispatch actions through the Zustand store
(`src/game/store.ts`).

## Roadmap ideas

### Shipped

- **Choose your region at the start of a game** — the Australian outback, East
  Africa, or Alaska & the North, each with its own airports, home base, fuel
  prices and mission flavour. The mission board, fleet market, ferry
  destinations and operations map are all scoped to the chosen region.
- **Operator profile with experience & rank** — a persistent career (name, XP,
  rank) that sits above the per-region station, so it can carry across a future
  region transfer. Flying missions earns XP and advances your pilot rank.

### High priority

- **Transfer between regions** while keeping your experience, reputation and
  cash — relocate the operator to a fresh station in another region so a single
  career can expand across the globe. (The operator profile is the foundation
  for this; the transfer action itself is the remaining piece.)
- **SimConnect / log-file integration** to auto-verify flights — read block
  time, fuel burn and landings straight from the simulator instead of trusting
  hand-entered figures.
- **A real airport database with fuel availability.** Not every strip sells
  fuel, and those that do don't all carry the right type. An outback field might
  have Avgas but no Jet A-1 (or nothing at all), so range planning and where you
  can refuel become part of the challenge — you may need to tanker fuel or route
  via a field that has what your aircraft burns.

### Later

- Multi-leg missions and en-route fuel stops
- Hiring pilots so you can run several aircraft in parallel
- Save export/import and multiple save slots
- Weather, night ops and seasonal demand

## License

MIT

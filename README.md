# 🛩️ Outback Flying

A **Royal Flying Doctor Service–inspired career manager** for flight simulators.

Inspired by *The Flying Doctors*, the game hands you emergency and routine
call-outs across remote airstrips and keeps the whole business running —
income, expenses, your fleet, reputation and the calendar. **You fly every leg
yourself, in whatever simulator you like** (MSFS 2020/2024, X-Plane, DCS, or
even a paper map). When you land, you file a short flight report — or, on
Windows with MSFS running, let the game read block time, fuel and landings
straight out of SimConnect — and the game settles the books.

It's a desktop app (Electron) built on a Vite + React + TypeScript core.

## The gameplay loop

1. **Take a call-out** from the mission board — medevacs, doctor transports,
   patient transfers, supply runs and clinic flights between real,
   region-specific airstrips. Each has a distance, seat requirement, urgency,
   reward and a deadline. Accepting a mission that would breach your duty-time
   limits (see below) warns you first.
2. **Fly it yourself** in your simulator of choice.
3. **File the flight report** — block time, fuel burned, landings — or, if
   SimConnect is connected, review the auto-derived report and commit it as-is.
   The game charges fuel and maintenance, pays the fare, adds airframe wear,
   accrues duty time and career XP, and parks the aircraft at the destination.
4. **Manage the business** — buy and sell aircraft, repair worn airframes,
   reposition (ferry) aircraft to where the next job is, and watch your cash,
   reputation, duty hours and fuel prices.
5. **Advance the day** to accrue overheads, expire old jobs and refresh the board.

You start as a new operation with **your choice of starter aircraft** (Cessna
152, Cessna 172, Bonanza G36 or Pilatus PC-6 — cheaper aircraft leave more
starting cash) at your region's home base. Reputation and career rank unlock
better-paying work.

### Key mechanics

- **Choose your region.** The Australian outback, East Africa, or Alaska & the
  North — each with its own airport catalogue, home base, starting fuel
  prices and tail-number style. The mission board, fleet market, ferry
  destinations and operations map are all scoped to the chosen region.
- **Aircraft matter.** Ten aircraft from light piston trainers up to
  turboprops (Cessna 152/172, CubCrafters XCub, Beechcraft Bonanza/Baron,
  Pilatus PC-6/PC-12, Kodiak 100, Cessna 208B Caravan, King Air 350i). Seats,
  range, cruise speed, fuel type (Avgas / Jet A-1) and running costs all gate
  which jobs you can take and how profitable they are.
- **Logistics matter.** An aircraft stays wherever you last landed it. If the
  next job departs elsewhere, you fly a (non-paying) ferry leg first.
- **SimConnect integration (Windows desktop app).** Connect to a running MSFS
  2020 or 2024 session and the game samples your position, altitude, speed and
  aircraft type live, matching it against your fleet (forgiving real-world
  variants, e.g. a Bonanza A36 counts as the G36 spec). It derives block/flight
  time, distance, fuel burn and a simplified ground track per leg — ready to
  review and commit instead of typing figures by hand. Every flown route is
  kept in a **logbook** with its track plotted on a map. Not connected, or
  flying MSFS on Mac/Linux, X-Plane, DCS, etc.? The honesty-system manual
  report still works everywhere — the game pre-fills sensible suggestions
  based on distance and the aircraft's performance.
- **Duty-time limits.** Duty (block time + 30 min per stop) is tracked across
  a rolling 1/7/14/28-day window against real aviation-style caps (10 h / 60 h
  / 110 h / 190 h). The dashboard shows your running totals, accepting a
  mission that would breach a limit prompts a warning, and flying over one
  anyway withholds part or all of the reward.
- **Career progression.** A persistent operator profile (company name,
  experience, rank — Cadet up through Director of Flying) sits above the
  per-region station, earning XP for every mission flown, so it's ready to
  carry across a future region transfer.
- **Operations map & logbook.** A live map (Leaflet) plots your home base,
  pilot location, fleet and mission routes by urgency; click an airport to see
  what's on offer there. The logbook lists every completed flight with its
  recorded track.
- **Everything is saved locally** (IndexedDB, falling back to browser
  `localStorage` if unavailable), so you can close and come back to your
  operation. Flight-log tracks are stored separately from the main save so a
  long career doesn't bloat it.

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
>
> SimConnect live-tracking only runs inside the Windows desktop app (it talks
> to a local MSFS instance via `node-simconnect`); the web build and other
> platforms fall back to the manual flight report.

## Branching, CI & releases

- **`master`** is the default and production branch. GitHub Actions validates every PR into `master` and every push to it (`npm ci`, typecheck, tests, build).
- **Versioning is driven by PR labels.** Label a PR `major`, `minor`, or `patch` before merging it into `master` — on merge, a workflow bumps `package.json`, tags the commit (`vX.Y.Z`), builds a Windows installer, and publishes a GitHub Release with the installer attached. No label → no release.
- See `.github/workflows/ci.yml` and `.github/workflows/release.yml`.

## Project layout

```
electron/          Electron main + preload + SimConnect bridge (desktop shell)
src/
  data/            Airport, aircraft and region catalogues (real-world inspired)
  game/            Pure game logic — types, geo, economy, missions, duty, progression, store
  sim/             SimConnect sample types and React hooks (useSim, useFlightRecorder)
  components/      React UI (Dashboard, Missions, Fleet, Market, Ledger, Logbook,
                    OperationsMap, modals)
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
- **SimConnect integration** — connect to a live MSFS 2020/2024 session and
  auto-derive block time, fuel burn, landings and a ground track per flight,
  with forgiving real-world aircraft matching. Recorded flights are kept in a
  logbook with their track plotted on a map.
- **Pilot duty-time limits** — aviation-style caps on flying hours over 1/7/14/28
  days, with dashboard tracking, an accept-time warning before breaching a
  limit, and a reward penalty if you fly over anyway.

### High priority

- **Transfer between regions** while keeping your experience, reputation and
  cash — relocate the operator to a fresh station in another region so a single
  career can expand across the globe. (The operator profile is the foundation
  for this; the transfer action itself is the remaining piece.)
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

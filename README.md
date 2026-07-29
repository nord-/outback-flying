# 🛩️ Outback Flying

A **Royal Flying Doctor Service–inspired career manager** for flight simulators.

Inspired by *The Flying Doctors*, the game hands you emergency and routine
call-outs across remote airstrips and keeps the whole business running —
income, expenses, your fleet, fuel, reputation and the calendar. **You fly
every leg yourself, in whatever simulator you like** (MSFS 2020/2024, X-Plane,
DCS, or even a paper map). On Windows with MSFS running, the game tracks your
flight live over SimConnect — missions arm when you release the brakes and
settle when you land, fuel is reconciled against the sim — so the books keep
themselves. Anywhere else, you file a short flight report by hand and the game
settles up.

It's a desktop app (Electron) built on a Vite + React + TypeScript core.

## The gameplay loop

1. **Take a call-out** from the mission board — medevacs, doctor transports,
   patient transfers, supply runs and clinic flights, plus time-critical organ
   transports and emergency medevacs (see below), between real, region-specific
   airstrips. New postings start close to wherever you currently are, so
   ferrying to the job doesn't dominate play. Each has a distance, seat
   requirement, urgency, reward and a deadline. Accepting a mission that would
   breach your duty-time limits (see below) warns you first. Not interested in
   one you haven't accepted? **Dismiss** it for a small reputation cost and no
   money — it isn't a failed mission, and the slot refills next time the board
   turns over.
2. **Fly it yourself** in your simulator of choice. With SimConnect connected,
   the flight books itself — the mission arms at off-block and completes when
   you land at the destination (even a running turnaround at an intermediate
   stop counts). Otherwise, **file the flight report** by hand — block time,
   fuel burned, landings. Either way the game charges maintenance, draws fuel
   from the tank, pays the fare, adds airframe wear, accrues duty time and
   career XP, and parks the aircraft where it landed.
3. **Keep it fuelled.** Fuel is a resource in the tank, not an automatic
   per-leg charge: refuel (a paid action) where the field sells your type,
   plan the burn for the leg — or the return — yourself, and land for a fuel
   stop if you have to.
4. **Manage the business** — buy and sell aircraft, repair worn airframes,
   reposition (ferry) aircraft to where the next job is, and watch your cash,
   reputation, duty hours and fuel prices.
5. **Advance the day** to accrue overheads, expire old jobs and refill the
   board back up to your chosen size — pick 5, 10, 15 or 20 postings from the
   Missions tab; lowering it never removes a posting already up, the board
   just stops refilling until it naturally drops below the new target.

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
- **Fuel is a resource.** Each aircraft carries a tank; flying draws it down.
  Refuelling is a paid action, and only where the field sells the right type
  (Avgas / Jet A-1) at that field's price. Range planning, tankering and
  fuel stops are the pilot's problem, not an automatic line-item.
- **Logistics matter.** An aircraft stays wherever you last landed it — even
  a bush strip or open ground away from any catalogued field, which it holds
  until you fly or ferry it out. If the next job departs elsewhere, you fly a
  (non-paying) ferry leg first.
- **Fields come in three tiers.** Hubs are the big sealed airports where missions
  originate and aircraft are bought; regional fields serve the towns in between;
  and **bush strips** are the short, unsealed station and community fields that
  most of the flying doctor's work actually reaches. Most strips sell no fuel at
  all, so you plan the return leg into the tank before you go. Nothing stops you
  putting a King Air into a 700 m dirt strip — the app shows you the runway
  figures, warns you, and lets you decide. The airframe will send the bill.
- **SimConnect integration (Windows desktop app) — always-on tracking.**
  Connect to a running MSFS 2020/2024 session and the game continuously tracks
  the aircraft it matches to your fleet (by your pilot's location and type,
  forgiving real-world variants — a Bonanza A36 counts as the G36 spec). It
  reads engine, position, speed and fuel live: legs open when you release the
  brakes and close when you shut down, accepted missions settle automatically
  at their destination, and fuel is kept in agreement between game and sim —
  the game is authoritative on the ground with engines off (it writes your
  tank back to the sim), the sim is authoritative in flight (fuel added in the
  sim's own menus gets billed). Every flown route is kept in a **logbook**
  with its track on a map. Not connected, or flying on Mac/Linux, X-Plane,
  DCS, etc.? The honour-system manual report works everywhere — the game
  pre-fills sensible suggestions from distance and the aircraft's performance.
- **Time-critical missions.** Organ transports and emergency medevacs run
  against a live clock. The countdown starts when you land and park at the
  pickup airstrip and stops when you park at the destination — deliver in time
  and the reward and reputation are yours; miss the window and the cargo is
  lost (no reward, a penalty and a reputation hit). While the flight is under
  way the dashboard also shows an **active mission window** — a map with your
  live position and route, the destination and the time remaining. They book
  themselves through always-on SimConnect tracking, so they're flyable only in
  the Windows desktop app with MSFS connected; emergency medevacs also need a
  larger cabin (Bonanza-class or bigger).
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
  what's on offer there. While a flight is being tracked over SimConnect, the
  map also plots the aircraft's live position and the track flown so far. The
  logbook lists every completed flight with its recorded track.
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
electron/          Electron main + preload + SimConnect bridge + window-state
                    persistence (desktop shell)
src/
  data/            Airport, aircraft and region catalogues (real-world inspired)
  game/            Pure game logic — types, geo, economy, missions, duty,
                    progression, flightlog, simSession (the sim state machine), store
  sim/             SimConnect sample types and React hooks (useSim, useSimSession)
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
- **Fuel as a resource** — a tank per aircraft that flying draws down, paid
  refuelling gated by each field's fuel availability and price, so range
  planning and fuel stops are part of the job.
- **Always-on sim tracking** — with SimConnect connected, flights book
  themselves: engine-driven off-block/on-block legs, automatic mission
  arming/completion (running turnarounds included), game↔sim fuel-state
  reconciliation with a single writer, and persisted off-field parking. The
  old manual "start recording" step is gone; the honour-mode report remains
  for playing without a sim.
- **Configurable mission board & dismissible postings** — choose how many
  postings the board holds (5, 10, 15 or 20, default 10) from the Missions
  tab; lowering the setting never deletes a posting already up, it just
  pauses refilling until the board naturally drops below the new target. Any
  posting you haven't accepted can also be dismissed for a small reputation
  cost and no money, since you never committed to it.
- **Missions that start near the pilot** — new postings are weighted toward
  wherever you currently are (most often your own field, the rest within 500 nm)
  instead of being scattered across the region, so ferrying to the job no
  longer dominates play.
- **Live position on the operations map** — while a flight is tracked over
  SimConnect, the map plots the aircraft's live position and the track flown
  so far for any flight, not only inside a time-critical mission's countdown
  window.
- **Fixed a "Null Island" glitch** — closing the simulator mid-flight no
  longer records a phantom leg to the middle of the ocean or strands the
  aircraft there; affected saves are repaired automatically when loaded.

### High priority

- **Transfer between regions** while keeping your experience, reputation and
  cash — relocate the operator to a fresh station in another region so a single
  career can expand across the globe. (The operator profile is the foundation
  for this; the transfer action itself is the remaining piece.)
- **Bush airstrips (#5)** — a small-strip tier distinct from regional airports:
  runway/surface gating and strips that sell no fuel (or the wrong type),
  which light up the dormant fuel-availability marker the resource model
  already ships with.

### Later

- Hiring pilots so you can run several aircraft in parallel
- Save export/import and multiple save slots
- Weather, night ops and seasonal demand

## Data sources

Runway length, surface and lighting mostly come from the [OurAirports](https://ourairports.com/data/)
public-domain dataset. East African airstrips' runway length and surface instead derive from
[OpenStreetMap](https://www.openstreetmap.org/) and its contributors, used under the
[ODbL](https://opendatacommons.org/licenses/odbl/) (© OpenStreetMap contributors). A small number
of other fields were hand-filled from other published sources where neither dataset had usable
data; each is noted in a comment in `src/data/airports.ts`.

## License

MIT

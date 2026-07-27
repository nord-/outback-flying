# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Vite web dev server → http://localhost:5173
npm run electron:dev   # Vite + Electron desktop shell with hot reload
npm run build          # tsc --noEmit type-check, then vite build → dist/
npm run typecheck      # tsc --noEmit only (no emit)
npm run electron:build # build web assets, then package desktop app → release/
npm run preview        # serve the production web build locally
```

There is **no linter configured**. Type safety is enforced by `tsc --noEmit` (run via `npm run typecheck` or as the first half of `npm run build`); tests run on Vitest (`npm test` / `npm run test:watch`). Run the type-check and relevant tests after any change to `src/`.

`npm install` downloads the Electron runtime binary; set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` to skip it (the web build still works without the desktop runtime).

## Architecture

Outback Flying is a single-player career manager: the player flies each leg in their own external flight simulator, and the app runs the *business* (economy, fleet, reputation, calendar). Results reach the app one of two ways — a manual flight report (the honour system, works everywhere), or, on the Windows desktop with a SimConnect-connected sim, **always-on tracking** that books flights automatically from the live telemetry. It is a Vite + React + TypeScript web app wrapped in an Electron desktop shell.

### The core boundary: `src/game/` is UI-agnostic

All game rules and state live in `src/game/` as pure TypeScript with **no React imports**. The React components in `src/components/` only render state and dispatch actions through the Zustand store. Preserve this separation — put logic in `src/game/`, not in components.

- **`store.ts`** — the single Zustand store (`useGame`), wrapped in `persist` middleware that saves the whole game under key `outback-flying-save` in **IndexedDB** (database `outback-flying`, object store `kv`, via the adapter in `idbStorage.ts`), falling back to `localStorage` when IndexedDB is unavailable or a write fails; old `localStorage` saves migrate into IndexedDB on first read. Rehydration is **async** — the UI gates on `useHydrated()` until it finishes (or errors). This is the only place `GameState` is mutated. Every mutation follows the same pattern: `structuredClone` the current state, mutate the clone, `set({ game })`. All money movements go through the local `post()` helper, which appends a `LedgerEntry`, updates the balance, and accumulates `stats.totalEarned` — never adjust `balance` directly. `SAVE_VERSION` gates the persisted schema; bump it when `GameState` shape changes.
- **`types.ts`** — the domain model (`GameState`, `Mission`, `OwnedAircraft`, `AircraftSpec`, `LedgerEntry`, etc.). Start here to understand the data.
- **`economy.ts`** — pure pricing/estimation functions (reward, fuel cost, maintenance, condition wear, suggested block time & fuel). The `suggested*` functions pre-fill the flight-report form; the actual figures the player types are what get charged.
- **`missions.ts`** — procedural mission generation (weighted type roll, origin biased toward bases, distance-gated destination, urgency → deadline → reward). `generateMissions()` refills the board.
- **`geo.ts`** — great-circle distance/bearing between airports (haversine, nautical miles).
- **`flightlog.ts`** — pure SimConnect derivation layer: `recordSample` folds live samples into legs (boundaries driven by engine on/off events — off-block/on-block), plus `matchesAircraft`, `simCapacityL`, `nearestAirport`, track simplification and duty math. No React, no I/O.
- **`simSession.ts`** — the pure always-on session state machine. `reduceSession(state, sample, ctx)` interprets the live sample stream — matches the sim aircraft to a fleet aircraft by pilot position + type, switches fuel authority (game-truth on the ground with engines off, sim-truth in flight), and emits *effects* (`OFF_BLOCK`, `STOP_AT`, `ON_BLOCK`, `SYNC_TO_SIM`, `WARN`, …) that the store applies. All mutation happens in the store, never here.
- **`data/airports.ts`** & **`data/aircraft.ts`** — static catalogues of real-world-inspired airports and aircraft specs. Airports carry `fuelTypes` + `fuelPriceMult` (fuel availability/pricing). Aircraft are looked up by `specId` via `getSpec()`; owned instances (`OwnedAircraft`) reference a spec rather than duplicating it.

### Key domain rules

- **Aircraft have a location.** An `OwnedAircraft` sits at `locationIcao` wherever it last landed, or — when it shut down away from any catalogued field — at a raw `offField` coordinate. `flyMission` rejects a mission whose `fromIcao` differs (and rejects an off-field aircraft outright); the player must `repositionAircraft` (a non-paying ferry that still burns fuel and wears the airframe; also the recovery hatch out of an off-field spot) first.
- **Fuel is a managed resource.** `OwnedAircraft.fuelL` is litres in the tank. Flying draws it down; it is *not* charged per leg. `refuel(...)` is a separate paid action, gated by the field's `fuelTypes`, capped at capacity, priced at the field's `fuelPriceMult`.
- **Two ways a flight is booked.** (1) *Honour system* — `flyMission` trusts the player-reported `blockMinutes`/`fuelLitres`/`landings`; the store validates seats/range/location, charges maintenance, draws fuel from the tank, pays the reward, applies wear, moves the aircraft. (2) *Always-on sim tracking* — when a sim is connected and matched, `useSimSession` folds live samples through `simSession.ts` and applies the resulting effects via store actions: `beginChain`/`armMissions` at off-block, `stopAt` (complete armed missions + arm new ones) at a full stop, `commitLeg` at on-block (per-leg maintenance/wear/duty, external-fuel billing, sim→game fuel + position sync), and `finalizeChain` (one `FlightLog` per contiguous chain). Fuel authority: **on the ground engines-off the game is truth** (a divergence watcher is the *single* writer back to the sim via `setFuel`); **in flight the sim is truth**.
- **Time advances discretely.** `advanceDay` finalizes any open flight chain, charges daily fixed costs, fails accepted missions past their `expiresDay` (penalty + reputation hit, and un-arms them), expires stale board postings, drifts fuel prices ±8%, and refills the board to `MISSION_BOARD_TARGET`.

### UI layer

- **`App.tsx`** — top-level shell: shows `StartScreen` when `game` is null, otherwise the header stat strip + tab navigation (Dashboard / Missions / Fleet / Market / Ledger / Logbook). Provides a `notify` toast callback via `UIContext`, and mounts `SimSessionHost` (which runs the `useSimSession` hook and renders the aircraft-choice dialog).
- **`components/ui.tsx`** — shared `UIContext` (the toast `notify` function) and shared presentational primitives.
- **`sim/useSimSession.ts`** — the one place the pure session reducer is wired to live effects: it folds `useSim()` samples through `reduceSession`, applies each effect via store actions, and surfaces messages as toasts (the store stays React-free and returns message lists — it never calls `notify`).
- Modals: `FlyModal` (honour-mode manual report — the sim path needs no modal), `RepositionModal` (ferry, incl. off-field origin), `RefuelModal` (paid refuel slider, engines-off-gated when a matched sim is flying), and `AircraftChoiceDialog` (disambiguates when several same-type aircraft share the pilot's field).

### Electron shell

`electron/main.js` creates the `BrowserWindow`. In dev (`ELECTRON_DEV=1`) it loads `http://localhost:5173`; in production it loads `dist/index.html` (Vite is configured with `base: './'` so `file://` loading works). `contextIsolation: true` / `nodeIntegration: false` with a `preload.cjs` bridge (CommonJS on purpose — sandboxed preload scripts cannot use ESM, and the repo's `"type": "module"` would make a `.js` preload ESM).

## CI, branching & releases

`master` is the default branch and the production reference. Feature branches merge into it via PR.

- **`.github/workflows/ci.yml`** — runs on every PR into `master` and every push to `master`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Keeps `master` (and every PR) provably green.
- **`.github/workflows/release.yml`** — runs when a PR is merged into `master`. Reads the PR's labels for exactly one of `major` / `minor` / `patch` (priority order major > minor > patch if more than one is present); with none of these labels, the job is a no-op. Otherwise it bumps `package.json`/`package-lock.json` via `npm version <type> --no-git-tag-version`, commits and pushes the bump to `master`, tags it `vX.Y.Z`, builds the Windows installer (`npm run electron:build`), and publishes a GitHub Release with the installer attached.
- Label a PR `major`, `minor`, or `patch` before merging when the merge should cut a release.

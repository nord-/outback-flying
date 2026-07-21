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

Outback Flying is a single-player career manager: the player flies each leg in their own external flight simulator and reports the results back to the app, which runs the *business* (economy, fleet, reputation, calendar). It is a Vite + React + TypeScript web app wrapped in an Electron desktop shell.

### The core boundary: `src/game/` is UI-agnostic

All game rules and state live in `src/game/` as pure TypeScript with **no React imports**. The React components in `src/components/` only render state and dispatch actions through the Zustand store. Preserve this separation — put logic in `src/game/`, not in components.

- **`store.ts`** — the single Zustand store (`useGame`), wrapped in `persist` middleware that saves the whole game under `localStorage` key `outback-flying-save`. This is the only place `GameState` is mutated. Every mutation follows the same pattern: `structuredClone` the current state, mutate the clone, `set({ game })`. All money movements go through the local `post()` helper, which appends a `LedgerEntry`, updates the balance, and accumulates `stats.totalEarned` — never adjust `balance` directly. `SAVE_VERSION` gates the persisted schema; bump it when `GameState` shape changes.
- **`types.ts`** — the domain model (`GameState`, `Mission`, `OwnedAircraft`, `AircraftSpec`, `LedgerEntry`, etc.). Start here to understand the data.
- **`economy.ts`** — pure pricing/estimation functions (reward, fuel cost, maintenance, condition wear, suggested block time & fuel). The `suggested*` functions pre-fill the flight-report form; the actual figures the player types are what get charged.
- **`missions.ts`** — procedural mission generation (weighted type roll, origin biased toward bases, distance-gated destination, urgency → deadline → reward). `generateMissions()` refills the board.
- **`geo.ts`** — great-circle distance/bearing between airports (haversine, nautical miles).
- **`data/airports.ts`** & **`data/aircraft.ts`** — static catalogues of real-world-inspired outback airports and aircraft specs. Aircraft are looked up by `specId` via `getSpec()`; owned instances (`OwnedAircraft`) reference a spec rather than duplicating it.

### Key domain rules

- **Aircraft have a location.** An `OwnedAircraft` sits at `locationIcao` wherever it last landed. `flyMission` rejects a mission whose `fromIcao` differs; the player must `repositionAircraft` (a non-paying ferry leg that still burns fuel and wears the airframe) first.
- **Flying is on the honour system.** `flyMission` trusts the player-reported `blockMinutes`, `fuelLitres`, and `landings`; the store validates seats/range/location, then charges fuel + maintenance, pays the reward, applies wear, and moves the aircraft to `toIcao`.
- **Time advances discretely.** `advanceDay` charges daily fixed costs, fails accepted missions past their `expiresDay` (penalty + reputation hit), expires stale board postings, drifts fuel prices ±8%, and refills the board to `MISSION_BOARD_TARGET`.

### UI layer

- **`App.tsx`** — top-level shell: shows `StartScreen` when `game` is null, otherwise the header stat strip + tab navigation (Dashboard / Missions / Fleet / Market / Ledger). Provides a `notify` toast callback via `UIContext`.
- **`components/ui.tsx`** — shared `UIContext` (the toast `notify` function) and shared presentational primitives.
- Modals (`FlyModal`, `RepositionModal`) collect the flight-report figures and call the corresponding store action, which returns a `FlyOutcome` describing the financial result.

### Electron shell

`electron/main.js` creates the `BrowserWindow`. In dev (`ELECTRON_DEV=1`) it loads `http://localhost:5173`; in production it loads `dist/index.html` (Vite is configured with `base: './'` so `file://` loading works). `contextIsolation: true` / `nodeIntegration: false` with a `preload.js` bridge.

## CI, branching & releases

`master` is the default branch and the production reference. Feature branches merge into it via PR.

- **`.github/workflows/ci.yml`** — runs on every PR into `master` and every push to `master`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Keeps `master` (and every PR) provably green.
- **`.github/workflows/release.yml`** — runs when a PR is merged into `master`. Reads the PR's labels for exactly one of `major` / `minor` / `patch` (priority order major > minor > patch if more than one is present); with none of these labels, the job is a no-op. Otherwise it bumps `package.json`/`package-lock.json` via `npm version <type> --no-git-tag-version`, commits and pushes the bump to `master`, tags it `vX.Y.Z`, builds the Windows installer (`npm run electron:build`), and publishes a GitHub Release with the installer attached.
- Label a PR `major`, `minor`, or `patch` before merging when the merge should cut a release.

# Brainstorm — Issue #9: SimConnect flight recording

Status: **brainstorm / design exploration** (not a committed design). Goal is to map the
solution space, name the hard problems early, and propose a phased path so we can decide
before writing feature code.

Issue summary: instead of the current honour system (player types block time / fuel into
`FlyModal`), read the real flight from the simulator over SimConnect, verify it against the
mission, record the track, and produce a **flight log** with block/flight/duty time,
distance, legs, fuel used, earnings, and a plotted track.

---

## 1. Where this collides with the current architecture

Two rules from `CLAUDE.md` shape every decision here:

1. **`src/game/` is UI-agnostic pure TypeScript, no side effects, no imports of React or
   platform APIs.** SimConnect is the opposite of that: a stateful, Windows-only, native
   I/O stream.
2. **The whole `GameState` is persisted to `localStorage` under one key**
   (`outback-flying-save`) via the Zustand `persist` middleware.

So the feature naturally splits into **three layers**, and getting the seams right is most
of the design:

| Layer | Home | Nature | Testable? |
|-------|------|--------|-----------|
| **Sim I/O** — connect, poll SimVars, stream samples | `electron/` (main process) | Impure, native, Windows-only | Barely — keep it thin |
| **Flight derivation** — samples + mission → `FlightLog` (leg detection, block/flight/duty, distance, fuel, airport/aircraft matching) | `src/game/flightlog.ts` (new) | **Pure** | **Yes — Vitest** |
| **State + UI** — store action to commit a log, Logbook view, track on map | `src/game/store.ts`, `src/components/` | React / Zustand | Store already has tests |

The rule of thumb: **the electron layer produces raw samples; the pure layer turns samples
into a `FlightLog`; the store commits it.** All the interesting logic (and all the tests)
lives in the pure layer.

### Why SimConnect can't live in the renderer

SimConnect needs Node/native access. The renderer runs with `contextIsolation: true` /
`nodeIntegration: false` (see `electron/main.js`) — no Node there. So sim access runs in the
**main process** and reaches the React app through the `preload.js` bridge (which already
anticipates this: *"Extend this bridge if native features … SimConnect … are added later"*).

Consequence: **this is an Electron + Windows feature only.** `npm run dev` (plain web) and
non-Windows builds must degrade gracefully — keep the manual `FlyModal` entry as the
fallback path. Feature-detect via `window.outback`.

---

## 2. Talking to the sim: `node-simconnect`

The obvious enabler is [`node-simconnect`](https://www.npmjs.com/package/node-simconnect) — a
**pure-TypeScript** reimplementation of the SimConnect protocol (talks to the sim over
TCP/named pipe). Pure-JS matters a lot here:

- **No native compile step** → `npm ci` on the Linux CI runner won't try to build a Windows
  addon and fall over.
- Works with MSFS 2020 / 2024 and legacy FSX/P3D.

**Critical build constraint:** `node-simconnect` must be imported **only from `electron/`**,
never from anything Vite bundles (`src/`). If it leaks into the web bundle the browser build
breaks. Keep a hard wall: `src/game/` and `src/components/` never `import` it. The renderer
only ever sees plain serialisable messages over IPC.

Open risk to verify in Phase 1: protocol/version compatibility with **MSFS 2024**
specifically, and behaviour when the sim isn't running (must fail soft, not crash the app).

### SimVars we need

| Purpose | SimVar(s) |
|---------|-----------|
| Position | `PLANE LATITUDE`, `PLANE LONGITUDE` (radians → degrees) |
| Heading | `PLANE HEADING DEGREES TRUE` (+ magnetic if we want to show it) |
| Speed | `GROUND VELOCITY` (kts), optionally `AIRSPEED TRUE` |
| Altitude | `INDICATED ALTITUDE` and/or `PLANE ALTITUDE` (ft) |
| On ground / leg detection | `SIM ON GROUND` (bool), `GENERAL ENG COMBUSTION:1` for engine start/stop |
| Fuel | `FUEL TOTAL QUANTITY` (gal) and/or `FUEL TOTAL QUANTITY WEIGHT` (lb/kg) |
| Aircraft ID (forgiveness) | `TITLE`, `ATC MODEL`, `ATC TYPE` |

---

## 3. The flight state machine (leg detection)

A "flight" per the issue can be **multiple legs** (fuel/overnight stops). We derive legs from
the sim, we don't ask the player to declare them.

Proposed transitions, driven by `SIM ON GROUND` + groundspeed + engine:

```
IDLE ──(engine start OR groundspeed > ~3 kt at departure)──▶ LEG_ACTIVE (block clock starts)
LEG_ACTIVE ──(SIM ON GROUND false, first time)──▶ AIRBORNE (flight clock starts)
AIRBORNE  ──(SIM ON GROUND true, stable > N s)──▶ LANDED (flight clock stops; +1 landing)
LANDED    ──(stationary + engine off / player "end leg")──▶ leg closed
          ──(taxi/takeoff again)──▶ back to LEG_ACTIVE (next leg)
end of flight ──(player confirms complete OR shutdown at a matching destination)──▶ COMMIT
```

Definitions (all computed in the pure layer):

- **Block time** = brakes-release/first-movement at first airport → final shutdown at last
  airport, **minus** time parked between legs? No — per issue, ground stops *add* duty time,
  so **block time = sum of each leg's chocks-off → chocks-on**; parked/refuelling time in
  between is *not* block time but *is* captured by the duty formula.
- **Flight time** = sum of airborne segments (wheels-up → wheels-down) across all legs.
- **Distance (NM)** = sum of great-circle distance between consecutive track samples (reuse
  `geo.ts` haversine). Using sampled track distance (not straight from/to) rewards the actual
  route flown.

### Duty time — the formula from the issue

> "30 mins added to block time for each stop including the starting airport, i.e. one leg 60
> minutes, two leg trip 90 minutes"

Worked out: stops = legs + 1 (start + each landing).

```
dutyMinutes = blockMinutes + 30 * (legs + 1)
```

- 1 leg → 2 stops → +60 min ✓
- 2 legs → 3 stops → +90 min ✓

This is a trivially pure, unit-testable function. (Actual **duty-time gameplay** — limits,
rest — is explicitly a separate future issue; here we only *record* it.)

---

## 4. "Be forgiving" — aircraft & airport matching

### Aircraft

The sim reports free-text `TITLE` / `ATC MODEL` (e.g. `"Bonanza A36"`) but the mission was
flown with a chosen `AircraftSpec` (e.g. `Bonanza G36`). The issue wants family-level
forgiveness.

Proposal: add match keywords to each spec and do case-insensitive substring/family matching
in a pure `matchesAircraft(spec, simTitle)` function.

```ts
// data/aircraft.ts — new optional field
simMatch: ['bonanza']            // bonanza      → any Bonanza (A36/G36/V35…)
simMatch: ['baron']              // baron        → any Baron
simMatch: ['grand caravan','208','caravan']  // c208
```

Tiers of strictness (pick per gameplay taste, all pure + testable):

1. **Exact family** — sim title must contain one of the spec's keywords (recommended
   default: forgiving but not blank-cheque).
2. **Category fallback** — if no family hit, accept same `category` (a King Air for a PC-12)
   with a soft warning.
3. **Warn-only** — never block, just flag a mismatch on the log.

Recommendation: start at tier 1, surface a non-blocking warning on tier-2/3 so the player
isn't stuck if a livery names itself oddly.

### Airports

SimConnect gives lat/lon, not an ICAO directly. Simplest self-contained approach: **nearest
airport in our own catalogue** (`data/airports.ts`) via `geo.ts`, within a tolerance
(e.g. ≤ 3–5 NM = "at" that field). Pure function `nearestAirport(lat, lon)`.

Caveats to decide on:

- Our catalogue is a **curated outback subset**. If the player lands at a real field we don't
  model, nearest-match will snap to the wrong ICAO. Options: (a) widen the catalogue, (b)
  accept "unknown field" as an intermediate stop with just coordinates, (c) use SimConnect
  facility requests to get the sim's own ICAO (more work, most correct).
- Verification against the mission = "did departure ≈ `mission.fromIcao` and final ≈
  `mission.toIcao`?" within tolerance. Intermediates are informational.

---

## 5. Fuel used

`FUEL TOTAL QUANTITY` sampled at each leg boundary. **Fuel used = Σ per-leg (start − end)**,
ignoring increases (a refuel between legs shows fuel going *up* — don't count that as
negative burn). Convert gallons → litres for AVGAS; the issue allows "liters or kgs" — JetA is
often quoted by weight, so we can store litres as the canonical number and optionally show kg
for turbine types. This burned figure then feeds the existing `fuelCost()` in `economy.ts`.

---

## 6. Data model additions (`types.ts`)

```ts
export interface TrackPoint {
  t: number          // seconds since flight start (not wall clock — keeps it small & replayable)
  lat: number
  lon: number
  hdg: number        // degrees true
  gs: number         // groundspeed, kts
  alt: number        // ft
  onGround: boolean
}

export interface FlightLeg {
  fromIcao: string
  toIcao: string
  blockMinutes: number
  flightMinutes: number
  distanceNm: number
  fuelUsedL: number
}

export interface FlightLog {
  id: string
  day: number                 // game day it was committed
  missionId?: string          // undefined = free flight / reposition
  aircraftId: string
  simAircraftTitle: string    // what the sim reported (for the forgiveness audit trail)
  legs: FlightLeg[]
  startIcao: string
  endIcao: string
  intermediates: string[]
  blockMinutes: number
  flightMinutes: number
  dutyMinutes: number
  distanceNm: number
  fuelUsedL: number
  earnings: number
  track: TrackPoint[]         // simplified — see §7
}
```

Add `flightLogs: FlightLog[]` to `GameState` (or store separately — see §7) and **bump
`SAVE_VERSION`** (currently 3 → 4) with a migration that defaults `flightLogs` to `[]`.

---

## 7. The biggest technical risk: track size vs `localStorage`

The whole `GameState` lives in one `localStorage` key. A 2-hour flight sampled at **1 Hz** is
~7,200 points; multiple multi-leg flights kept forever will blow past the ~5–10 MB
`localStorage` ceiling and bloat every `structuredClone` in the store.

Mitigations (recommend combining the first two):

1. **Simplify the track before saving** — Ramer–Douglas–Peucker (pure, testable). A cross-
   country track compresses enormously with negligible visual loss. Store the simplified
   polyline; that's all the map needs.
2. **Adaptive sampling** — e.g. 1 sample / 2–4 s airborne, sparse on the ground, plus
   "keyframe on turn > X°". Keeps raw size down before simplification even runs.
3. **Move logs out of the main save** — in Electron, write full flight logs to a JSON file in
   `userData` and keep only lightweight summaries (no `track`) in `GameState`; load the track
   on demand when a flight is selected. Cleaner long-term, more plumbing. Could be a Phase-5+
   follow-up once the in-save approach shows strain.

Decision needed: simplified-in-save (simplest, ship first) vs file-backed logs (scales
better). I lean **simplified-in-save for MVP**, with the data model kept file-backable later.

---

## 8. UX / integration with the existing flow

Today: accept mission → `FlyModal` → type figures → `flyMission()` charges/pays/moves aircraft.

Proposed with SimConnect (Electron/Windows):

1. Accept mission as now.
2. A **"Fly live"** affordance (in `FlyModal` or a new panel) shows **connection status** and
   a live readout (position, on-ground, fuel) once the sim is detected.
3. Recording runs the state machine of §3; UI shows legs accumulating, live block/flight
   clocks, current nearest field.
4. On completion, we **pre-fill the existing report** from measured data instead of
   `suggested*` estimates — the player confirms, then a store action commits both the
   `FlyOutcome` (as today) **and** the `FlightLog`.
5. **Logbook**: a new tab (or a section under Fleet/Ledger) listing `flightLogs`; selecting
   one plots its `track` as a Leaflet `Polyline` on the map. `OperationsMap` already imports
   `Polyline`, and `mapView.ts` is the natural home for a pure "selected track → map points"
   selector.

Manual entry stays as the fallback whenever the sim/bridge isn't present, so the web build and
non-Windows users keep working.

### Store surface (sketch)

Rather than overload `flyMission`, add a sibling that takes a finished recording:

```ts
commitFlightLog: (log: DerivedFlight) => FlyOutcome
```

It reuses the same money/wear/relocation logic (`post()`, `conditionLoss`, aircraft
relocation) but sources block/fuel/landings from the recording, and appends the `FlightLog`.
`flyMission` (manual) stays for the fallback path. Both funnel through shared helpers so the
economy rules live in one place.

Note: recording should also be attachable to a **reposition** (a ferry leg is still a flight
worth logging), so consider making the recorder mission-agnostic and letting the commit step
decide whether it satisfies a mission or just a reposition.

---

## 9. Proposed phasing

Each phase is independently shippable and testable; earliest phases retire the most risk.

- **Phase 0 — spike (throwaway):** stand up `node-simconnect` in `electron/`, log SimVars to
  console with the sim running. Confirms MSFS 2024 compatibility, TCP setup, and fail-soft
  when the sim is closed. *Answers the "does this even work here" question before we build UI.*
- **Phase 1 — bridge + live readout:** main-process connection manager, `preload.js` exposes
  `window.outback.sim` (connect / status / sample stream over IPC). A tiny "Sim: connected"
  indicator. No recording yet.
- **Phase 2 — pure derivation + data model:** `src/game/flightlog.ts` (leg detection, block/
  flight/duty, distance via `geo.ts`, fuel, nearest-airport, aircraft match, RDP simplify) +
  `types.ts` additions + `SAVE_VERSION` bump + migration. **Heavily unit-tested against
  synthetic sample streams** — no sim required for these tests.
- **Phase 3 — recording lifecycle:** wire the bridge stream into the state machine; produce a
  `DerivedFlight`; verify airports/aircraft with forgiveness and surface warnings.
- **Phase 4 — commit + economy:** `commitFlightLog` store action; pre-fill/replace the manual
  report; earnings, wear, relocation via shared helpers.
- **Phase 5 — Logbook UI + track on map:** list logs, select one → plot track polyline.
- **Later (separate issues):** duty-time *gameplay* (limits/rest), file-backed log storage if
  the in-save track proves too heavy, richer airport catalogue / facility lookups.

---

## 10. Open questions for @nord-

1. **Recording control — automatic or manual?** Auto-detect start (engine/first movement) and
   end (shutdown at destination), or explicit "Start/Stop recording" buttons? Auto is smoother
   but riskier to get right; manual is predictable. (Leaning: auto-detect legs, with a manual
   "end flight" confirm.)
2. **Track storage for MVP** — simplified-in-save (ship first) vs file-backed logs from the
   start? (Leaning: simplified-in-save.)
3. **Aircraft forgiveness strictness** — block on family mismatch, or warn-only and let the
   flight count anyway? (Leaning: family match, warn on category fallback.)
4. **Airports off-catalogue** — snap to nearest known ICAO, record raw coords as "unknown
   field", or invest in SimConnect facility lookups for true ICAOs?
5. **Fuel units** — canonical litres everywhere, or show kg for turbine (JetA) types?
6. **Sim scope** — MSFS 2024 only, or also keep 2020/FSX/P3D working (affects how much
   compatibility testing Phase 0 needs)?
7. **Does live recording *replace* the honour system on Windows, or sit alongside it** as an
   optional "verified" flight that maybe earns a small reputation/earnings bonus for using it?

---

## 11. Summary recommendation

- Enable it with **`node-simconnect` in the Electron main process only**, bridged to the
  renderer via `preload.js`; never import it from `src/`.
- Keep **all derivation logic pure in `src/game/flightlog.ts`** and test it against synthetic
  sample streams — the sim is only needed for the thin I/O layer and manual end-to-end checks.
- **Simplify tracks (RDP) before saving** and bump `SAVE_VERSION`; revisit file-backed storage
  if the in-save track gets heavy.
- **Preserve the manual `FlyModal` path** as the graceful fallback for web/non-Windows.
- Ship in phases, **Phase 0 spike first** to retire the SimConnect-compatibility risk before
  building anything on top of it.

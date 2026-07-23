# Phase 0 spike findings — SimConnect (issue #9)

Throwaway spike to answer "does SimConnect work here?" before building the feature.
Code: [`electron/simconnect-spike.js`](../electron/simconnect-spike.js). Run with
`npm run simconnect:spike`.

## Verified in this environment (Linux, no simulator)

- **`node-simconnect` is pure JS.** v4.2.0, CommonJS, no native addon (no `binding.gyp`,
  no `.node` binaries). Its deps (`debug`, `ini`, `regedit`) are also pure JS. So `npm ci`
  on the Linux CI runner installs it without a compile step — confirms the assumption the
  brainstorm rested on.
- **It imports cleanly in an ESM Electron context.** The package is CommonJS and our project
  is `"type": "module"`; importing the namespace (`import simconnect from 'node-simconnect'`)
  and destructuring works.
- **Fail-soft when no sim is reachable.** Running the spike with no simulator attempts
  discovery, gets `ECONNREFUSED`, prints a clear message, and exits with code 1 — no hang,
  no crash. A `SIMCONNECT_TIMEOUT_MS` race guards against a discovery hang as a backstop.
- **It does not leak into the web bundle.** `node-simconnect` is imported only from
  `electron/`; `src/` never touches it, so `vite build` output contains no reference to it.
  Typecheck, tests, and build all stay green with the dependency added.

## Still needs a real sim (Windows) to confirm

These require running `npm run simconnect:spike` against MSFS/FSX/P3D — I can't do it here:

- Actual connection + SimVar streaming (position, heading, groundspeed, altitude,
  `SIM ON GROUND`, fuel, `TITLE`/`ATC MODEL`) at 1 Hz.
- **MSFS 2024 specifically** — the spike defaults to `Protocol.SunRise`; confirm it connects,
  or set `SIMCONNECT_PROTOCOL=KittyHawk` for MSFS 2020.
- The `TITLE` / `ATC MODEL` strings that will drive aircraft-forgiveness matching (§4 of the
  brainstorm) — capture real values to build the match keyword list from.
- Optional: remote/LAN connection via `SIMCONNECT_HOST`/`SIMCONNECT_PORT` (validates the
  cross-platform claim — a Linux/macOS client reaching a Windows sim).

### How to run against your sim

```bash
# Same machine as the sim:
npm run simconnect:spike

# MSFS 2020 instead of 2024:
SIMCONNECT_PROTOCOL=KittyHawk npm run simconnect:spike

# Sim on another PC (open a TCP port in SimConnect.xml first):
SIMCONNECT_HOST=192.168.1.50 SIMCONNECT_PORT=500 npm run simconnect:spike
```

## Conclusion

Nothing here blocks the approach. The library is CI-safe, imports cleanly, degrades
gracefully, and stays out of the web build. Once the live-streaming check passes on a
Windows sim, we can proceed to Phase 1 (the main-process bridge + `window.outback.sim`).
The spike script is disposable — its wiring will be rebuilt properly in Phase 1.

// Dev-only helper for issue #5: pulls runway length, surface and lighting from
// the OurAirports public-domain dataset so the static catalogue in
// src/data/airports.ts can carry real physical field data.
//
// The CSVs are NOT committed (16 MB, and they churn). Download them first:
//   curl -sSL -o airports.csv https://davidmegginson.github.io/ourairports-data/airports.csv
//   curl -sSL -o runways.csv https://davidmegginson.github.io/ourairports-data/runways.csv
//
// Usage:
//   node scripts/curate-airports.mjs enrich <airports.csv> <runways.csv> YBAS,YBHI,...
//   node scripts/curate-airports.mjs candidates <airports.csv> <runways.csv> AU [maxRunwayM]
//
// This script deliberately does NOT enforce the distance rules from the design
// spec (§4.4). Those live in src/data/airports.test.ts, which has the real
// catalogue to compare against — the tests are the gate, not this script.

import { readFileSync } from 'node:fs'

const FEET_TO_M = 0.3048

// Only codes we have actually seen in our selection are mapped. Anything else
// returns null and the field is skipped rather than guessed (spec §4.3).
const SURFACE_MAP = new Map(
  Object.entries({
    ASP: 'sealed', ASPH: 'sealed', 'ASPH-G': 'sealed', ASPHALT: 'sealed',
    CON: 'sealed', CONC: 'sealed', CONCRETE: 'sealed', PEM: 'sealed', BIT: 'sealed',
    GVL: 'gravel', GRAVEL: 'gravel', GRVL: 'gravel',
    DIRT: 'dirt', EARTH: 'dirt', CLA: 'dirt', CLAY: 'dirt', GRE: 'dirt',
    TURF: 'grass', GRS: 'grass', GRASS: 'grass', 'TURF-G': 'grass',
    SAN: 'sand', SAND: 'sand',
    // An explicitly unpaved surface is dirt; "soft" is grass. Both carry real
    // information, unlike UNK / Hard / blank, which stay unmapped so the field
    // is skipped rather than guessed.
    UNPAVED: 'dirt', SOFT: 'grass',
    // OurAirports appends a condition-rating suffix (-G good / -F fair / -P
    // poor) to some material codes; '-G' was already mapped above. '-F' is
    // the same material (asphalt) at a lower condition rating, not a
    // different surface, so it maps the same way. Added after verification
    // showed it silently dropped PABE/PAKN/PANI's actual longest (and real,
    // lit) runway in favour of a shorter secondary one — see task-2-report.md.
    'ASPH-F': 'sealed',
    // 'PER' = permeable/porous friction course, a sealed (asphalt) wearing
    // surface — not a distinct material. Verified independently of any one
    // airport: it appears 30 times across runways.csv, including KCID
    // (Cedar Rapids) at 8600 ft, which is unambiguously paved. Added after
    // it silently dropped YCBP's real 4685 ft sealed primary runway in
    // favour of a 2720 ft grass secondary — see task-2-report.md.
    PER: 'sealed',
  })
)

function normaliseSurface(raw) {
  const key = (raw ?? '').trim().toUpperCase()
  return SURFACE_MAP.get(key) ?? null
}

/** Minimal RFC4180-ish parser: handles quoted fields and embedded commas. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false }
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  const header = rows.shift()
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

/**
 * Longest non-closed runway per airport ident with a normalised (mapped)
 * surface, PLUS the longest non-closed runway per ident regardless of
 * whether its surface maps, PLUS the longest per ident among ONLY the rows
 * whose surface failed to map — so callers can tell whether the "best" pick
 * is actually the field's longest runway, or a shorter one being reported
 * because the true longest (or an equal-length alternative) has an unmapped
 * surface code. Silently falling back to a shorter runway is exactly the bug
 * that understated YCBP's runway by ~600 m — `enrich` mode surfaces the gap
 * instead of hiding it.
 */
// Tie-break preference when two mapped-surface runways are equally long and
// equally lit: the more informative surface wins, ranked from a sealed
// primary (most likely the field's real runway) down to sand.
const SURFACE_TIE_RANK = { sealed: 0, gravel: 1, grass: 2, dirt: 3, sand: 4 }

function analyseRunways(runwayRows) {
  const best = new Map() // ident -> longest row with a mapped surface
  const longestOverall = new Map() // ident -> longest row, any surface (used only when NO row maps at all)
  const longestUnmapped = new Map() // ident -> longest row among those whose surface failed to map
  for (const r of runwayRows) {
    if (r.closed === '1') continue
    const lengthFt = Number(r.length_ft)
    if (!Number.isFinite(lengthFt) || lengthFt <= 0) continue

    const prevOverall = longestOverall.get(r.airport_ident)
    if (!prevOverall || lengthFt > prevOverall.lengthFt) {
      longestOverall.set(r.airport_ident, { lengthFt, rawSurface: (r.surface ?? '').trim() })
    }

    const surface = normaliseSurface(r.surface)
    if (!surface) {
      const prevUnmapped = longestUnmapped.get(r.airport_ident)
      if (!prevUnmapped || lengthFt > prevUnmapped.lengthFt) {
        longestUnmapped.set(r.airport_ident, { lengthFt, rawSurface: (r.surface ?? '').trim() })
      }
      continue
    }
    const prev = best.get(r.airport_ident)
    // On an exact length tie, the first row seen would otherwise win by
    // default — arbitrary, since row order in the source CSV carries no
    // meaning. Prefer the more informative candidate instead: lit over
    // unlit first (this is what exposed YBLA: an unlit grass runway was
    // beating an equal-length lit sealed one purely by being listed first
    // in runways.csv), then — when lit status also ties — the more
    // informative surface (SURFACE_TIE_RANK).
    if (prev && prev.lengthFt > lengthFt) continue
    if (prev && prev.lengthFt === lengthFt && prev.lighted && !(r.lighted === '1')) continue
    if (
      prev &&
      prev.lengthFt === lengthFt &&
      prev.lighted === (r.lighted === '1') &&
      SURFACE_TIE_RANK[prev.surface] <= SURFACE_TIE_RANK[surface]
    ) continue
    best.set(r.airport_ident, {
      lengthFt,
      surface,
      lighted: r.lighted === '1',
      runwayM: Math.round((lengthFt * FEET_TO_M) / 10) * 10,
    })
  }
  return { best, longestOverall, longestUnmapped }
}

const [mode, airportsPath, runwaysPath, arg4, arg5] = process.argv.slice(2)
if (!mode || !airportsPath || !runwaysPath) {
  console.error('usage: node scripts/curate-airports.mjs <enrich|candidates> <airports.csv> <runways.csv> <arg>')
  process.exit(1)
}

const airports = parseCsv(readFileSync(airportsPath, 'utf8'))
const { best: runways, longestOverall, longestUnmapped } = analyseRunways(parseCsv(readFileSync(runwaysPath, 'utf8')))

if (mode === 'enrich') {
  const wanted = (arg4 ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const byIdent = new Map(airports.map((a) => [a.ident, a]))
  for (const ident of wanted) {
    const a = byIdent.get(ident)
    const rw = runways.get(ident)
    const overall = longestOverall.get(ident)
    const unmapped = longestUnmapped.get(ident)
    if (!a) { console.log(`${ident}\tMISSING FROM DATASET`); continue }
    if (!rw) {
      if (overall) {
        console.log(`${ident}\tNO USABLE RUNWAY — longest is ${overall.lengthFt} ft with unmapped surface '${overall.rawSurface}'`)
      } else {
        console.log(`${ident}\tNO USABLE RUNWAY (unknown surface or length)`)
      }
      continue
    }
    // A runway at least as long as the chosen (mapped) one exists but was
    // skipped because its surface code doesn't map — say so loudly instead
    // of quietly reporting the mapped one as if it were unambiguously the
    // field's runway. `>=`, not `>`: an equal-length unmapped alternative is
    // just as worth a human's attention as a longer one, since we have no
    // way to tell which of the two ties is the field's "real" primary.
    const skipWarning = unmapped && unmapped.lengthFt >= rw.lengthFt
      ? ` !! SKIPPING RUNWAY >= CHOSEN LENGTH: ${unmapped.lengthFt} ft, unmapped surface '${unmapped.rawSurface}'`
      : ''
    console.log(`${ident}\trunwayM: ${rw.runwayM}, surface: '${rw.surface}', lighted: ${rw.lighted}\t# ${a.name}, ${rw.lengthFt} ft${skipWarning}`)
  }
} else if (mode === 'candidates') {
  const country = (arg4 ?? '').trim().toUpperCase()
  const maxRunwayM = Number(arg5 ?? 1200)
  const out = []
  for (const a of airports) {
    if (a.iso_country !== country) continue
    if (a.type !== 'small_airport' && a.type !== 'medium_airport') continue
    const rw = runways.get(a.ident)
    if (!rw) continue
    if (rw.runwayM > maxRunwayM) continue
    out.push({ ...a, ...rw })
  }
  out.sort((x, y) => x.ident.localeCompare(y.ident))
  console.log(`# ${out.length} candidates in ${country} with known surface and runwayM <= ${maxRunwayM}`)
  for (const c of out) {
    // Same warning as `enrich`: an unmapped-surface runway at least as long
    // as the one used here means this candidate's runwayM may be
    // understated — which matters more here than in `enrich`, since an
    // understated length is exactly what can wrongly admit a field as a
    // strip candidate in the first place.
    const unmapped = longestUnmapped.get(c.ident)
    if (unmapped && unmapped.lengthFt >= c.lengthFt) {
      console.error(
        `!! ${c.ident}: SKIPPING RUNWAY >= CHOSEN LENGTH: ${unmapped.lengthFt} ft, unmapped surface '${unmapped.rawSurface}' — candidate below may understate the runway`
      )
    }
    console.log(
      `{ icao: '${c.ident}', name: '${c.name.replace(/'/g, "\\'")}', state: '${c.iso_region}', ` +
      `lat: ${Number(c.latitude_deg).toFixed(3)}, lon: ${Number(c.longitude_deg).toFixed(3)}, ` +
      `type: 'strip', runwayM: ${c.runwayM}, surface: '${c.surface}', lighted: ${c.lighted}, ` +
      `fuelTypes: [], fuelPriceMult: 1.35 },`
    )
  }
} else {
  console.error(`unknown mode: ${mode}`)
  process.exit(1)
}

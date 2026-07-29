// Remembers where the desktop window was and how big it was, so relaunching
// doesn't dump the player back at the hardcoded default every time.
//
// The state lives in a single JSON file under `app.getPath('userData')` — no
// dependency needed for one small file, and it sits next to whatever else
// Electron keeps per user. Every read and write is guarded: a missing, empty
// or corrupt file must never keep the app from starting.
//
// Deliberately does not import `electron`: main.js injects the user-data
// directory and the display layout, so the geometry rules can be exercised in
// plain Node without the desktop runtime.
import fs from 'node:fs'
import path from 'node:path'

export const DEFAULT_SIZE = { width: 1280, height: 820 }
export const MIN_SIZE = { width: 960, height: 640 }

// A restored window has to expose at least this much of itself inside some
// display's work area. Grabbing the title bar is how you move a window back,
// so a window that lands entirely on a monitor that is no longer connected is
// unreachable — we drop its position rather than restore it.
const MIN_VISIBLE = { width: 120, height: 48 }

const SAVE_DEBOUNCE_MS = 400

export function windowStateFile(userDataDir) {
  return path.join(userDataDir, 'window-state.json')
}

function isSize(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isPosition(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

// Overlapping area between two rects, or null when they don't intersect.
function intersection(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return width > 0 && height > 0 ? { width, height } : null
}

// The work area this rect should be considered to live on: the one it overlaps
// most, provided a usable part of the window falls inside it. null means the
// rect isn't reachable on the current display layout.
function hostArea(rect, workAreas) {
  let best = null
  let bestArea = 0
  for (const area of workAreas) {
    const overlap = intersection(rect, area)
    if (!overlap) continue
    if (overlap.width < MIN_VISIBLE.width || overlap.height < MIN_VISIBLE.height) continue
    const size = overlap.width * overlap.height
    if (size > bestArea) {
      best = area
      bestArea = size
    }
  }
  return best
}

function fit(value, fallback, min, limit) {
  const wanted = isSize(value) ? value : fallback
  return Math.min(Math.max(Math.round(wanted), min), limit)
}

/**
 * Turn a saved state into `BrowserWindow` bounds that are safe on the display
 * layout described by `workAreas` (`screen.getAllDisplays().map(d => d.workArea)`,
 * primary first). Pure — the caller supplies the layout.
 *
 * Size is carried over but never exceeds the display it lands on. Position is
 * carried over only when the window would still be reachable there; otherwise
 * `x`/`y` are omitted and Electron centres the window.
 */
export function restoreBounds(saved, workAreas = []) {
  const fallbackArea = workAreas[0] ?? null
  const width = isSize(saved?.width) ? saved.width : DEFAULT_SIZE.width
  const height = isSize(saved?.height) ? saved.height : DEFAULT_SIZE.height

  const placed =
    isPosition(saved?.x) && isPosition(saved?.y)
      ? hostArea({ x: saved.x, y: saved.y, width, height }, workAreas)
      : null
  const area = placed ?? fallbackArea

  const size = {
    width: fit(width, DEFAULT_SIZE.width, MIN_SIZE.width, area?.width ?? Infinity),
    height: fit(height, DEFAULT_SIZE.height, MIN_SIZE.height, area?.height ?? Infinity),
  }

  return placed
    ? { ...size, x: Math.round(saved.x), y: Math.round(saved.y) }
    : size
}

/** Read the saved state, or null when there is nothing usable on disk. */
export function loadWindowState(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    // First run, or a file we can't make sense of. Either way: use the defaults.
    return null
  }
}

export function saveWindowState(state, file) {
  try {
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8')
  } catch {
    // Losing the window position is not worth interrupting the player over.
  }
}

/** Bounds to open the window with, plus whether it should start maximized. */
export function initialWindowState(file, workAreas) {
  const saved = loadWindowState(file)
  return {
    bounds: restoreBounds(saved, workAreas),
    isMaximized: saved?.isMaximized === true,
  }
}

/** Persist `win`'s geometry as the player moves, resizes and finally closes it. */
export function trackWindow(win, file) {
  let timer = null

  const capture = () => {
    // getNormalBounds() reports the un-maximized rect, so a window closed while
    // maximized still remembers a sensible size to restore down to.
    const { x, y, width, height } = win.getNormalBounds()
    return { x, y, width, height, isMaximized: win.isMaximized() }
  }

  const persist = () => {
    timer = null
    if (!win.isDestroyed()) saveWindowState(capture(), file)
  }

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(persist, SAVE_DEBOUNCE_MS)
  }

  for (const event of ['resize', 'move', 'maximize', 'unmaximize']) win.on(event, schedule)

  // The window still exists during 'close', so this snapshot is authoritative
  // and supersedes any write the debounce hasn't flushed yet.
  win.on('close', () => {
    if (timer) clearTimeout(timer)
    timer = null
    saveWindowState(capture(), file)
  })
}

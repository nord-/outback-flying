// Full FlightLog records (including their track) live in their own IndexedDB
// database, separate from the main save (idbStorage.ts). This is what lets a
// long game's recorded tracks grow without bloating the save that's rewritten
// on every mutation — GameState only ever holds the lightweight
// FlightLogSummary (see types.ts); the full record (with `track`) is fetched
// on demand when a flight is selected in the Logbook.
//
// Tracks are a nice-to-have, not save-critical, so unlike idbStorage.ts this
// has no localStorage fallback: if IndexedDB is unavailable the flight is
// simply not recorded (the game-state summary — earnings, distance, etc. —
// is unaffected either way).
import type { FlightLog } from './types'

const DB_NAME = 'outback-flying-logs'
const DB_VERSION = 1
const STORE = 'logs'

function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  const thisPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      const db = req.result
      // Same connection-drop recovery as idbStorage.ts: don't cache a handle
      // that a force-close or version-change has already invalidated.
      db.onclose = () => {
        if (dbPromise === thisPromise) dbPromise = null
      }
      db.onversionchange = () => {
        db.close()
        if (dbPromise === thisPromise) dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
  dbPromise = thisPromise
  thisPromise.catch(() => {
    if (dbPromise === thisPromise) dbPromise = null
  })
  return thisPromise
}

function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let tx: IDBTransaction
        try {
          tx = db.transaction(STORE, mode)
        } catch (err) {
          dbPromise = null
          reject(err)
          return
        }
        const req = run(tx.objectStore(STORE))
        if (mode === 'readonly') {
          req.onsuccess = () => resolve(req.result as T)
          req.onerror = () => reject(req.error)
        } else {
          // Trust the transaction commit, not the request's own onsuccess — a
          // request can fire onsuccess and the transaction still abort after.
          tx.oncomplete = () => resolve(req.result as T)
          tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
          tx.onerror = () => reject(tx.error)
        }
      })
  )
}

export async function saveFlightLog(log: FlightLog): Promise<void> {
  if (!hasIndexedDB()) return
  await request('readwrite', (s) => s.put(log))
}

export async function getFlightLog(id: string): Promise<FlightLog | null> {
  if (!hasIndexedDB()) return null
  const result = await request<FlightLog | undefined>('readonly', (s) => s.get(id))
  return result ?? null
}

export async function deleteFlightLog(id: string): Promise<void> {
  if (!hasIndexedDB()) return
  await request('readwrite', (s) => s.delete(id))
}

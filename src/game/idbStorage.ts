// Persistence backend for the zustand `persist` middleware.
//
// The whole game saves under a single key. localStorage — the historical
// backend — caps out around 5 MB per origin, writes synchronously on the main
// thread, and only stores strings; a long-running career (an ever-growing
// ledger, and eventually recorded flight tracks) outgrows it. IndexedDB has a
// far larger, disk-based quota and writes asynchronously, and it works in both
// the browser and the Electron renderer, so we don't fork persistence by
// platform.
//
// This adapter prefers IndexedDB and transparently falls back to localStorage
// when IndexedDB is unavailable (older environments, and the jsdom test
// environment, which ships no IndexedDB) or when a write fails mid-session.
// localStorage therefore only ever holds a value in two cases, and in both it
// is the newest copy and wins reads:
//   1. a pre-IndexedDB save from an older build (migrated on first read), or
//   2. a fallback write after an IndexedDB failure (a successful IndexedDB
//      write always clears the localStorage copy).
import type { StateStorage } from 'zustand/middleware'

const DB_NAME = 'outback-flying'
const DB_VERSION = 1
const STORE = 'kv'

function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function warn(what: string, err: unknown): void {
  // Loud enough to diagnose "my save disappeared" reports; harmless otherwise.
  console.warn(`[save] ${what} — falling back to localStorage`, err)
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  const thisPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      // If the browser force-closes the connection (profile cleanup, quota
      // pressure) or another tab upgrades the schema, drop the cached handle so
      // the next call reopens instead of failing on a dead connection forever.
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
  // Don't cache a rejected open forever — allow a later attempt to retry.
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
          // transaction() throws InvalidStateError on a closed connection —
          // drop the cached handle so the next call reopens.
          dbPromise = null
          reject(err)
          return
        }
        const req = run(tx.objectStore(STORE))
        if (mode === 'readonly') {
          req.onsuccess = () => resolve(req.result as T)
          req.onerror = () => reject(req.error)
        } else {
          // Writes must only trust the transaction commit: a request can fire
          // onsuccess and the transaction still abort afterwards (e.g. quota
          // at commit time). Resolving early would report a save that never
          // landed — and the localStorage fallback would never kick in.
          tx.oncomplete = () => resolve(req.result as T)
          tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
          tx.onerror = () => reject(tx.error)
        }
      })
  )
}

const idbGet = (key: string) => request<unknown>('readonly', (s) => s.get(key))
const idbSet = (key: string, value: string) => request('readwrite', (s) => s.put(value, key))
const idbDelete = (key: string) => request('readwrite', (s) => s.delete(key))

// localStorage helpers, guarded so a missing/throwing localStorage degrades to
// a no-op rather than crashing (e.g. Node without --localstorage-file).
function localGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}
function localSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    /* quota or unavailable — nothing we can do */
  }
}
function localRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const persistentStorage: StateStorage = {
  getItem: async (name) => {
    if (!hasIndexedDB()) return localGet(name)
    // A localStorage value is always the newest copy (see header): either a
    // pre-IndexedDB save or a fallback write after an IndexedDB failure. Adopt
    // it into IndexedDB and clear it only once that write succeeds.
    const local = localGet(name)
    if (local != null) {
      try {
        await idbSet(name, local)
        localRemove(name)
      } catch (err) {
        warn('could not migrate save into IndexedDB', err)
      }
      return local
    }
    try {
      const fromIdb = await idbGet(name)
      return typeof fromIdb === 'string' ? fromIdb : null
    } catch (err) {
      warn('IndexedDB read failed', err)
      return null
    }
  },
  setItem: async (name, value) => {
    if (!hasIndexedDB()) {
      localSet(name, value)
      return
    }
    try {
      await idbSet(name, value)
      // A previous failed write may have left a fallback copy; clear it so
      // localStorage never shadows IndexedDB with stale data.
      localRemove(name)
    } catch (err) {
      warn('IndexedDB write failed', err)
      localSet(name, value)
    }
  },
  removeItem: async (name) => {
    if (hasIndexedDB()) {
      try {
        await idbDelete(name)
      } catch (err) {
        warn('IndexedDB delete failed', err)
      }
    }
    localRemove(name)
  },
}

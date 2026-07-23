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
// environment, which ships no IndexedDB). On first run against a save that was
// written to localStorage by an older build, it migrates that value into
// IndexedDB once and clears the stale localStorage copy so there is a single
// source of truth.
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

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
  // Don't cache a rejected open forever — allow a later attempt to retry.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = run(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result as T)
        req.onerror = () => reject(req.error)
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
    try {
      const fromIdb = await idbGet(name)
      if (typeof fromIdb === 'string') return fromIdb
      // Nothing in IndexedDB yet — migrate a pre-IndexedDB localStorage save once.
      const legacy = localGet(name)
      if (legacy != null) {
        await idbSet(name, legacy)
        localRemove(name)
        return legacy
      }
      return null
    } catch {
      return localGet(name)
    }
  },
  setItem: async (name, value) => {
    if (!hasIndexedDB()) {
      localSet(name, value)
      return
    }
    try {
      await idbSet(name, value)
    } catch {
      localSet(name, value)
    }
  },
  removeItem: async (name) => {
    if (hasIndexedDB()) {
      try {
        await idbDelete(name)
      } catch {
        /* ignore */
      }
    }
    localRemove(name)
  },
}

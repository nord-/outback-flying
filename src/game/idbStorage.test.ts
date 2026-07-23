// `fake-indexeddb/auto` installs a working IndexedDB on the global object so
// the adapter exercises its IndexedDB path (jsdom ships none). Must be imported
// before the module under test uses `indexedDB`.
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { persistentStorage } from './idbStorage'

// Unique key per test keeps them independent despite the module-level DB handle.
let seq = 0
const freshKey = () => `test-key-${seq++}`

beforeEach(() => localStorage.clear())

describe('persistentStorage (IndexedDB backend)', () => {
  it('round-trips a value through IndexedDB', async () => {
    const key = freshKey()
    await persistentStorage.setItem(key, '{"hello":"world"}')
    expect(await persistentStorage.getItem(key)).toBe('{"hello":"world"}')
  })

  it('returns null for an unknown key', async () => {
    expect(await persistentStorage.getItem(freshKey())).toBeNull()
  })

  it('removes a value', async () => {
    const key = freshKey()
    await persistentStorage.setItem(key, 'x')
    await persistentStorage.removeItem(key)
    expect(await persistentStorage.getItem(key)).toBeNull()
  })

  it('migrates a legacy localStorage save into IndexedDB once, then clears it', async () => {
    const key = freshKey()
    localStorage.setItem(key, '{"game":"legacy"}')

    // First read finds nothing in IndexedDB and adopts the localStorage value.
    expect(await persistentStorage.getItem(key)).toBe('{"game":"legacy"}')
    // The stale localStorage copy is cleared so there is a single source of truth.
    expect(localStorage.getItem(key)).toBeNull()

    // The value now lives in IndexedDB and survives without localStorage.
    expect(await persistentStorage.getItem(key)).toBe('{"game":"legacy"}')
  })

  it('prefers the IndexedDB value over a stale localStorage copy', async () => {
    const key = freshKey()
    await persistentStorage.setItem(key, 'idb-value')
    localStorage.setItem(key, 'stale-local-value')
    expect(await persistentStorage.getItem(key)).toBe('idb-value')
  })
})

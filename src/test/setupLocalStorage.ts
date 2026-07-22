// Node 22+ ships an experimental global `localStorage` that requires
// `--localstorage-file` to actually work; without that flag it exists as a
// property (so `typeof localStorage !== 'undefined'`) but throws on use.
// Vitest's jsdom environment merges jsdom's `window` onto the Node global —
// in this vitest version `window` and `globalThis` are the same object — so
// `window.localStorage` is already Node's broken stub, not jsdom's real
// Storage; re-exposing it doesn't help. `store.ts`'s zustand `persist`
// middleware resolves `localStorage` at import time, so it silently gets the
// broken stub during tests. Building a throwaway JSDOM instance here and
// installing its real Storage fixes that. jsdom ships no bundled TypeScript
// types (adding @types/jsdom is unnecessary just for this one constructor call).
// @ts-expect-error — no type declarations for 'jsdom'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('', { url: 'http://localhost/' })

Object.defineProperty(globalThis, 'localStorage', {
  value: dom.window.localStorage,
  configurable: true,
})
Object.defineProperty(globalThis, 'sessionStorage', {
  value: dom.window.sessionStorage,
  configurable: true,
})

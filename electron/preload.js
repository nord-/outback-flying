// Preload runs in an isolated context with access to Node APIs.
// The game persists to localStorage in the renderer, so we only expose
// lightweight metadata here. Extend this bridge if native features
// (file-based save export, SimConnect, etc.) are added later.
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('outback', {
  platform: process.platform,
  isElectron: true,
})

// Preload runs in an isolated context with access to Node APIs. The game
// persists in the renderer, so we expose only lightweight metadata plus the
// SimConnect bridge (issue #9): the renderer drives the sim through
// `window.outback.sim` and never touches node-simconnect or ipcRenderer directly.
import { contextBridge, ipcRenderer } from 'electron'

// Wrap an ipcRenderer channel as a subscribe(cb) that returns an unsubscribe fn.
// The raw IpcRendererEvent is dropped so the renderer only sees the payload.
function subscribe(channel, cb) {
  const listener = (_event, payload) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('outback', {
  platform: process.platform,
  isElectron: true,
  sim: {
    connect: (options) => ipcRenderer.invoke('sim:connect', options),
    disconnect: () => ipcRenderer.invoke('sim:disconnect'),
    getStatus: () => ipcRenderer.invoke('sim:status'),
    onSample: (cb) => subscribe('sim:sample', cb),
    onStatus: (cb) => subscribe('sim:status', cb),
  },
})

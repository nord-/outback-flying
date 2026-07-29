import { app, BrowserWindow, Menu, ipcMain, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createSimBridge } from './simconnect.js'
import { MIN_SIZE, initialWindowState, trackWindow, windowStateFile } from './windowState.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.ELECTRON_DEV === '1'

let mainWindow = null

// Push a message to the renderer if the window is still alive.
function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

// One SimConnect bridge for the app's lifetime; it streams to whichever window
// is current. Samples and status changes are forwarded to the renderer.
const simBridge = createSimBridge({
  onSample: (sample) => sendToRenderer('sim:sample', sample),
  onStatus: (event) => sendToRenderer('sim:status', event),
})

ipcMain.handle('sim:connect', (_event, options) => simBridge.connect(options))
ipcMain.handle('sim:disconnect', () => simBridge.disconnect())
ipcMain.handle('sim:status', () => simBridge.getStatus())
ipcMain.handle('sim:setFuel', (_event, litres) => simBridge.setFuel(litres))

function createWindow() {
  // Reopen where the player left off; windowState.js falls back to the default
  // size and lets Electron centre the window whenever the saved geometry is
  // missing or no longer fits the connected displays.
  const stateFile = windowStateFile(app.getPath('userData'))
  const { bounds, isMaximized } = initialWindowState(
    stateFile,
    screen.getAllDisplays().map((d) => d.workArea)
  )
  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    backgroundColor: '#0e1420',
    title: 'Outback Flying',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (isMaximized) win.maximize()
  trackWindow(win, stateFile)
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  // Minimal application menu; the game UI provides its own controls.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Outback Flying',
        submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'quit' }],
      },
    ])
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => simBridge.disconnect())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { version } from './package.json'

// base './' so the built app loads correctly from file:// inside Electron.
export default defineConfig({
  plugins: [react()],
  base: './',
  // The renderer shows the app version in the header. Inlining it at build time
  // keeps one source of truth (package.json, which the release workflow bumps)
  // and works in the web build too — app.getVersion() would be Electron-only.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

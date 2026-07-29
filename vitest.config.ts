import { defineConfig } from 'vitest/config'
import { version } from './package.json'

export default defineConfig({
  // Mirrors vite.config.ts so anything pulling in the UI resolves __APP_VERSION__.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setupLocalStorage.ts'],
  },
})


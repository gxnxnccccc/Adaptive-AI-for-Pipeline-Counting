/// <reference types="vitest/config" />
import path from 'node:path'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Build stamp shown on the login page, so an old SPDS window / cached page is obvious at a glance.
const sha = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'nogit'
  }
})()
const BUILD = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${sha}`

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})

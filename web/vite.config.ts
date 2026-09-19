/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { matchPlugin } from './vite.match-plugin.ts'
import { parsePlugin } from './vite.parse-plugin.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      parsePlugin(env.OPENROUTER_API_KEY ?? ''),
      matchPlugin(env.OPENROUTER_API_KEY ?? ''),
    ],
    optimizeDeps: {
      exclude: ['better-sqlite3'],
    },
    ssr: {
      external: ['better-sqlite3'],
    },
    test: {
      include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    },
  }
})

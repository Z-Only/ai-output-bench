import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  base: './',
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
})

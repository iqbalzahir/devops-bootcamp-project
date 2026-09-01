import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5173 },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
})

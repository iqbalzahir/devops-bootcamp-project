import { defineConfig } from 'vite'

// GitHub Pages serves the site under /<repo>/; dev + preview + e2e stay at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/devops-bootcamp-app/' : '/',
  server: { host: '0.0.0.0', port: 5173 },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
}))

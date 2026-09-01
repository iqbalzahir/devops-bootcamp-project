import { test, expect } from '@playwright/test'

// Playwright 1.61 only wires `reducedMotion` through `contextOptions`
// (see node_modules/playwright/types/test.d.ts) — a bare top-level
// `test.use({ reducedMotion: 'reduce' })` is silently ignored in this version.
test.use({ contextOptions: { reducedMotion: 'reduce' } })
test('reduced motion renders the static blueprint', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'fallback')
  await expect(page.locator('.fallback')).toContainText('nginx:alpine')
})

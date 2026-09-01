import { test, expect } from '@playwright/test'

test('page boots in webgl mode with no console errors', async ({ page }) => {
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await expect(page.locator('#stage')).toBeVisible()
  await page.waitForFunction(() => document.body.dataset.mode === 'webgl')
  await page.waitForTimeout(500)

  expect(errors, errors.join('\n')).toEqual([])
})

test('scrolling to the bottom scrubs without errors and reveals the Docker logo', async ({ page }) => {
  test.setTimeout(60000)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'webgl')
  // whale's own containers start hidden (scale ~0), revealed by the finale
  const startScale = await page.evaluate(() => window.__scene.whale.containers.scale.x)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  // ~5fps headless WebGL + anime sync smoothing converges per-frame; wait for the
  // actual reveal rather than a fixed sleep (robust to variable frame rate).
  await page.waitForFunction(() => window.__scene.whale.containers.scale.x > 0.9, { timeout: 50000 })
  const endScale = await page.evaluate(() => window.__scene.whale.containers.scale.x)
  expect(startScale).toBeLessThan(0.1)
  expect(endScale).toBeGreaterThan(0.5)
  expect(errors, errors.join('\n')).toEqual([])
})

test('scrubbing through all beats produces no errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'webgl')
  const steps = 12
  for (let i = 0; i <= steps; i++) {
    await page.evaluate((f) => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo(0, max * f)
    }, i / steps)
    await page.waitForTimeout(120)
  }
  expect(errors, errors.join('\n')).toEqual([])
})

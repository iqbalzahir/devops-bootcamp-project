import { test, expect } from '@playwright/test'

test('the sound invite enables audio and reveals the mute toggle', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'webgl')

  const invite = page.locator('#sound-invite')
  await expect(invite).toBeVisible()
  await expect(page.locator('#sound-toggle')).toBeHidden()

  await invite.click() // trusted gesture → AudioContext.resume()
  await page.waitForFunction(() => window.__audio && window.__audio.enabled === true, { timeout: 5000 })
  await expect(page.locator('#sound-toggle')).toBeVisible()
  await expect(invite).toBeHidden()

  // Exercise the ENABLED, UNMUTED sfx path (tick/cut/riser) + bed.setIntensity by
  // sweeping progress forward across every cue via the public update() API. This
  // runs the real Web Audio voice builders — and confirms the background music
  // started without error — deterministically, without depending on the slow
  // headless scroll→reveal convergence (which the bg audio load slows further).
  await page.evaluate(() => { for (const p of [0.1, 0.5, 0.95]) window.__audio.update(p) })

  const muted = await page.evaluate(() => window.__audio.toggleMute())
  expect(muted).toBe(true)

  expect(errors, errors.join('\n')).toEqual([])
})

test('the reduced-motion fallback shows no audio UI', async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'fallback')
  await expect(page.locator('#sound-invite')).toBeHidden()
  await expect(page.locator('#sound-toggle')).toBeHidden()
  await page.close()
})

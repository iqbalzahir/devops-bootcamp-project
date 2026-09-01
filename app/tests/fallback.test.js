import { describe, it, expect, beforeEach } from 'vitest'
import { shouldUseFallback, renderFallback } from '../src/fallback.js'

describe('shouldUseFallback', () => {
  it('true when no gl context', () => {
    expect(shouldUseFallback({ gl: null, reducedMotion: false })).toBe(true)
  })
  it('true when reduced motion', () => {
    expect(shouldUseFallback({ gl: {}, reducedMotion: true })).toBe(true)
  })
  it('false when gl present and motion allowed', () => {
    expect(shouldUseFallback({ gl: {}, reducedMotion: false })).toBe(false)
  })
})

describe('renderFallback', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="root"></div>' })
  it('renders every layer instruction into the DOM', () => {
    renderFallback(document.getElementById('root'))
    const text = document.getElementById('root').textContent
    expect(text).toContain('FROM')
    expect(text).toContain('nginx:alpine')
    expect(text).toContain('CMD')
  })
})

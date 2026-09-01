import { describe, it, expect } from 'vitest'
import { mdi } from '../src/icons.js'

describe('mdi()', () => {
  it('returns an svg string with a path for a known icon', () => {
    const out = mdi('mdiConsole')
    expect(out).toContain('<svg')
    expect(out).toContain('<path')
  })
  it('throws for an unknown icon', () => {
    expect(() => mdi('mdiNotARealIcon')).toThrow(/Unknown MDI/)
  })
  it('resolves the volume icons used by the audio controls', () => {
    for (const name of ['mdiVolumeHigh', 'mdiVolumeOff']) {
      const out = mdi(name)
      expect(out).toContain('<svg')
      expect(out).toContain('<path')
    }
  })
})

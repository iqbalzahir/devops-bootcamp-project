import { describe, it, expect } from 'vitest'
import { createAudioContext } from '../src/audio/context.js'
import { createBed } from '../src/audio/bed.js'
import { createSfx } from '../src/audio/sfx.js'
import { createMusic } from '../src/audio/music.js'
import { createAudio } from '../src/audio/index.js'

describe('audio modules (import smoke)', () => {
  it('context exports a factory', () => {
    expect(typeof createAudioContext).toBe('function')
  })

  it('bed exports a factory', () => {
    expect(typeof createBed).toBe('function')
  })

  it('sfx exports a factory', () => {
    expect(typeof createSfx).toBe('function')
  })

  it('music exports a factory', () => {
    expect(typeof createMusic).toBe('function')
  })

  it('createAudio update() is a safe no-op before enable()', () => {
    const audio = createAudio()
    expect(audio.enabled).toBe(false)
    expect(() => { audio.update(0.2); audio.update(0.9) }).not.toThrow()
    expect(audio.enabled).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { BUILD_DROPS, RUNTIME_DROPS, LAYER_DROPS, CUT_AT, REVEAL_AT, AUDIO_CUES } from '../src/beats.js'

describe('beats', () => {
  it('has 6 build + 4 runtime drops matching the original timeline formula', () => {
    expect(BUILD_DROPS).toHaveLength(6)
    expect(RUNTIME_DROPS).toHaveLength(4)
    BUILD_DROPS.forEach((v, i) => expect(v).toBeCloseTo(0.08 + (i / 6) * 0.34, 10))
    RUNTIME_DROPS.forEach((v, i) => expect(v).toBeCloseTo(0.54 + (i / 4) * 0.16, 10))
  })

  it('LAYER_DROPS is the 10 drops in Dockerfile order, ascending', () => {
    expect(LAYER_DROPS).toEqual([...BUILD_DROPS, ...RUNTIME_DROPS])
    for (let i = 1; i < LAYER_DROPS.length; i++) {
      expect(LAYER_DROPS[i]).toBeGreaterThan(LAYER_DROPS[i - 1])
    }
  })

  it('exposes cut and reveal marks', () => {
    expect(CUT_AT).toBe(0.46)
    expect(REVEAL_AT).toBe(0.90)
  })

  it('AUDIO_CUES = 10 ticks + cut + riser, each with id/at/kind', () => {
    expect(AUDIO_CUES).toHaveLength(12)
    expect(AUDIO_CUES.filter(c => c.kind === 'tick')).toHaveLength(10)
    expect(AUDIO_CUES.find(c => c.kind === 'cut')).toMatchObject({ id: 'cut', at: 0.46 })
    expect(AUDIO_CUES.find(c => c.kind === 'riser')).toMatchObject({ id: 'reveal', at: 0.90 })
    for (const c of AUDIO_CUES) {
      expect(typeof c.id).toBe('string')
      expect(typeof c.at).toBe('number')
      expect(['tick', 'cut', 'riser']).toContain(c.kind)
    }
  })
})

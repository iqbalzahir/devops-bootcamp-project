import { describe, it, expect } from 'vitest'
import { crossedForward, bedCurve } from '../src/audio/triggers.js'
import { AUDIO_CUES } from '../src/beats.js'

const CUES = [
  { id: 'a', at: 0.10, kind: 'tick' },
  { id: 'b', at: 0.20, kind: 'tick' },
  { id: 'cut', at: 0.46, kind: 'cut' },
  { id: 'reveal', at: 0.90, kind: 'riser' },
]

describe('crossedForward', () => {
  it('fires a cue when scrolling forward past it', () => {
    expect(crossedForward(0.05, 0.12, CUES)).toEqual([{ id: 'a', kind: 'tick' }])
  })

  it('is silent when scrolling backward', () => {
    expect(crossedForward(0.30, 0.05, CUES)).toEqual([])
  })

  it('is silent when idle (no movement)', () => {
    expect(crossedForward(0.30, 0.30, CUES)).toEqual([])
  })

  it('collapses multiple tick crossings in one frame to a single tick', () => {
    const out = crossedForward(0.05, 0.50, CUES)
    expect(out.filter(o => o.kind === 'tick')).toHaveLength(1)
    // the non-tick cut in the same span still fires
    expect(out.find(o => o.kind === 'cut')).toEqual({ id: 'cut', kind: 'cut' })
  })

  it('collapses all 10 real layer ticks to one on a full-scrub frame', () => {
    const out = crossedForward(0.0, 1.0, AUDIO_CUES)
    expect(out.filter(o => o.kind === 'tick')).toHaveLength(1)
    expect(out.some(o => o.kind === 'cut')).toBe(true)
    expect(out.some(o => o.kind === 'riser')).toBe(true)
  })

  it('re-arms a cue after scrolling back below it', () => {
    expect(crossedForward(0.40, 0.50, CUES).some(o => o.id === 'cut')).toBe(true) // fires
    expect(crossedForward(0.50, 0.40, CUES)).toEqual([])                          // back, silent
    expect(crossedForward(0.40, 0.50, CUES).some(o => o.id === 'cut')).toBe(true) // fires again
  })

  it('fires the riser exactly at/after the reveal boundary', () => {
    expect(crossedForward(0.89, 0.91, CUES)).toEqual([{ id: 'reveal', kind: 'riser' }])
  })
})

describe('bedCurve', () => {
  it('starts low, ends at 1, and is clamped', () => {
    expect(bedCurve(0)).toBeCloseTo(0.3, 5)
    expect(bedCurve(1)).toBe(1)
    expect(bedCurve(-5)).toBe(0.3)
    expect(bedCurve(5)).toBe(1)
  })

  it('swells sharply into the finale', () => {
    expect(bedCurve(0.95) - bedCurve(0.85)).toBeGreaterThan(0.3)
  })

  it('is non-decreasing across the scroll', () => {
    let prev = -1
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = bedCurve(p)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

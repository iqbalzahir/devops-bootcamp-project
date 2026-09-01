// Single source of truth for scroll/timeline beat positions (0..1 of the master
// timeline). Consumed by timeline.js (to place tweens) AND the audio module (to
// fire scroll-synced SFX), so the two can never drift apart.

// build stage: 6 layer drops staggered across 8%..~41%; runtime: 4 across 54%..66%
export const BUILD_DROPS = [0, 1, 2, 3, 4, 5].map((i) => 0.08 + (i / 6) * 0.34)
export const RUNTIME_DROPS = [0, 1, 2, 3].map((i) => 0.54 + (i / 4) * 0.16)
export const LAYER_DROPS = [...BUILD_DROPS, ...RUNTIME_DROPS] // 10, Dockerfile order

export const CUT_AT = 0.46    // multi-stage cut (second FROM / build stack discarded)
export const REVEAL_AT = 0.90 // finale: the real Docker logo is revealed

// Cue list for the audio trigger logic; `kind` selects which one-shot plays.
export const AUDIO_CUES = [
  ...LAYER_DROPS.map((at, i) => ({ id: `layer-${i}`, at, kind: 'tick' })),
  { id: 'cut', at: CUT_AT, kind: 'cut' },
  { id: 'reveal', at: REVEAL_AT, kind: 'riser' },
]

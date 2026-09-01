# Scroll-Synced Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add asset-free, procedurally-synthesized audio (an underwater drone bed + three HUD one-shots) that plays in sync with the scroll-driven Docker animation.

**Architecture:** A DOM-free `src/audio/` module owns all Web Audio. A new shared `src/beats.js` holds the beat timings consumed by both the visual timeline and the audio triggers, so they never drift. `main.js` constructs the audio in its WebGL branch, wires a hero "enable sound" invite + a corner mute toggle, and calls `audio.update(master.progress)` each frame using the smoothed anime.js timeline playhead.

**Tech Stack:** Vanilla ES modules, Web Audio API, anime.js v4 (`.progress`), Vite, Vitest (jsdom), Playwright.

## Global Constraints

- Web Audio API only — **no audio files, no new dependencies** (procedural synthesis, matching the project's zero-asset ethos).
- Audio exists **only in `main.js`'s WebGL branch**; the reduced-motion / no-WebGL fallback stays silent (its audio UI is never shown).
- New MDI icons are added via **static named import + the `ICONS` map** in `src/icons.js` (preserves tree-shaking) — never `import * as`.
- One-shot SFX fire on **forward scroll crossings only** (scrolling up is silent); the bed updates continuously in both directions.
- Sync source is the **anime.js timeline `.progress`** (0..1, sync-smoothed), not raw `scrollY`, so SFX land with the visuals.
- Existing unit tests (`npm test`) and e2e (`npm run test:e2e`) must stay green.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**Create**
- `src/beats.js` — shared beat timings (layer drops, cut, reveal) + `AUDIO_CUES`.
- `src/audio/triggers.js` — pure `crossedForward()` + `bedCurve()` (unit-testable core).
- `src/audio/context.js` — `AudioContext` + master gain + synthesized reverb.
- `src/audio/bed.js` — ambient drone (`createBed`).
- `src/audio/sfx.js` — one-shots (`createSfx`: `tick`/`cut`/`riser`).
- `src/audio/index.js` — `createAudio()` orchestrator (`enable`/`toggleMute`/`update`).
- `tests/audio-triggers.test.js` — pure-logic unit tests.
- `tests/audio-modules.test.js` — import-smoke tests for the synth modules.
- `e2e/audio.spec.js` — enable-flow + fallback-silence e2e.

**Modify**
- `src/timeline.js` — import drop positions from `src/beats.js`.
- `src/icons.js` — add `mdiVolumeHigh`, `mdiVolumeOff`.
- `index.html` — invite + toggle buttons.
- `src/main.js` — construct audio, wire UI, call `update()` per frame.
- `src/style.css` — invite + toggle styling.
- `CLAUDE.md` — document the audio module + `beats.js`.

---

### Task 1: Shared beat timings (`src/beats.js`) + timeline refactor

**Files:**
- Create: `src/beats.js`
- Modify: `src/timeline.js` (build/runtime drop math → shared constants)
- Test: `tests/beats.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BUILD_DROPS: number[]` (6), `RUNTIME_DROPS: number[]` (4), `LAYER_DROPS: number[]` (10) — timeline positions in 0..1.
  - `CUT_AT = 0.46`, `REVEAL_AT = 0.90`.
  - `AUDIO_CUES: Array<{ id: string, at: number, kind: 'tick'|'cut'|'riser' }>` (12 entries, ascending-ish by `at`).

- [ ] **Step 1: Write the failing test**

Create `tests/beats.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/beats.test.js`
Expected: FAIL — `Failed to resolve import "../src/beats.js"`.

- [ ] **Step 3: Create `src/beats.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/beats.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `src/timeline.js` to consume the shared drops**

Add to the imports at the top (after the existing `LAYER_SPACING` import):

```js
import { BUILD_DROPS, RUNTIME_DROPS } from './beats.js'
```

In the Act I build loop, replace the `at` line:

```js
// before:
//   const at = (0.08 + (i / build.length) * 0.34) * D
const at = BUILD_DROPS[i] * D
```

In the Runtime stage loop, replace the `at` line:

```js
// before:
//   const at = (0.54 + (i / runtime.length) * 0.16) * D
const at = RUNTIME_DROPS[i] * D
```

(Values are identical — this only removes the duplicated formula.)

- [ ] **Step 6: Verify nothing broke — unit suite + build**

Run: `npm test`
Expected: PASS (existing 10 + new 4 = 14).

Run: `npm run build`
Expected: `✓ built` with no import/resolve errors.

- [ ] **Step 7: Commit**

```bash
git add src/beats.js src/timeline.js tests/beats.test.js
git commit -m "feat: add src/beats.js as shared beat timings; timeline consumes it" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pure trigger logic (`src/audio/triggers.js`)

**Files:**
- Create: `src/audio/triggers.js`
- Test: `tests/audio-triggers.test.js`

**Interfaces:**
- Consumes: `AUDIO_CUES` from `../beats.js` (in tests only).
- Produces:
  - `crossedForward(prev: number, curr: number, cues: Cue[]) -> Array<{id, kind}>` — forward-only; collapses multiple `tick` hits to one; returns cues in input order.
  - `bedCurve(progress: number) -> number` — shaped intensity 0..1.

- [ ] **Step 1: Write the failing test**

Create `tests/audio-triggers.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio-triggers.test.js`
Expected: FAIL — `Failed to resolve import "../src/audio/triggers.js"`.

- [ ] **Step 3: Create `src/audio/triggers.js`**

```js
// Pure scroll-sync trigger logic — no Web Audio, fully unit-testable.

// Which one-shot cues fire this frame. Forward-only: scrolling up or standing
// still is silent. Multiple 'tick' cues crossed in one frame (fast scrub)
// collapse to a single tick so it never machine-guns. The prev < at <= curr test
// re-arms a cue automatically once the user scrolls back below it.
//
// cues: [{ id, at, kind }]   kind ∈ 'tick' | 'cut' | 'riser'
export function crossedForward(prev, curr, cues) {
  if (curr <= prev) return []
  const out = []
  let tickTaken = false
  for (const c of cues) {
    if (!(prev < c.at && c.at <= curr)) continue
    if (c.kind === 'tick') {
      if (tickTaken) continue
      tickTaken = true
    }
    out.push({ id: c.id, kind: c.kind })
  }
  return out
}

// Shaped ambient-bed intensity (0..1) for a scroll progress (0..1): a gentle
// rise through the build with an extra swell into the finale.
export function bedCurve(progress) {
  const p = clamp01(progress)
  return clamp01(0.3 + 0.35 * p + 0.35 * smoothstep(0.85, 0.95, p))
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x }
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/audio-triggers.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/audio/triggers.js tests/audio-triggers.test.js
git commit -m "feat: pure scroll-sync audio trigger logic (crossedForward, bedCurve)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Volume icons (`src/icons.js`)

**Files:**
- Modify: `src/icons.js`
- Test: `tests/icons.test.js` (add cases)

**Interfaces:**
- Produces: `mdi('mdiVolumeHigh')` and `mdi('mdiVolumeOff')` resolve to `<svg>` strings; `mdiPath('mdiVolumeHigh'|'mdiVolumeOff')` return path data.

- [ ] **Step 1: Write the failing test**

Add to `tests/icons.test.js` inside the existing `describe('mdi()', ...)` block:

```js
  it('resolves the volume icons used by the audio controls', () => {
    for (const name of ['mdiVolumeHigh', 'mdiVolumeOff']) {
      const out = mdi(name)
      expect(out).toContain('<svg')
      expect(out).toContain('<path')
    }
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/icons.test.js`
Expected: FAIL — `throw new Error('Unknown MDI icon: mdiVolumeHigh')`.

- [ ] **Step 3: Add the two icons to `src/icons.js`**

Add both names to the `import { ... } from '@mdi/js'` list (keep alphabetical-ish):

```js
  mdiTransferRight,
  mdiVolumeHigh,
  mdiVolumeOff,
} from '@mdi/js'
```

And add both to the `ICONS` map:

```js
  mdiTransferRight,
  mdiVolumeHigh,
  mdiVolumeOff,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/icons.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/icons.js tests/icons.test.js
git commit -m "feat: add mdiVolumeHigh/mdiVolumeOff icons for audio controls" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Audio context + reverb (`src/audio/context.js`)

**Files:**
- Create: `src/audio/context.js`
- Test: `tests/audio-modules.test.js`

**Interfaces:**
- Produces: `createAudioContext() -> { ctx: AudioContext, master: GainNode, reverb: ConvolverNode, resume(): Promise }`. `master.gain` starts at 0. `reverb` is a wet-send input node routed to `master`.

- [ ] **Step 1: Write the failing test**

Create `tests/audio-modules.test.js` (import-smoke — jsdom has no `AudioContext`, so we only assert the module parses and exports a factory function; real behavior is covered by the e2e in Task 8):

```js
import { describe, it, expect } from 'vitest'
import { createAudioContext } from '../src/audio/context.js'

describe('audio modules (import smoke)', () => {
  it('context exports a factory', () => {
    expect(typeof createAudioContext).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio-modules.test.js`
Expected: FAIL — `Failed to resolve import "../src/audio/context.js"`.

- [ ] **Step 3: Create `src/audio/context.js`**

```js
// The single Web Audio context: a master gain (the mute gate → destination) and
// a runtime-synthesized reverb (no impulse file). Voices connect to `master`
// (dry) and/or `reverb` (wet). Context starts suspended; resume() must run inside
// a user gesture to satisfy the browser autoplay policy.
export function createAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()

  const master = ctx.createGain()
  master.gain.value = 0 // silent until enable() ramps it up
  master.connect(ctx.destination)

  // Reverb: a short exponentially-decaying stereo noise impulse, rendered once.
  const reverb = ctx.createConvolver()
  reverb.buffer = makeImpulse(ctx, 1.8, 2.6)
  const wet = ctx.createGain()
  wet.gain.value = 0.5
  reverb.connect(wet).connect(master)

  return { ctx, master, reverb, resume: () => ctx.resume() }
}

function makeImpulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate
  const len = Math.floor(seconds * rate)
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}
```

- [ ] **Step 4: Run test + build**

Run: `npx vitest run tests/audio-modules.test.js`
Expected: PASS (1 test).

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/audio/context.js tests/audio-modules.test.js
git commit -m "feat: Web Audio context with synthesized reverb (no assets)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Ambient drone bed (`src/audio/bed.js`)

**Files:**
- Create: `src/audio/bed.js`
- Test: `tests/audio-modules.test.js` (add a case)

**Interfaces:**
- Consumes: `{ ctx, master, reverb }` from `createAudioContext()`.
- Produces: `createBed({ ctx, master, reverb }) -> { start(), setIntensity(x: number), stop() }`. `start()` creates + starts the oscillators/LFO; `setIntensity(0..1)` ramps gain + cutoff.

- [ ] **Step 1: Write the failing test**

Add to `tests/audio-modules.test.js`:

```js
import { createBed } from '../src/audio/bed.js'
// ...inside the describe:
  it('bed exports a factory', () => {
    expect(typeof createBed).toBe('function')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio-modules.test.js`
Expected: FAIL — `Failed to resolve import "../src/audio/bed.js"`.

- [ ] **Step 3: Create `src/audio/bed.js`**

```js
// Ambient underwater drone: a few detuned low sine oscillators through a lowpass
// with a slow LFO on the cutoff, sent dry + into the shared reverb. Scroll drives
// gain + brightness via setIntensity().
export function createBed({ ctx, master, reverb }) {
  const out = ctx.createGain()
  out.gain.value = 0.0001
  out.connect(master)
  out.connect(reverb)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 260
  filter.Q.value = 6
  filter.connect(out)

  const freqs = [55, 55.4, 82.5] // A1 + slight detune + a fifth-ish partial
  const oscs = []
  let lfo = null

  function start() {
    for (const f of freqs) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.5
      o.connect(g).connect(filter)
      o.start()
      oscs.push(o)
    }
    lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 120
    lfo.connect(lfoGain).connect(filter.frequency) // modulates cutoff around its set value
    lfo.start()
  }

  // x in 0..1 → smoothly-ramped gain + lowpass cutoff.
  function setIntensity(x) {
    const t = ctx.currentTime
    out.gain.setTargetAtTime(0.02 + 0.16 * x, t, 0.3)
    filter.frequency.setTargetAtTime(220 + 900 * x, t, 0.3)
  }

  function stop() {
    for (const o of oscs) o.stop()
    if (lfo) lfo.stop()
  }

  return { start, setIntensity, stop }
}
```

- [ ] **Step 4: Run test + build**

Run: `npx vitest run tests/audio-modules.test.js`
Expected: PASS (2 tests).

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/audio/bed.js tests/audio-modules.test.js
git commit -m "feat: ambient underwater drone bed with scroll-driven intensity" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: One-shot SFX (`src/audio/sfx.js`)

**Files:**
- Create: `src/audio/sfx.js`
- Test: `tests/audio-modules.test.js` (add a case)

**Interfaces:**
- Consumes: `{ ctx, master, reverb }` from `createAudioContext()`.
- Produces: `createSfx({ ctx, master, reverb }) -> { tick(), cut(), riser() }`. Each schedules a short, self-stopping voice at `ctx.currentTime`.

- [ ] **Step 1: Write the failing test**

Add to `tests/audio-modules.test.js`:

```js
import { createSfx } from '../src/audio/sfx.js'
// ...inside the describe:
  it('sfx exports a factory', () => {
    expect(typeof createSfx).toBe('function')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio-modules.test.js`
Expected: FAIL — `Failed to resolve import "../src/audio/sfx.js"`.

- [ ] **Step 3: Create `src/audio/sfx.js`**

```js
// Three synthesized one-shots. Each builds a short, self-contained voice at the
// current time, connects dry (master) + wet (reverb), and auto-stops after its
// tail. exponentialRamp targets stay > 0 (Web Audio requirement).
export function createSfx({ ctx, master, reverb }) {
  // pitched oscillator with an attack/decay envelope
  function voice({ type = 'sine', from, to, dur, peak, sweepDur, wet = 0.25 }) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    if (to != null) o.frequency.exponentialRampToValueAtTime(to, t + (sweepDur || dur))
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master)
    const w = ctx.createGain(); w.gain.value = wet
    g.connect(w); w.connect(reverb)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  // short filtered noise burst (for the cut swoosh)
  function noiseBurst({ dur, peak, cutoff, wet = 0.3 }) {
    const t = ctx.currentTime
    const len = Math.floor(dur * ctx.sampleRate)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource(); src.buffer = buf
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = cutoff; f.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g); g.connect(master)
    const w = ctx.createGain(); w.gain.value = wet
    g.connect(w); w.connect(reverb)
    src.start(t); src.stop(t + dur)
  }

  // crisp rising HUD blip on a layer drop
  function tick() {
    voice({ type: 'triangle', from: 660, to: 1320, dur: 0.14, peak: 0.14, sweepDur: 0.09, wet: 0.2 })
  }

  // multi-stage cut: filtered swoosh + descending low thunk
  function cut() {
    noiseBurst({ dur: 0.35, peak: 0.12, cutoff: 900, wet: 0.4 })
    voice({ type: 'sine', from: 180, to: 70, dur: 0.4, peak: 0.18, sweepDur: 0.35, wet: 0.3 })
  }

  // finale reveal: upward sweep + sub-boom + bright shimmer
  function riser() {
    voice({ type: 'sawtooth', from: 120, to: 900, dur: 1.2, peak: 0.16, sweepDur: 1.0, wet: 0.5 })
    voice({ type: 'sine', from: 48, to: 40, dur: 1.4, peak: 0.28, sweepDur: 1.2, wet: 0.3 })
    voice({ type: 'sine', from: 1200, to: 2400, dur: 0.9, peak: 0.06, sweepDur: 0.7, wet: 0.6 })
  }

  return { tick, cut, riser }
}
```

- [ ] **Step 4: Run test + build**

Run: `npx vitest run tests/audio-modules.test.js`
Expected: PASS (3 tests).

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/audio/sfx.js tests/audio-modules.test.js
git commit -m "feat: synthesized one-shot SFX (tick, cut, riser)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Audio orchestrator (`src/audio/index.js`)

**Files:**
- Create: `src/audio/index.js`
- Test: `tests/audio-modules.test.js` (add a case exercising the disabled `update` path)

**Interfaces:**
- Consumes: `createAudioContext`, `createBed`, `createSfx`, `crossedForward`, `bedCurve`, `AUDIO_CUES`.
- Produces: `createAudio() -> { enabled: boolean (getter), muted: boolean (getter), enable(): Promise, toggleMute(): boolean, update(progress: number): void }`. `update()` tracks `prev` even while disabled (so enabling mid-scroll never replays past cues); it only touches Web Audio when enabled and unmuted.

- [ ] **Step 1: Write the failing test**

Add to `tests/audio-modules.test.js` (this one runs real logic — the disabled `update` path never constructs an `AudioContext`, so it works in jsdom):

```js
import { createAudio } from '../src/audio/index.js'
// ...inside the describe:
  it('createAudio update() is a safe no-op before enable()', () => {
    const audio = createAudio()
    expect(audio.enabled).toBe(false)
    expect(() => { audio.update(0.2); audio.update(0.9) }).not.toThrow()
    expect(audio.enabled).toBe(false)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio-modules.test.js`
Expected: FAIL — `Failed to resolve import "../src/audio/index.js"`.

- [ ] **Step 3: Create `src/audio/index.js`**

```js
import { createAudioContext } from './context.js'
import { createBed } from './bed.js'
import { createSfx } from './sfx.js'
import { crossedForward, bedCurve } from './triggers.js'
import { AUDIO_CUES } from '../beats.js'

// Owns the audio lifecycle and the per-frame scroll → sound mapping. DOM-free;
// main.js supplies the UI and calls update() each frame with the timeline
// playhead (master.progress, 0..1).
export function createAudio() {
  let bundle = null  // { ctx, master, reverb }
  let bed = null
  let sfx = null
  let enabled = false
  let muted = false
  let prev = 0

  async function enable() {
    if (enabled) return
    bundle = createAudioContext()
    bed = createBed(bundle)
    sfx = createSfx(bundle)
    await bundle.resume()
    bed.start()
    bundle.master.gain.setTargetAtTime(0.9, bundle.ctx.currentTime, 0.4)
    enabled = true
  }

  function toggleMute() {
    if (!enabled) return muted
    muted = !muted
    bundle.master.gain.setTargetAtTime(muted ? 0 : 0.9, bundle.ctx.currentTime, 0.2)
    return muted
  }

  function update(progress) {
    const p = Number.isFinite(progress) ? progress : 0
    if (enabled && !muted) {
      bed.setIntensity(bedCurve(p))
      for (const { kind } of crossedForward(prev, p, AUDIO_CUES)) {
        if (kind === 'tick') sfx.tick()
        else if (kind === 'cut') sfx.cut()
        else if (kind === 'riser') sfx.riser()
      }
    }
    prev = p // always advance, so enabling mid-scroll doesn't replay past cues
  }

  return {
    get enabled() { return enabled },
    get muted() { return muted },
    enable,
    toggleMute,
    update,
  }
}
```

- [ ] **Step 4: Run test + build**

Run: `npx vitest run tests/audio-modules.test.js`
Expected: PASS (4 tests).

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/audio/index.js tests/audio-modules.test.js
git commit -m "feat: audio orchestrator wiring context/bed/sfx to scroll triggers" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Wire into the page (`index.html`, `src/main.js`, `src/style.css`) + e2e

**Files:**
- Modify: `index.html` (invite + toggle buttons)
- Modify: `src/main.js` (construct audio, wire UI, per-frame `update`)
- Modify: `src/style.css` (button styling)
- Test: `e2e/audio.spec.js`

**Interfaces:**
- Consumes: `createAudio` (Task 7), `mdi` (already imported in `main.js`), `mdiVolumeHigh`/`mdiVolumeOff` (Task 3).
- Produces: `window.__audio` (the audio object) for e2e; DOM ids `#sound-invite`, `#sound-toggle`.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/audio.spec.js`:

```js
import { test, expect } from '@playwright/test'

test('the sound invite enables audio and reveals the mute toggle', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'webgl')

  const invite = page.locator('#sound-invite')
  await expect(invite).toBeVisible()

  await invite.click() // trusted gesture → AudioContext.resume()
  await page.waitForFunction(() => window.__audio && window.__audio.enabled === true, { timeout: 5000 })
  await expect(page.locator('#sound-toggle')).toBeVisible()
  await expect(invite).toBeHidden()

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
```

- [ ] **Step 2: Run e2e to verify it fails**

Run: `npx playwright test e2e/audio.spec.js`
Expected: FAIL — `#sound-invite` not found / not visible (buttons don't exist yet).

- [ ] **Step 3: Add the buttons to `index.html`**

Insert immediately before the closing `</div>` of `#app` (after the `#ceremony` block):

```html
      <button id="sound-invite" class="audio-btn" type="button"></button>
      <button id="sound-toggle" class="audio-btn audio-toggle" type="button" aria-label="Toggle sound"></button>
```

- [ ] **Step 4: Style the buttons in `src/style.css`**

Append at the end of the file:

```css
/* audio controls (WebGL mode only; revealed by main.js) */
.audio-btn {
  position: fixed; z-index: 7; display: none;
  border: 1px solid var(--cyan); background: rgba(5, 10, 18, 0.7); color: var(--cyan);
  font-family: var(--mono); cursor: pointer; backdrop-filter: blur(3px);
}
#sound-invite {
  bottom: 24px; left: 50%; transform: translateX(-50%);
  align-items: center; gap: 8px; padding: 10px 16px; border-radius: 22px; font-size: 14px;
}
#sound-toggle {
  top: 18px; right: 18px; width: 44px; height: 44px; border-radius: 50%; padding: 0;
  place-items: center;
}
@media (prefers-reduced-motion: reduce) { .audio-btn { display: none !important; } }
```

- [ ] **Step 5: Wire audio in `src/main.js`**

Add the import near the other imports:

```js
import { createAudio } from './audio/index.js'
```

Inside the WebGL `else` branch, after `const ceremonyEl = document.getElementById('ceremony')` and before `let last = 0`:

```js
  // --- audio: one-time hero invite → resumes context; then a corner mute toggle ---
  const audio = createAudio()
  const invite = document.getElementById('sound-invite')
  const toggle = document.getElementById('sound-toggle')
  invite.innerHTML = mdi('mdiVolumeHigh', 20, '#38f5c9') + '<span>Enable sound</span>'
  toggle.innerHTML = mdi('mdiVolumeHigh', 22, '#38f5c9')
  invite.style.display = 'flex'
  invite.addEventListener('click', async () => {
    await audio.enable()
    invite.style.display = 'none'
    toggle.style.display = 'grid'
  })
  toggle.addEventListener('click', () => {
    const muted = audio.toggleMute()
    toggle.innerHTML = mdi(muted ? 'mdiVolumeOff' : 'mdiVolumeHigh', 22, '#38f5c9')
  })
  window.__audio = audio
```

Inside `frame()`, add the audio update right after `particles.update(elapsed)`:

```js
    audio.update(master.progress)
```

(The fallback branch is untouched — the buttons default to `display: none` in CSS, so the fallback view never shows them.)

- [ ] **Step 6: Run e2e to verify it passes**

Run: `npx playwright test e2e/audio.spec.js`
Expected: PASS (2 tests).

- [ ] **Step 7: Verify the full suites are green**

Run: `npm test`
Expected: PASS (all unit tests).

Run: `npm run test:e2e`
Expected: PASS (existing smoke/fallback + the 2 new audio tests).

- [ ] **Step 8: Manual ear-check (not automated)**

Run: `npm run dev`, open the page, click **Enable sound**, and scroll slowly top→bottom. Confirm: a low drone that swells toward the finale, a tick as each container drops, a swoosh at the multi-stage cut (~46%), and a riser at the reveal (~90%). Toggle mutes/unmutes. Tune envelope/frequency constants in `bed.js`/`sfx.js` to taste (no interface changes).

- [ ] **Step 9: Commit**

```bash
git add index.html src/main.js src/style.css e2e/audio.spec.js
git commit -m "feat: wire scroll-synced audio with enable invite + mute toggle" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Document the audio module (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Add a "Scroll IS the clock" cross-reference and an audio subsection**

In `CLAUDE.md`, under the "### Overlays (`src/overlay/`)" area, add a new subsection after it:

```markdown
### Audio (`src/audio/`, `src/beats.js`)

Asset-free procedural sound (Web Audio API, no files), present **only in the
WebGL branch** — the reduced-motion/fallback view is silent. Starts on a one-time
hero "enable sound" invite (`ctx.resume()` needs a user gesture), then a corner
mute toggle.

- `src/beats.js` — **single source of truth for beat timings** (layer-drop
  positions, `CUT_AT`, `REVEAL_AT`, and the `AUDIO_CUES` list). `timeline.js`
  *and* the audio triggers both import it, so sound and visuals never drift.
- `src/audio/triggers.js` — pure, unit-tested: `crossedForward()` (forward-only,
  fast-scrub collapses to one tick) and `bedCurve()` (bed intensity).
- `src/audio/{context,bed,sfx}.js` — the Web Audio graph (context + synthesized
  reverb, the drone bed, the three one-shots). Not unit-testable in jsdom;
  covered by `e2e/audio.spec.js`.
- `src/audio/index.js` — `createAudio()`; `main.js` calls `audio.update(master.progress)`
  each frame using the **smoothed anime.js timeline playhead** (not raw scroll),
  so SFX land with the visuals.
```

- [ ] **Step 2: Verify no other suite is affected**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the audio module and beats.js in CLAUDE.md" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Hybrid underwater bed + HUD one-shots → Tasks 5, 6. ✓
- One-time enable prompt + mute toggle, WebGL-only, fallback silent → Task 8 (+ CSS default-hidden, reduced-motion e2e). ✓
- Bed + 3 key moments scope (layer tick on all 10 drops, cut, riser) → `AUDIO_CUES` (Task 1) + `sfx` (Task 6) + trigger mapping (Task 7). ✓
- Asset-free synthesis, no deps → context reverb + oscillator/noise voices (Tasks 4–6). ✓
- Forward-only SFX, continuous bed, sync to smoothed playhead → `crossedForward` (Task 2) + `master.progress` wiring (Task 8). ✓
- Shared `beats.js` consumed by `timeline.js` → Task 1. ✓
- Testing: unit for triggers/beats/icons, import-smoke for synth, e2e for enable + fallback → Tasks 1–8. ✓
- Docs → Task 9. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; commit messages concrete. ✓

**Type consistency:** `createAudio()` shape (`enabled`/`muted` getters, `enable`/`toggleMute`/`update`) is defined in Task 7 and used identically in Task 8. `createBed`/`createSfx`/`createAudioContext` signatures match between definition (Tasks 4–6) and consumption (Task 7). `AUDIO_CUES` cue shape `{id, at, kind}` is consistent across Tasks 1, 2, 7. `master.progress` (anime v4, verified) used in Task 8. ✓

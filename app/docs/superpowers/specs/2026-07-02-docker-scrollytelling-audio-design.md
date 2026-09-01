# Design: Synthesized Audio for the Docker Scrollytelling

**Date:** 2026-07-02
**Status:** Approved (pending spec review)

## Summary

Add asset-free, procedurally-synthesized audio to the scroll-driven Docker
explainer using only the Web Audio API — no sound files, matching the piece's
zero-asset ethos (procedural visuals, tree-shaken icons, re-skinned GLBs).

The score is deliberately lean but alive:

- a continuous **underwater drone bed** whose intensity tracks scroll, and
- three synthesized **one-shots**: a layer-drop *tick*, a multi-stage *cut*, and
  a finale *riser*.

Audio exists only in the full WebGL experience. It begins with a one-time
"enable sound" invite on the hero, then a persistent mute toggle. The
reduced-motion / no-WebGL fallback stays silent.

## Goals / non-goals

**Goals**
- Cohesive "underwater + sci-fi HUD" character that reinforces the existing
  visuals (cyan blueprint, Moby whale, plankton, fog).
- Sound events land *with* the visuals, not with raw scroll (the visual timeline
  is sync-smoothed and lags scroll).
- Respect browser autoplay policy and accessibility.
- Testable trigger logic despite Web Audio being hard to unit-test.

**Non-goals**
- No per-beat coverage of the exploded cutaway, per-section filter sweeps, or a
  recap outro (explicitly out of scope).
- No audio assets, no external audio libraries.
- No audio in the reduced-motion / fallback view.

## Sound character (decided)

Hybrid: a soft submerged drone bed under crisp HUD one-shots, resolving to a
triumphant riser at the Docker reveal.

## Architecture

A small, isolated `src/audio/` module. **All Web Audio lives here and is
DOM-free**; `main.js` remains the only wiring point (DOM, prompt/toggle,
per-frame `update` call). Each file has one purpose:

| File | Purpose |
|------|---------|
| `src/audio/context.js` | Owns the single `AudioContext`, master gain (mute gate), and a runtime-synthesized reverb (`ConvolverNode` fed an exponentially-decaying noise `AudioBuffer` — no impulse file). Created suspended. |
| `src/audio/bed.js` | The drone: 2–3 detuned low oscillators → lowpass (slow LFO on cutoff) → dry+reverb. `setIntensity(0..1)`. |
| `src/audio/sfx.js` | Three one-shot voices from oscillators/noise + envelopes: `tick()`, `cut()`, `riser()`. |
| `src/audio/triggers.js` | **Pure, no Web Audio.** Given `(prev, curr, cues)` returns which one-shots fire. The unit-testable core. Also `bedCurve(progress)`. |
| `src/audio/index.js` | `createAudio()` — wires the above; exposes `enable()`, `toggleMute()`, `update(progress)`, `enabled`. |
| `src/beats.js` (new, shared) | Single source of truth for beat timings (layer-drop positions, cut, reveal), consumed by **both** `timeline.js` and `audio/`. Guarantees audio/visual sync. |

### Module interfaces

```js
// context.js
createAudioContext() -> {
  ctx,                 // AudioContext (suspended until resume)
  master,              // GainNode → destination (mute gate)
  reverb,              // ConvolverNode input node (a shared wet send)
  resume(),            // ctx.resume()
}

// bed.js
createBed({ ctx, master, reverb }) -> {
  start(),             // create + start oscillators/LFO (called from enable())
  setIntensity(x),     // x in 0..1 → ramped gain + lowpass cutoff
  stop(),
}

// sfx.js
createSfx({ ctx, master, reverb }) -> {
  tick(), cut(), riser(),   // each schedules a short voice at ctx.currentTime
}

// triggers.js  (pure)
crossedForward(prev, curr, cues) -> Array<{ id, kind }>
bedCurve(progress) -> Number   // 0..1 shaped intensity

// index.js
createAudio() -> {
  enabled,             // boolean
  enable(): Promise,   // resume ctx, build graph, ramp master up, bed.start()
  toggleMute(): boolean,   // returns new muted state
  update(progress),    // per-frame; tracks prev; fires SFX; sets bed intensity
}
```

### `src/beats.js` (shared timings)

Derived from the positions already hard-coded in `timeline.js` so nothing
drifts:

```js
// timeline positions in 0..1 (multiplied by D=1000 inside timeline.js)
export const BUILD_DROPS   = [0,1,2,3,4,5].map(i => 0.08 + (i / 6) * 0.34)
export const RUNTIME_DROPS = [0,1,2,3].map(i => 0.54 + (i / 4) * 0.16)
export const LAYER_DROPS   = [...BUILD_DROPS, ...RUNTIME_DROPS] // 10, Dockerfile order
export const CUT_AT    = 0.46
export const REVEAL_AT = 0.90

// cue list consumed by the audio trigger logic
export const AUDIO_CUES = [
  ...LAYER_DROPS.map((at, i) => ({ id: `layer-${i}`, at, kind: 'tick' })),
  { id: 'cut',    at: CUT_AT,    kind: 'cut' },
  { id: 'reveal', at: REVEAL_AT, kind: 'riser' },
]
```

`timeline.js` is refactored to consume `BUILD_DROPS` / `RUNTIME_DROPS`
(mechanical: `const at = BUILD_DROPS[i] * D` in place of the inline
`(0.08 + i/build.length*0.34) * D`). Values are identical, so existing behavior
is unchanged; the unit and e2e suites confirm this.

## Sound design

- **Bed** — a slow, submerged drone. `intensity = bedCurve(progress)`: a gentle
  rise through the build, an extra swell into the finale, settling at the end.
  Runs continuously in **both** scroll directions. Starting point (tuned by ear):
  `0.3 + 0.35 * progress + 0.35 * smoothstep(0.85, 0.95, progress)`, clamped.
- **`tick()`** — short filtered HUD blip on **each** of the 10 layer drops.
- **`cut()`** — a brief filtered-noise swoosh + low thunk at the multi-stage cut
  (~46%), marking the second `FROM` / discarded build stage.
- **`riser()`** — the payoff at the reveal (~90%): upward pitch sweep + sub-boom
  + bright shimmer, timed to land with the existing white flash, bloom flare,
  and container elastic pop.

## Scroll-sync / trigger logic

**Sync source.** `update()` is driven by the **normalized timeline playhead**
(the sync-smoothed anime.js position), *not* raw `scrollY`, so one-shots land
with the visuals. `main.js` passes
`progress = clamp(master.currentTime / master.duration, 0, 1)` each frame
(implementation verifies the exact anime v4 property; falls back to the value
`onScroll` exposes if needed). The existing `sp = scrollY / …` remains for the
render loop's reveal check and is unaffected.

**One-shots fire on forward crossing only.** Each frame:

```
crossedForward(prev, curr, cues):
  if curr <= prev: return []                       // reverse or idle → silent
  hits = cues.filter(c => prev < c.at && c.at <= curr)
  collapse multiple 'tick' hits into a single tick // fast-scrub → at most one
  return non-tick hits + (one tick if any)
```

- The caller keeps `prev = curr` after each frame. The `prev < at <= curr` test
  inherently **re-arms** a cue only after the user scrolls back below it, so
  scrolling up is silent and scrolling forward again re-fires — no extra latch
  state. A small epsilon guards against jitter exactly on a boundary.
- The **bed** updates continuously (both directions) via `setIntensity`.
- Before `enable()`, `update()` still tracks `prev` (cheap) but schedules no
  voices, so enabling mid-scroll does not replay past cues (per-frame delta is
  tiny). When muted, cue scheduling is skipped.

## Enable / mute UX (decided)

- The hero shows a dismissible **"enable sound"** button (MDI speaker icon).
- Clicking it calls `ctx.resume()` **inside the gesture**, ramps the master gain
  up, starts the bed, hides the invite, and reveals a persistent corner **mute
  toggle**.
- The toggle ramps master gain to 0 / target and swaps `mdiVolumeHigh` ↔
  `mdiVolumeOff` (both added to `icons.js` via the existing named-import + `ICONS`
  map convention). State persists for the session.
- No autoplay attempt before the gesture.
- DOM (invite + toggle) is wired in `main.js`; the `audio/` module stays DOM-free.

## Reduced-motion / fallback

The audio module is constructed **only** in `main.js`'s WebGL branch. Because
`prefers-reduced-motion` already routes to `renderFallback()`, reduced-motion
users get the silent static blueprint automatically — no extra handling.

## Testing

- **Unit (vitest, `tests/audio-triggers.test.js`)** — `crossedForward` and
  `bedCurve` (pure):
  - forward crossing fires; reverse/idle fires nothing;
  - multiple ticks crossed in one frame collapse to exactly one;
  - `cut` / `riser` fire once per forward entry and re-arm after scrolling back;
  - `bedCurve` is monotonic-ish, clamped to 0..1, and swells near the finale.
  No `AudioContext` required.
- **E2e (playwright, `e2e/audio.spec.js`)** — in WebGL mode the invite renders;
  clicking it resumes the context (asserted via an exposed `window.__audio`
  flag / `ctx.state === 'running'`) and the toggle appears; scrubbing to the
  bottom produces no console/page errors. Actual timbre is tuned by ear.
- Existing suites must stay green (the `timeline.js` refactor is behavior-neutral).

## Files

**Add**
- `src/audio/context.js`, `src/audio/bed.js`, `src/audio/sfx.js`,
  `src/audio/triggers.js`, `src/audio/index.js`
- `src/beats.js`
- `tests/audio-triggers.test.js`
- `e2e/audio.spec.js`

**Edit**
- `src/main.js` — construct audio in the WebGL branch, wire invite + toggle DOM,
  call `audio.update(progress)` each frame from the normalized playhead.
- `src/timeline.js` — import drop positions from `src/beats.js`.
- `src/icons.js` — add `mdiVolumeHigh`, `mdiVolumeOff`.
- `index.html` — hero invite button + hidden corner toggle mount.
- `src/style.css` — invite + toggle styling.
- `CLAUDE.md` — document the `audio/` module and `beats.js` as the shared source
  of beat timings.

## Risks & mitigations

- **anime v4 playhead property** — if `currentTime`/`duration` differ in v4, the
  plan verifies against the installed version and adjusts the `progress`
  expression; the audio API is unaffected.
- **`timeline.js` refactor** — kept mechanical and value-identical; guarded by
  the existing unit + e2e suites.
- **Reverb cost** — a short synthesized impulse (≈1–2 s) keeps the convolver
  cheap; if profiling shows cost, fall back to a Schroeder feedback-delay
  network (also asset-free).

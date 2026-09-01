# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page, **scroll-driven 3D explainer of a multi-stage Dockerfile** (title: "Anatomy of a Docker Image"). Vanilla ES modules — **no framework** — built on Vite, Three.js, anime.js v4, SVG, and Canvas 2D. Scrolling builds the Docker image layer by layer; the whole thing falls back to a static HTML blueprint when WebGL is unavailable or `prefers-reduced-motion` is set.

## Commands

```bash
npm run dev              # Vite dev server → http://localhost:5173 (host 0.0.0.0)
npm run build            # production build to dist/
npm run preview          # serve the build on 0.0.0.0:8080
npm test                 # unit tests (vitest, jsdom)
npm run test:e2e         # end-to-end (playwright; auto-starts dev server)

# single unit test file / by name
npx vitest run tests/dockerfile.test.js
npx vitest run -t "has 10 ordered layers"

# single e2e spec
npx playwright test e2e/smoke.spec.js
```

## Architecture

### `src/dockerfile.js` is the single source of truth
The `LAYERS` array (10 instructions: 6 `build` stage + 4 `runtime` stage) defines the taught Dockerfile — each entry's instruction, args, teaching `note`, `sizeLabel`, and `@mdi/js` icon name. **Everything downstream derives from it**: the 3D containers, the SVG annotation chips, the static fallback list, and the assembled `DOCKERFILE_TEXT`. To change what the app teaches, edit this file only.

### Two render modes, chosen once at boot (`src/main.js`)
`shouldUseFallback({ gl, reducedMotion })` decides between:
- **WebGL mode** — the full 3D scene. Sets `document.body.dataset.mode = 'webgl'`.
- **Fallback mode** — `renderFallback()` injects a static HTML list + `<pre>` Dockerfile. Used when there's no WebGL context or reduced-motion is requested. Sets `dataset.mode = 'fallback'` and hides `#scenes`.

E2e tests and debugging rely on these `dataset.mode` values and on `window.__scene` (exposed in WebGL mode).

### Scroll IS the clock
There is no autoplay. `src/timeline.js` builds **one** anime.js master timeline (`createTimeline({ autoplay: false })`) and binds it to page scroll with `onScroll(...).link(tl)`. Scroll fraction 0..1 maps onto timeline units 0..`D` (1000). The per-frame render loop in `main.js` additionally reads `window.scrollY` directly to trigger the finale spin + DOCKER ceremony overlay once the reveal condition is met.

Because tweens are scrubbed **both directions** (scroll up reverses them), several tweens declare explicit `[from, to]` arrays so they fill deterministically on reverse — preserve this when editing timeline tweens.

### Scene modules (`src/scene/`)
- `world.js` — `WebGLRenderer` + `EffectComposer` with `UnrealBloomPass`, lights, fog, grid. Returns `{ scene, renderer, composer, bloom, resize }`. `resize()` also sets an aspect-compensating `camera.zoom` (< 1 on narrow/portrait viewports) so the landscape-tuned camera path still frames the whale on phones — zoom composes with the timeline's position tweens.
- `camera.js` — camera rig plus `CAMERA_KEYS`: camera pose (position + lookAt) per scroll beat. The timeline interpolates between these keyframes.
- `whale.js` — the Docker "Moby" whale GLB (`public/whale.glb`), re-skinned into the blueprint look. The model's **own** blue containers are moved into a stable `containers` group and hidden (scale ~0); the finale scales them back in as the payoff ("your image is built").
- `layers.js` — one real 3D container (`public/container.glb`) per Dockerfile instruction. Exports `LAYER_SPACING` / `LAYER_BASE_Y` used by the timeline for stacking.

### Async-load-safe invariant (important)
`createWhale()` and `createLayers()` return **synchronously** with stable Three.js groups and materials; the GLB geometry is attached later when `GLTFLoader` resolves. The timeline and annotations animate the shared groups/materials, so they work regardless of GLB load timing. Keep this pattern — don't make scene wiring depend on the loader callback having run.

### The "slab" interface
`layers.js` produces slab objects `{ id, data, mesh (Group), mat, edgeMat, home (Vector3), labelOn }` consumed by both `timeline.js` and `annotations.js`. `labelOn.v` (0..1) toggles a slab's annotation chip independently of the container's visibility (so the dimmed build stack can stay on screen without its labels during the multi-stage cut).

### Overlays (`src/overlay/`)
- `annotations.js` — SVG chips right-aligned against a fixed column of step-number badges (1-based Dockerfile command order) at the right screen edge, each chip joined to its slab by a leader line. Positions are projected from 3D each frame and de-collided vertically. `layout()` rescales every metric and ellipsizes over-long commands whenever the viewport width changes — this is what keeps the labels on-screen in mobile portrait.
- `particles.js` — Canvas 2D scanlines + drifting "plankton".

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

### `src/icons.js`
MDI icons are imported by **named static import** (`import { mdiFoo } from '@mdi/js'`) — never `import * as` — so the bundler tree-shakes the ~2.8 MB icon set down to only what's used. Adding an icon means adding **both** the named import and the entry in the local `ICONS` map.

## Testing notes

- Unit tests (`tests/`, vitest + jsdom) cover pure logic only: `dockerfile.js` data invariants, `fallback.js`, `icons.js`. No WebGL.
- E2e (`e2e/`, playwright) boots the real page: `smoke.spec.js` asserts WebGL boot with no console errors and that scrolling to the bottom reveals the whale's containers (`window.__scene.whale.containers.scale.x > 0.9`); `fallback.spec.js` forces reduced-motion via `contextOptions` and asserts the static blueprint renders.

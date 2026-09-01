# Docker Whale Scrollytelling — Design Spec

**Date:** 2026-07-01
**Status:** Approved (brainstorm) → ready for implementation plan

## Summary

Replace the existing DevOps Bootcamp dashboard with a single-page, 3D
scroll-driven "scrollytelling" site that teaches how a Docker image is built,
layer by layer, from this app's own **multi-stage Dockerfile**. A stylized
whale (Moby) anchors the scene; as the user scrolls, Dockerfile instructions
appear and stack as real 3D layers, culminating in an exploded cutaway of the
finished image and a `docker run` boot.

The project doubles as a technology showcase: **anime.js v4** (scroll timeline +
SVG drawing), **Three.js/WebGL** (the 3D world), **SVG** (blueprint
annotations), **Canvas 2D** (particles + boot terminal), and **HTML/CSS**
(structure + copy) each have a defined role.

The old dashboard (`src/main.js`, Chart.js/date-fns/lodash/confetti usage) is
retired. This is a fresh bootstrap repo, so dependency changes are unconstrained.

## Goals

- Teach the core Docker image concepts visually: **layers**, the key
  instructions (`FROM`, `WORKDIR`, `COPY`, `RUN`, `EXPOSE`, `CMD`,
  `COPY --from`), **layer caching**, and **multi-stage builds**.
- Maximum "wow": genuinely 3D, cinematic, scroll-scrubbed, reversible.
- Robust for a bootcamp's varied machines (WebGL + reduced-motion fallbacks).

## Non-Goals

- Not a real Docker engine or interactive Dockerfile editor — the layer data is
  authored/static.
- No backend, no build of an actual image at runtime.
- No user accounts, routing, or multi-page structure. One page.

## Aesthetic Direction

**Blueprint Technical**, rendered in true 3D:

- Dark schematic background (`#0b1220`), receding blueprint grid, cyan accent
  (`#38f5c9` / `#22d3ee`), light-blue text (`#7dd3fc`), monospace annotations.
- **Whale:** solid dark-navy body with a **cyan fresnel rim-glow** and wireframe
  accents (decided: solid + edge-glow, not pure wireframe). Built procedurally
  from Three.js primitives — no external glTF asset to license or source. Stays
  a generic stylized whale (trademark-safe).
- Bloom/postprocessing for the glow.
- **No emojis anywhere.** Icons use **Material Design Icons** via `@mdi/js`
  (inline SVG paths styled to match), e.g. `mdiConsole`, `mdiChevronDown`,
  `mdiArrowRightThin`, `mdiContentCopy`.

## Architecture

### Core pattern: sticky 3D stage + scroll-scrubbed master timeline

- One full-viewport WebGL `<canvas>` is pinned (`position: sticky`).
- The page is a tall scroll container (~600vh) of transparent "scene" sections
  layered over the canvas; each section provides copy and acts as a scroll
  waypoint.
- anime.js v4 `onScroll({ sync })` feeds normalized scroll progress (0→1) into a
  single master `createTimeline()` via `.link()`. The timeline `seek()`s to
  `duration * progress`, so **every frame is a deterministic function of scroll
  position** and fully reversible. `sync` gives smoothed (not janky) scrubbing.
- The master timeline drives: camera dolly/orbit, each layer's entrance, the
  multi-stage discard/replace, the exploded cutaway, and the boot sequence.

### Technology roles

| Tech | Role |
|---|---|
| **Three.js (WebGL)** | 3D world: procedural whale (solid + fresnel glow), layer slabs with real thickness, scroll-driven camera, exploded cutaway, bloom postprocessing |
| **anime.js v4** | Master scroll timeline (`onScroll`/`link`/`createTimeline`), `svg.createDrawable` line-drawing, micro-animations, staggers |
| **SVG** | Blueprint overlay: leader lines, measurement ticks, Dockerfile text drawn on per layer, size labels — an HTML-space overlay tracked to projected 3D positions |
| **Canvas 2D** | Ambient plankton/particles + scanlines behind the 3D; the faux `docker run` boot terminal (typing effect) |
| **HTML/CSS** | Scroll sections, copy blocks, the browser-frame "running app" UI, recap cheat-sheet, reduced-motion fallback |

### Data flow

`dockerfile.js` is the **single source of truth**: an ordered array of layer
objects `{ stage, instruction, args, note, sizeLabel, icon }`. Every subsystem
reads from it — Three.js builds one slab per entry, SVG renders one annotation
per entry, the recap assembles the full file from it. Changing the taught
Dockerfile means editing one array.

### Module structure (`src/`)

```
main.js            wires everything: init scene, overlays, scroll timeline, fallback check
dockerfile.js      the layer data (single source of truth) + assembled Dockerfile string
timeline.js        builds the master anime.js timeline from the scene + layer data
scene/
  world.js         renderer, scene, lights, bloom/postprocessing, blueprint grid, resize
  camera.js        camera rig + scroll-driven dolly/orbit keyframes
  whale.js         procedural low-poly whale mesh + fresnel material + idle bob
  layers.js        builds/positions layer slabs; entrance, discard, explode, reassemble
overlay/
  annotations.js   SVG leader lines + Dockerfile text (anime svg.createDrawable), 3D→screen tracking
  particles.js     Canvas 2D plankton + scanlines
  terminal.js      Canvas 2D faux `docker run` typing terminal + port-map animation
icons.js           MDI path constants (@mdi/js) + tiny inline-SVG helper
style.css          layout, scroll sections, browser frame, recap, fallback styling
fallback.js        static/stepped SVG blueprint when no WebGL or reduced-motion
index.html         canvas + sticky stage + scroll sections + overlays root
```

Each module is small, single-purpose, and testable in isolation: `whale.js`
exposes a mesh + `bob()`; `layers.js` exposes `build/discard/explode` methods the
timeline calls; `annotations.js` takes projected positions and draws.

## Scroll Storyboard (7 beats)

The taught Dockerfile (multi-stage, real for this Vite static site):

```dockerfile
# build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# runtime stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
```

1. **Hero · the deep** (0–8%) — Moby idle-bobs in the blueprint sea, particles
   drift. Title: "Anatomy of a Docker Image — scroll to build it." Scroll hint.
2. **Act I · build stage stacks up** (8–45%) — each instruction drops a slab:
   `FROM node AS build` → `WORKDIR` → `COPY package*.json` → `RUN npm ci` →
   `COPY . .` → `RUN build`. The **COPY-package.json-first** beat gets a
   highlighted caching callout. Camera orbits as the stack grows.
3. **The multi-stage cut** (45–58%) — the bulky build stack dims/greys and is
   discarded; a fresh, tiny `FROM nginx:alpine` image appears clean. The
   multi-stage "aha".
4. **Only the artifact travels** (58–72%) — `COPY --from=build /app/dist` lifts
   one small artifact from the discarded stack into the slim image; `EXPOSE 80`
   lights a port; `CMD` caps it. Image complete.
5. **Act III · exploded cutaway** (72–85%) — camera pulls back; the finished
   image's layers fly apart into a labeled exploded view with sizes, then
   reassemble. "Your image = 4 layers, ~25 MB."
6. **docker run · it boots** (85–95%) — Canvas 2D terminal types
   `docker run -p 8080:80 …`; container boots; the `80→8080` port map animates;
   Moby sails off carrying the live container; a browser frame shows the site
   running.
7. **Recap · cheat-sheet + CTA** (95–100%) — full Dockerfile assembles with each
   line annotated; takeaway chips (layer caching, multi-stage = slim); CTA:
   "Now write your own."

Pacing is approved as above (Act I ~37% of scroll).

## Error Handling / Robustness

- **No WebGL** or **`prefers-reduced-motion`** → `fallback.js` renders a static
  or step-through SVG blueprint of the same layers (built from `dockerfile.js`),
  so the lesson still lands without the 3D scrub. Detected once at init.
- **Resize** handled by `world.js` (renderer + camera aspect + overlay reproject).
- Timeline is pure-scrub (no time-based drift); scrubbing up fully reverses state.
- Assets are procedural/bundled — no runtime network dependency.

## Testing

- `npm run build` succeeds; `npm run dev` serves with no console errors.
- Playwright smoke test: page loads, canvas present, scroll to bottom throws no
  errors, recap section visible at 100%.
- Fallback path: with reduced-motion emulated, the static SVG blueprint renders
  and the Dockerfile text is present.
- Manual visual pass across the 7 beats (scrub forward and backward).

## Dependencies

- **Add:** `three` (+ its postprocessing/examples addons), `@mdi/js`.
- **Upgrade:** `animejs` `^3.2.2` → `^4.x` (new modular API: `animate`,
  `createTimeline`, `onScroll`, `svg`, `stagger`, `utils`).
- **Remove (retired dashboard):** `chart.js`, `date-fns`, `lodash-es`,
  `canvas-confetti` — unless a use survives (none currently planned).
- Keep: `vite`.

## Open Questions

None blocking. Slab sizes/labels in the exploded view are illustrative and can be
tuned during implementation.

# Docker Whale Scrollytelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard with a single-page, scroll-scrubbed 3D site that teaches how this app's multi-stage Dockerfile builds an image, layer by layer.

**Architecture:** One pinned WebGL canvas renders a Three.js world (procedural whale + layer slabs + bloom). A continuous rAF loop draws every frame; scroll position (via anime.js v4 `onScroll(...).link(timeline)`) scrubs a single master timeline that mutates Three object + SVG/DOM properties. `dockerfile.js` is the single source of truth for the taught layers. A fallback renders a static SVG blueprint when WebGL is unavailable or reduced-motion is set.

**Tech Stack:** Vite, Three.js (+ addons: EffectComposer, UnrealBloomPass), anime.js v4, `@mdi/js`, Vitest (unit), Playwright (smoke).

## Global Constraints

- **No emojis** anywhere in shipped markup, copy, or components. Icons use **Material Design Icons** (`@mdi/js`) rendered as inline SVG paths.
- **Aesthetic:** Blueprint Technical. Background `#0b1220`; cyan accent `#38f5c9` and `#22d3ee`; text `#7dd3fc`; monospace for code/annotations.
- **Whale:** solid dark-navy body + cyan edge glow (via emissive + wireframe accents + bloom), NOT pure wireframe. Procedural from Three.js primitives — no external 3D asset.
- **anime.js is v4** — modular imports: `import { createTimeline, onScroll, animate, svg, stagger, utils } from 'animejs'`. Do not use the v3 default-export `anime()` API.
- **Single page.** No routing, no backend. All layer data is static.
- Node.js 20+. Package manager: npm.
- The taught Dockerfile is exactly:
  ```dockerfile
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build
  FROM nginx:alpine
  COPY --from=build /app/dist /usr/share/nginx/html
  EXPOSE 80
  CMD ["nginx","-g","daemon off;"]
  ```

## File Structure

```
index.html              canvas + sticky stage + scroll sections + overlay roots
vite.config.js          vite + vitest (jsdom) config
playwright.config.js    e2e smoke config (spawns vite dev server)
src/
  main.js               wiring: fallback check, world, whale, layers, camera, overlays, timeline, rAF loop
  dockerfile.js         LAYERS data + DOCKERFILE_TEXT + helpers (single source of truth)
  timeline.js           builds the master anime.js timeline; links to scroll
  icons.js              MDI path constants + inline-SVG helper
  fallback.js           WebGL/reduced-motion detection + static SVG blueprint renderer
  scene/
    world.js            renderer, scene, lights, blueprint grid, fog, bloom composer, resize
    camera.js           camera rig + shared lookTarget
    whale.js            procedural whale group (body bobs) + cyan edge accents
    layers.js           slab meshes built from LAYERS + grouping
  overlay/
    annotations.js      SVG leader lines + Dockerfile text tracking projected slab positions
    particles.js        Canvas 2D plankton + scanlines
    terminal.js         Canvas 2D faux `docker run` boot terminal + port map
  style.css             layout, scroll sections, browser frame, recap, fallback
tests/
  dockerfile.test.js    unit: LAYERS integrity + assembled text
  fallback.test.js      unit: detection logic
e2e/
  smoke.spec.js         page loads, canvas present, scroll to bottom without errors, recap visible
```

---

### Task 1: Project reset, dependencies, and skeleton

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `playwright.config.js`
- Modify: `index.html`
- Create: `src/style.css`
- Replace: `src/main.js` (gut the dashboard; leave a minimal boot)
- Delete: none yet (main.js is overwritten)

**Interfaces:**
- Produces: a booting Vite app showing a dark blueprint page with an empty `<canvas id="stage">`, sticky, plus scroll sections scaffold and overlay roots (`#svg-overlay`, `#particles`, `#terminal`).

- [ ] **Step 1: Update `package.json`** (replace dependencies/scripts)

```json
{
  "name": "docker-scrollytelling",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "3D scroll-driven explainer of a multi-stage Dockerfile",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 8080",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "animejs": "^4.0.0",
    "three": "^0.169.0",
    "@mdi/js": "^7.4.47"
  },
  "devDependencies": {
    "vite": "^6.0.7",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0",
    "@playwright/test": "^1.48.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install && npx playwright install chromium`
Expected: installs succeed; no peer-dep errors that abort.

- [ ] **Step 3: Configure Vite + Vitest** — write `vite.config.js`

```js
import { defineConfig } from 'vite'

export default defineConfig({
  server: { host: '0.0.0.0', port: 5173 },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
})
```

- [ ] **Step 4: Playwright config** — write `playwright.config.js`

```js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
})
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Anatomy of a Docker Image</title>
  </head>
  <body>
    <div id="app">
      <canvas id="stage"></canvas>
      <canvas id="particles"></canvas>
      <svg id="svg-overlay" xmlns="http://www.w3.org/2000/svg"></svg>
      <canvas id="terminal"></canvas>

      <div id="scenes">
        <section class="scene" data-beat="hero"></section>
        <section class="scene" data-beat="build"></section>
        <section class="scene" data-beat="cut"></section>
        <section class="scene" data-beat="artifact"></section>
        <section class="scene" data-beat="explode"></section>
        <section class="scene" data-beat="run"></section>
        <section class="scene" data-beat="recap"></section>
      </div>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `src/style.css`** (base layout; sticky stage; sections define scroll length)

```css
:root {
  --bg: #0b1220; --cyan: #38f5c9; --cyan2: #22d3ee; --text: #7dd3fc;
  --mono: ui-monospace, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text); }
body { font-family: var(--mono); }

#stage, #particles, #terminal {
  position: fixed; inset: 0; width: 100vw; height: 100vh; display: block;
}
#stage { z-index: 1; }
#particles { z-index: 0; }
#terminal { z-index: 3; pointer-events: none; }
#svg-overlay { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 2; pointer-events: none; }

#scenes { position: relative; z-index: 4; }
.scene { height: 90vh; }               /* ~630vh total scroll */
.scene[data-beat="hero"] { height: 100vh; }

.fallback { position: relative; z-index: 5; padding: 6vh 6vw; }
```

- [ ] **Step 7: Write minimal `src/main.js`**

```js
import './style.css'

const canvas = document.getElementById('stage')
const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl')
// Placeholder boot — real wiring added in later tasks.
document.body.dataset.booted = ctx ? 'webgl' : 'nowebgl'
console.log('[boot]', document.body.dataset.booted)
```

- [ ] **Step 8: Verify dev server boots**

Run: `npm run build`
Expected: build completes with no errors, emits `dist/`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.js playwright.config.js index.html src/style.css src/main.js
git commit -m "chore: reset to scrollytelling skeleton + deps (three, animejs v4, mdi, vitest, playwright)"
```

---

### Task 2: `dockerfile.js` — the layer data (single source of truth)

**Files:**
- Create: `src/dockerfile.js`
- Test: `tests/dockerfile.test.js`

**Interfaces:**
- Produces:
  - `export const LAYERS` — ordered array of `{ id: string, stage: 'build'|'runtime', instruction: string, args: string, note: string, sizeLabel: string, icon: string }`. `icon` is an `@mdi/js` export name (string).
  - `export const DOCKERFILE_TEXT` — the full Dockerfile as a single string (with the two stage comments).
  - `export function layersByStage(stage)` → filtered array.
  - `export const RUNTIME_LAYERS` — `layersByStage('runtime')` (used by exploded view + recap).

- [ ] **Step 1: Write the failing test** — `tests/dockerfile.test.js`

```js
import { describe, it, expect } from 'vitest'
import { LAYERS, DOCKERFILE_TEXT, layersByStage, RUNTIME_LAYERS } from '../src/dockerfile.js'

describe('dockerfile data', () => {
  it('has 10 ordered layers, build stage then runtime stage', () => {
    expect(LAYERS).toHaveLength(10)
    expect(LAYERS.map(l => l.instruction)).toEqual([
      'FROM', 'WORKDIR', 'COPY', 'RUN', 'COPY', 'RUN',
      'FROM', 'COPY', 'EXPOSE', 'CMD',
    ])
    const stages = LAYERS.map(l => l.stage)
    expect(stages.slice(0, 6).every(s => s === 'build')).toBe(true)
    expect(stages.slice(6).every(s => s === 'runtime')).toBe(true)
  })

  it('every layer has unique id and required fields', () => {
    const ids = new Set(LAYERS.map(l => l.id))
    expect(ids.size).toBe(LAYERS.length)
    for (const l of LAYERS) {
      expect(l.note.length).toBeGreaterThan(0)
      expect(typeof l.sizeLabel).toBe('string')
      expect(l.icon.startsWith('mdi')).toBe(true)
    }
  })

  it('assembled text contains both FROM lines and the multi-stage COPY', () => {
    expect(DOCKERFILE_TEXT).toContain('FROM node:20-alpine AS build')
    expect(DOCKERFILE_TEXT).toContain('FROM nginx:alpine')
    expect(DOCKERFILE_TEXT).toContain('COPY --from=build /app/dist /usr/share/nginx/html')
    expect(DOCKERFILE_TEXT).toContain('CMD ["nginx","-g","daemon off;"]')
  })

  it('helpers filter by stage', () => {
    expect(layersByStage('build')).toHaveLength(6)
    expect(RUNTIME_LAYERS).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/dockerfile.js`.

- [ ] **Step 3: Write `src/dockerfile.js`**

```js
// Single source of truth for the taught multi-stage Dockerfile.
// icon values are @mdi/js export names, resolved in icons.js.
export const LAYERS = [
  { id: 'from-build', stage: 'build', instruction: 'FROM', args: 'node:20-alpine AS build',
    note: 'Every image starts FROM a base. Here: a small Node image, named "build".',
    sizeLabel: '~180 MB', icon: 'mdiLayersTriple' },
  { id: 'workdir', stage: 'build', instruction: 'WORKDIR', args: '/app',
    note: 'Sets the working directory for the commands that follow.',
    sizeLabel: '0 B', icon: 'mdiFolderOutline' },
  { id: 'copy-manifests', stage: 'build', instruction: 'COPY', args: 'package*.json ./',
    note: 'Copy manifests FIRST. If they do not change, Docker reuses the cached install layer.',
    sizeLabel: '4 KB', icon: 'mdiFileDocumentOutline' },
  { id: 'npm-ci', stage: 'build', instruction: 'RUN', args: 'npm ci',
    note: 'Installs dependencies into their own cached layer.',
    sizeLabel: '~120 MB', icon: 'mdiDownloadOutline' },
  { id: 'copy-src', stage: 'build', instruction: 'COPY', args: '. .',
    note: 'Now copy the rest of the source. Changes here do not bust the install cache above.',
    sizeLabel: '~1 MB', icon: 'mdiCodeTags' },
  { id: 'npm-build', stage: 'build', instruction: 'RUN', args: 'npm run build',
    note: 'Produces the static site in dist/.',
    sizeLabel: '~2 MB', icon: 'mdiCogOutline' },
  { id: 'from-runtime', stage: 'runtime', instruction: 'FROM', args: 'nginx:alpine',
    note: 'A fresh, tiny runtime stage. The whole build stage above is discarded.',
    sizeLabel: '~24 MB', icon: 'mdiLayersTriple' },
  { id: 'copy-from', stage: 'runtime', instruction: 'COPY', args: '--from=build /app/dist /usr/share/nginx/html',
    note: 'Only the built dist/ travels into the final image. No Node, no node_modules.',
    sizeLabel: '~2 MB', icon: 'mdiTransferRight' },
  { id: 'expose', stage: 'runtime', instruction: 'EXPOSE', args: '80',
    note: 'Documents the port the container listens on.',
    sizeLabel: '0 B', icon: 'mdiLanConnect' },
  { id: 'cmd', stage: 'runtime', instruction: 'CMD', args: '["nginx","-g","daemon off;"]',
    note: 'The command run when the container starts.',
    sizeLabel: '0 B', icon: 'mdiConsole' },
]

export function layersByStage(stage) {
  return LAYERS.filter((l) => l.stage === stage)
}

export const RUNTIME_LAYERS = layersByStage('runtime')

export const DOCKERFILE_TEXT = [
  '# --- build stage ---',
  ...layersByStage('build').map((l) => `${l.instruction} ${l.args}`),
  '',
  '# --- runtime stage ---',
  ...layersByStage('runtime').map((l) => `${l.instruction} ${l.args}`),
].join('\n')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dockerfile.js tests/dockerfile.test.js
git commit -m "feat: dockerfile layer data as single source of truth"
```

---

### Task 3: `scene/world.js` + render loop + Playwright smoke harness

**Files:**
- Create: `src/scene/world.js`
- Create: `src/scene/camera.js`
- Modify: `src/main.js`
- Create: `e2e/smoke.spec.js`

**Interfaces:**
- `camera.js` Produces: `export function createCameraRig()` → `{ camera: THREE.PerspectiveCamera, lookTarget: THREE.Vector3 }`. Camera starts at `(0, 2, 14)`, lookTarget `(0, 1, 0)`.
- `world.js` Consumes: a `THREE.PerspectiveCamera`. Produces: `export function createWorld(canvas, camera)` → `{ scene, renderer, composer, resize() }`. Sets background `#0b1220`, `FogExp2`, hemisphere+directional lights, a cyan `GridHelper` floor at `y=-2`, and an `EffectComposer` with `RenderPass` + `UnrealBloomPass`.

- [ ] **Step 1: Write `src/scene/camera.js`**

```js
import * as THREE from 'three'

export function createCameraRig() {
  const camera = new THREE.PerspectiveCamera(
    50, window.innerWidth / window.innerHeight, 0.1, 200,
  )
  camera.position.set(0, 2, 14)
  const lookTarget = new THREE.Vector3(0, 1, 0)
  camera.lookAt(lookTarget)
  return { camera, lookTarget }
}
```

- [ ] **Step 2: Write `src/scene/world.js`**

```js
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

export function createWorld(canvas, camera) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b1220')
  scene.fog = new THREE.FogExp2('#0b1220', 0.035)

  const hemi = new THREE.HemisphereLight('#22d3ee', '#020617', 0.6)
  const dir = new THREE.DirectionalLight('#8ecbff', 0.8)
  dir.position.set(5, 10, 7)
  scene.add(hemi, dir)

  const grid = new THREE.GridHelper(120, 60, '#38f5c9', '#173b46')
  grid.position.y = -2
  grid.material.transparent = true
  grid.material.opacity = 0.35
  scene.add(grid)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.6, 0.2,
  )
  composer.addPass(bloom)
  composer.setSize(window.innerWidth, window.innerHeight)

  function resize() {
    const w = window.innerWidth, h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
  }
  window.addEventListener('resize', resize)

  return { scene, renderer, composer, resize }
}
```

- [ ] **Step 3: Rewrite `src/main.js` to boot the world + rAF loop**

```js
import './style.css'
import * as THREE from 'three'
import { createCameraRig } from './scene/camera.js'
import { createWorld } from './scene/world.js'

const canvas = document.getElementById('stage')
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')

if (!gl) {
  document.body.dataset.mode = 'fallback'
} else {
  document.body.dataset.mode = 'webgl'
  const { camera, lookTarget } = createCameraRig()
  const world = createWorld(canvas, camera)
  const clock = new THREE.Clock()

  function frame() {
    requestAnimationFrame(frame)
    camera.lookAt(lookTarget)
    world.composer.render()
  }
  frame()

  // expose for later tasks / debugging
  window.__scene = { THREE, camera, lookTarget, world, clock }
}
```

- [ ] **Step 4: Write the Playwright smoke test** — `e2e/smoke.spec.js`

```js
import { test, expect } from '@playwright/test'

test('page boots in webgl mode with no console errors', async ({ page }) => {
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await expect(page.locator('#stage')).toBeVisible()
  await page.waitForFunction(() => document.body.dataset.mode === 'webgl')
  await page.waitForTimeout(500)

  expect(errors, errors.join('\n')).toEqual([])
})
```

- [ ] **Step 5: Run the smoke test**

Run: `npm run test:e2e`
Expected: PASS — canvas visible, `mode=webgl`, no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/scene/world.js src/scene/camera.js src/main.js e2e/smoke.spec.js
git commit -m "feat: three.js world (grid, lights, bloom) + render loop + smoke test"
```

---

### Task 4: `scene/whale.js` — procedural whale with edge glow

**Files:**
- Create: `src/scene/whale.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `export function createWhale()` → `{ object: THREE.Group, update(elapsed: number) }`. `object` is added to the scene; `update` bobs an inner body (the outer `object` position is reserved for the timeline's sailing move so bob and sail never fight).

- [ ] **Step 1: Write `src/scene/whale.js`**

```js
import * as THREE from 'three'

// Stylized whale from primitives: capsule body, tail fin, two side fins.
// Dark navy body + emissive; cyan wireframe accents; bloom does the glow.
export function createWhale() {
  const object = new THREE.Group()
  const body = new THREE.Group()
  object.add(body)

  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#0b2a3a', emissive: '#0a4a5a', emissiveIntensity: 0.45,
    metalness: 0.2, roughness: 0.55,
  })
  const accentMat = new THREE.LineBasicMaterial({ color: '#38f5c9', transparent: true, opacity: 0.9 })

  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 2.6, 8, 20), bodyMat)
  hull.rotation.z = Math.PI / 2
  hull.scale.set(1, 1, 0.8)
  body.add(hull)
  body.add(new THREE.LineSegments(new THREE.WireframeGeometry(hull.geometry), accentMat).copy(
    Object.assign(new THREE.LineSegments(new THREE.WireframeGeometry(hull.geometry), accentMat),
      { rotation: hull.rotation, scale: hull.scale }),
  ))

  // tail fin
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.2, 4), bodyMat)
  tail.position.set(-2.4, 0, 0)
  tail.rotation.z = Math.PI / 2
  tail.scale.set(1, 1, 0.3)
  body.add(tail)

  // eye
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshBasicMaterial({ color: '#38f5c9' }),
  )
  eye.position.set(1.7, 0.45, 0.55)
  body.add(eye)

  function update(elapsed) {
    body.position.y = Math.sin(elapsed * 1.2) * 0.18
    body.rotation.z = Math.sin(elapsed * 0.8) * 0.03
  }

  return { object, update }
}
```

> Note: the wireframe-copy line above is intentionally simple; if the executor finds the `.copy(Object.assign(...))` awkward, replace it with an explicit accent `LineSegments` whose `rotation`/`scale` are set to match `hull` (same visual result). Keep the accent lines cyan.

- [ ] **Step 2: Simplify the accent lines in `whale.js`** (cleaner equivalent — apply this)

Replace the `body.add(new THREE.LineSegments(...))` block with:

```js
  const accent = new THREE.LineSegments(new THREE.WireframeGeometry(hull.geometry), accentMat)
  accent.rotation.copy(hull.rotation)
  accent.scale.copy(hull.scale)
  body.add(accent)
```

- [ ] **Step 3: Add the whale in `main.js`** (inside the `else` webgl block, after `world` is created)

```js
  const whale = createWhale()
  world.scene.add(whale.object)
```

and add the import at top:

```js
import { createWhale } from './scene/whale.js'
```

and call `whale.update` in the loop (before `composer.render()`):

```js
    whale.update(clock.getElapsedTime())
```

also expose it: change the debug line to `window.__scene = { THREE, camera, lookTarget, world, clock, whale }`.

- [ ] **Step 4: Verify visually with a screenshot**

Run: `npm run test:e2e` (smoke must still pass — no console errors)
Then run: `npx playwright screenshot --viewport-size=1280,800 http://localhost:5173 /tmp/whale.png` (requires dev server running: `npm run dev` in another shell, or rely on smoke's webServer)
Expected: smoke PASS. Screenshot shows a glowing cyan-edged whale centered over a grid.

- [ ] **Step 5: Commit**

```bash
git add src/scene/whale.js src/main.js
git commit -m "feat: procedural whale with cyan edge glow"
```

---

### Task 5: `scene/layers.js` — layer slabs from data

**Files:**
- Create: `src/scene/layers.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `LAYERS` from `dockerfile.js`.
- Produces: `export function createLayers()` → `{ object: THREE.Group, slabs: Array<{ id, data, mesh: THREE.Mesh, edges: THREE.LineSegments, home: THREE.Vector3 }> }`. Slabs are created hidden (`mesh.material.opacity = 0`, `mesh.material.transparent = true`) and positioned at their `home` (stacked along +y). The timeline (Task 7) animates `mesh.position` and `mesh.material.opacity` to reveal/discard/explode. `home` is the resting stacked position.

- [ ] **Step 1: Write `src/scene/layers.js`**

```js
import * as THREE from 'three'
import { LAYERS } from '../dockerfile.js'

const SLAB_W = 5, SLAB_D = 3.2, SLAB_H = 0.5, GAP = 0.18

export function createLayers() {
  const object = new THREE.Group()
  const slabs = []

  LAYERS.forEach((data, i) => {
    const isRuntime = data.stage === 'runtime'
    const mat = new THREE.MeshStandardMaterial({
      color: isRuntime ? '#0e4d5a' : '#0b2a3a',
      emissive: '#0a5a6b', emissiveIntensity: 0.3,
      transparent: true, opacity: 0, metalness: 0.1, roughness: 0.6,
    })
    const geo = new THREE.BoxGeometry(SLAB_W, SLAB_H, SLAB_D)
    const mesh = new THREE.Mesh(geo, mat)

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: '#38f5c9', transparent: true, opacity: 0 }),
    )
    mesh.add(edges)

    const home = new THREE.Vector3(0, i * (SLAB_H + GAP), 0)
    mesh.position.copy(home).setY(home.y + 6) // start above; timeline drops it in
    object.add(mesh)

    slabs.push({ id: data.id, data, mesh, edges, home: home.clone() })
  })

  return { object, slabs }
}
```

- [ ] **Step 2: Add layers in `main.js`** (after whale)

```js
  const layers = createLayers()
  world.scene.add(layers.object)
```

import at top:

```js
import { createLayers } from './scene/layers.js'
```

expose: add `layers` to `window.__scene`.

- [ ] **Step 3: Temporary reveal to verify slabs render** (add TEMP block after creating layers; will be removed in Task 7)

```js
  // TEMP: reveal all slabs so we can verify geometry (removed in Task 7)
  layers.slabs.forEach((s) => {
    s.mesh.position.copy(s.home)
    s.mesh.material.opacity = 0.85
    s.edges.material.opacity = 0.9
  })
```

- [ ] **Step 4: Verify visually**

Run: `npm run test:e2e`
Expected: smoke PASS (no errors). Manual screenshot shows a stack of glowing-edged slabs.

- [ ] **Step 5: Remove the TEMP block** from Step 3 (Task 7 will drive reveals).

- [ ] **Step 6: Commit**

```bash
git add src/scene/layers.js src/main.js
git commit -m "feat: layer slabs built from dockerfile data"
```

---

### Task 6: Camera scroll keyframes helper

**Files:**
- Modify: `src/scene/camera.js`

**Interfaces:**
- Adds: `export const CAMERA_KEYS` — array of `{ at: number (0..1), pos: [x,y,z], look: [x,y,z] }` describing camera pose at each beat boundary. Consumed by the timeline (Task 7) to animate `camera.position` and `lookTarget` across scroll.

- [ ] **Step 1: Append `CAMERA_KEYS` to `src/scene/camera.js`**

```js
// Camera poses per beat (0..1 scroll). Timeline interpolates between these.
export const CAMERA_KEYS = [
  { at: 0.00, pos: [0, 2, 14], look: [0, 1, 0] },   // hero
  { at: 0.30, pos: [6, 3, 12], look: [0, 2, 0] },   // build stacking (orbit)
  { at: 0.52, pos: [-5, 3, 12], look: [0, 2.5, 0] },// multi-stage cut
  { at: 0.70, pos: [4, 2, 11], look: [0, 2, 0] },   // artifact travels
  { at: 0.82, pos: [0, 2, 16], look: [0, 2, 0] },   // exploded pull-back
  { at: 0.92, pos: [0, 1.5, 13], look: [0, 1, 0] }, // run
  { at: 1.00, pos: [0, 1.5, 13], look: [0, 1, 0] }, // recap
]
```

- [ ] **Step 2: Verify it imports cleanly**

Run: `npm run build`
Expected: build PASS.

- [ ] **Step 3: Commit**

```bash
git add src/scene/camera.js
git commit -m "feat: camera keyframes per scroll beat"
```

---

### Task 7: `timeline.js` — master scroll-scrubbed timeline

**Files:**
- Create: `src/timeline.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `{ camera, lookTarget }`, `whale`, `layers`, `CAMERA_KEYS`, and the scroll container element.
- Produces: `export function createMasterTimeline({ camera, lookTarget, whale, layers, scrollEl })` → the anime.js timeline (also linked to scroll internally). Uses `createTimeline({ autoplay: false })`, adds tweens on Three objects, and `onScroll({ target: scrollEl, sync: 0.15, enter: 'top top', leave: 'bottom bottom' }).link(tl)`.

The timeline duration is arbitrary (use `1000`); scroll progress maps to `tl.seek(duration * progress)` via `link`. Positions in the timeline (`0`, `'+=...'`) therefore describe *relative scroll fractions*.

- [ ] **Step 1: Write `src/timeline.js`**

```js
import { createTimeline, onScroll } from 'animejs'
import { CAMERA_KEYS } from './scene/camera.js'

const D = 1000 // total timeline units; scroll 0..1 maps to 0..D

export function createMasterTimeline({ camera, lookTarget, whale, layers, scrollEl }) {
  const tl = createTimeline({ autoplay: false, defaults: { ease: 'linear' } })

  // --- camera path: chain absolute-positioned tweens across the whole scroll ---
  for (let i = 1; i < CAMERA_KEYS.length; i++) {
    const k = CAMERA_KEYS[i]
    const start = CAMERA_KEYS[i - 1].at * D
    const dur = (k.at - CAMERA_KEYS[i - 1].at) * D
    tl.add(camera.position, { x: k.pos[0], y: k.pos[1], z: k.pos[2], duration: dur }, start)
    tl.add(lookTarget, { x: k.look[0], y: k.look[1], z: k.look[2], duration: dur }, start)
  }

  // --- Act I (8%..45%): build-stage slabs drop in + fade, staggered ---
  const build = layers.slabs.filter((s) => s.data.stage === 'build')
  build.forEach((s, i) => {
    const at = (0.08 + (i / build.length) * 0.34) * D
    const dur = 0.05 * D
    tl.add(s.mesh.position, { y: s.home.y, duration: dur, ease: 'outBack' }, at)
    tl.add(s.mesh.material, { opacity: 0.9, duration: dur }, at)
    tl.add(s.edges.material, { opacity: 1, duration: dur }, at)
  })

  // --- Multi-stage cut (45%..58%): dim + drop away the build stack ---
  build.forEach((s) => {
    tl.add(s.mesh.material, { opacity: 0.12, duration: 0.08 * D }, 0.46 * D)
    tl.add(s.edges.material, { opacity: 0.15, duration: 0.08 * D }, 0.46 * D)
    tl.add(s.mesh.position, { x: -9, duration: 0.1 * D, ease: 'inQuad' }, 0.48 * D)
  })

  // --- Runtime stage (52%..72%): slabs appear from y=0 upward, small stack ---
  const runtime = layers.slabs.filter((s) => s.data.stage === 'runtime')
  runtime.forEach((s, i) => {
    // restack runtime slabs near origin (independent of build home)
    const targetY = i * 0.68
    s.home.set(0, targetY, 0)
    s.mesh.position.set(0, targetY + 5, 0)
    const at = (0.54 + (i / runtime.length) * 0.16) * D
    const dur = 0.05 * D
    tl.add(s.mesh.position, { y: targetY, duration: dur, ease: 'outBack' }, at)
    tl.add(s.mesh.material, { opacity: 0.92, duration: dur }, at)
    tl.add(s.edges.material, { opacity: 1, duration: dur }, at)
  })

  // --- Exploded cutaway (72%..85%): spread runtime slabs apart, then reassemble ---
  runtime.forEach((s, i) => {
    const spread = (i - (runtime.length - 1) / 2) * 1.9
    tl.add(s.mesh.position, { y: s.home.y + spread + 2, duration: 0.06 * D, ease: 'outQuad' }, 0.73 * D)
    tl.add(s.mesh.position, { y: s.home.y, duration: 0.05 * D, ease: 'inOutQuad' }, 0.80 * D)
  })

  // --- Run (88%..100%): whale sails off to the right carrying the stack ---
  tl.add(whale.object.position, { x: 10, duration: 0.12 * D, ease: 'inQuad' }, 0.88 * D)
  tl.add(layers.object.position, { x: 10, duration: 0.12 * D, ease: 'inQuad' }, 0.88 * D)

  // --- link to scroll ---
  onScroll({ target: scrollEl, sync: 0.15, enter: 'top top', leave: 'bottom bottom' }).link(tl)

  return tl
}
```

- [ ] **Step 2: Wire it in `main.js`** — replace the removed TEMP block area; after `layers` created:

```js
  const master = createMasterTimeline({
    camera, lookTarget, whale, layers, scrollEl: document.documentElement,
  })
  window.__scene.master = master
```

import at top:

```js
import { createMasterTimeline } from './timeline.js'
```

- [ ] **Step 3: Verify scroll scrubs the scene**

Add a scroll assertion to `e2e/smoke.spec.js`:

```js
test('scrolling to the bottom scrubs without errors and moves the whale', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'webgl')
  const startX = await page.evaluate(() => window.__scene.whale.object.position.x)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(800)
  const endX = await page.evaluate(() => window.__scene.whale.object.position.x)
  expect(endX).toBeGreaterThan(startX)
  expect(errors, errors.join('\n')).toEqual([])
})
```

Run: `npm run test:e2e`
Expected: both smoke tests PASS; whale x increases after scrolling.

- [ ] **Step 4: Commit**

```bash
git add src/timeline.js src/main.js e2e/smoke.spec.js
git commit -m "feat: master scroll-scrubbed timeline (camera, layers, cut, explode, sail)"
```

---

### Task 8: `overlay/annotations.js` — SVG blueprint annotations

**Files:**
- Create: `src/overlay/annotations.js`
- Create: `src/icons.js`
- Modify: `src/main.js`

**Interfaces:**
- `icons.js` Produces: `export function mdi(name, size=18, color='#7dd3fc')` → an SVG string `<svg ...><path d="..."/></svg>` using the path from `@mdi/js` (e.g. `mdiConsole`). Throws a clear error if the name is unknown.
- `annotations.js` Consumes: the `#svg-overlay` element, `layers.slabs`, `camera`, `renderer`. Produces: `export function createAnnotations({ svgRoot, slabs, camera, renderer })` → `{ update() }`. On each `update()` it projects each visible slab's world position to screen space and positions a `<text>` (instruction + args) with a short leader `<line>`; hides labels for slabs with `mesh.material.opacity < 0.3`.

- [ ] **Step 1: Write `src/icons.js`**

```js
import * as mdiIcons from '@mdi/js'

export function mdi(name, size = 18, color = '#7dd3fc') {
  const path = mdiIcons[name]
  if (!path) throw new Error(`Unknown MDI icon: ${name}`)
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <path fill="${color}" d="${path}"/></svg>`
}
```

- [ ] **Step 2: Write `src/overlay/annotations.js`**

```js
import * as THREE from 'three'

const SVGNS = 'http://www.w3.org/2000/svg'

export function createAnnotations({ svgRoot, slabs, camera, renderer }) {
  const groups = slabs.map((s) => {
    const g = document.createElementNS(SVGNS, 'g')
    const line = document.createElementNS(SVGNS, 'line')
    line.setAttribute('stroke', '#38f5c9')
    line.setAttribute('stroke-width', '1')
    line.setAttribute('stroke-dasharray', '3 3')
    const text = document.createElementNS(SVGNS, 'text')
    text.setAttribute('fill', '#a5f3fc')
    text.setAttribute('font-family', 'ui-monospace, monospace')
    text.setAttribute('font-size', '13')
    text.textContent = `${s.data.instruction} ${s.data.args}`
    g.append(line, text)
    svgRoot.append(g)
    return { s, g, line, text }
  })

  const v = new THREE.Vector3()
  function update() {
    const w = renderer.domElement.clientWidth
    const h = renderer.domElement.clientHeight
    for (const { s, g, line, text } of groups) {
      const visible = s.mesh.material.opacity >= 0.3
      g.style.display = visible ? '' : 'none'
      if (!visible) continue
      s.mesh.getWorldPosition(v).project(camera)
      const x = (v.x * 0.5 + 0.5) * w
      const y = (-v.y * 0.5 + 0.5) * h
      const lx = x + 90 // label offset to the right
      line.setAttribute('x1', x + 40); line.setAttribute('y1', y)
      line.setAttribute('x2', lx - 6); line.setAttribute('y2', y)
      text.setAttribute('x', lx); text.setAttribute('y', y + 4)
    }
  }

  return { update }
}
```

- [ ] **Step 3: Wire in `main.js`** — after `master` created:

```js
  const annotations = createAnnotations({
    svgRoot: document.getElementById('svg-overlay'),
    slabs: layers.slabs, camera, renderer: world.renderer,
  })
```

import: `import { createAnnotations } from './overlay/annotations.js'`
call `annotations.update()` in the rAF loop before `composer.render()`.

- [ ] **Step 4: Add a unit test for `icons.js`** — `tests/icons.test.js`

```js
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
})
```

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Verify no console errors with annotations active**

Run: `npm run test:e2e`
Expected: smoke PASS.

- [ ] **Step 6: Commit**

```bash
git add src/icons.js src/overlay/annotations.js src/main.js tests/icons.test.js
git commit -m "feat: SVG blueprint annotations tracking slabs + MDI icon helper"
```

---

### Task 9: `overlay/particles.js` — Canvas 2D plankton + scanlines

**Files:**
- Create: `src/overlay/particles.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: the `#particles` canvas.
- Produces: `export function createParticles(canvas)` → `{ update(elapsed), resize() }`. Draws ~80 drifting cyan dots and faint horizontal scanlines on a transparent canvas behind the 3D stage.

- [ ] **Step 1: Write `src/overlay/particles.js`**

```js
export function createParticles(canvas) {
  const ctx = canvas.getContext('2d')
  let w, h, dots
  function resize() {
    w = canvas.width = window.innerWidth
    h = canvas.height = window.innerHeight
    dots = Array.from({ length: 80 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.6 + 0.4, s: Math.random() * 0.3 + 0.05,
    }))
  }
  resize()
  window.addEventListener('resize', resize)

  function update(elapsed) {
    ctx.clearRect(0, 0, w, h)
    // scanlines
    ctx.globalAlpha = 0.05; ctx.fillStyle = '#38f5c9'
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
    // plankton
    for (const d of dots) {
      d.y -= d.s
      if (d.y < 0) d.y = h
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.arc(d.x + Math.sin(elapsed + d.x) * 4, d.y, d.r, 0, Math.PI * 2)
      ctx.fillStyle = '#38f5c9'; ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  return { update, resize }
}
```

- [ ] **Step 2: Wire in `main.js`** — create before the loop; call `particles.update(elapsed)` in the loop. Also run in fallback mode? No — particles only in webgl block.

```js
  const particles = createParticles(document.getElementById('particles'))
```

import: `import { createParticles } from './overlay/particles.js'`

- [ ] **Step 3: Verify**

Run: `npm run test:e2e`
Expected: smoke PASS.

- [ ] **Step 4: Commit**

```bash
git add src/overlay/particles.js src/main.js
git commit -m "feat: canvas2d plankton + scanlines ambiance"
```

---

### Task 10: `overlay/terminal.js` — Canvas 2D `docker run` boot

**Files:**
- Create: `src/overlay/terminal.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: the `#terminal` canvas.
- Produces: `export function createTerminal(canvas)` → `{ setProgress(p: number), resize() }`. For scroll progress `p` in the run beat (0.85..1.0 mapped to 0..1 by the caller), it draws a bottom terminal panel that reveals `docker run -p 8080:80 devops-bootcamp` character-by-character, then a `container started` line, then an animated `80 -> 8080` port mapping. Below 0.85 the panel is hidden (caller passes `p<=0`).

- [ ] **Step 1: Write `src/overlay/terminal.js`**

```js
const CMD = '$ docker run -p 8080:80 devops-bootcamp'
const OK = 'container started on http://localhost:8080'

export function createTerminal(canvas) {
  const ctx = canvas.getContext('2d')
  let w, h
  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight }
  resize()
  window.addEventListener('resize', resize)

  function setProgress(p) {
    ctx.clearRect(0, 0, w, h)
    if (p <= 0) return
    const panelH = 150, pad = 24
    const y0 = h - panelH - 30, x0 = 40, pw = Math.min(560, w - 80)

    ctx.globalAlpha = 0.92; ctx.fillStyle = '#050a12'
    ctx.fillRect(x0, y0, pw, panelH)
    ctx.strokeStyle = '#16606b'; ctx.strokeRect(x0, y0, pw, panelH)
    ctx.globalAlpha = 1
    ctx.font = '14px ui-monospace, monospace'

    // type the command over the first 60% of p
    const typed = Math.floor(Math.min(1, p / 0.6) * CMD.length)
    ctx.fillStyle = '#a5f3fc'
    ctx.fillText(CMD.slice(0, typed) + (p < 0.6 ? '_' : ''), x0 + pad, y0 + 44)

    if (p >= 0.6) {
      ctx.fillStyle = '#38f5c9'
      ctx.fillText('OK ' + OK, x0 + pad, y0 + 78)
    }
    if (p >= 0.8) {
      const t = (p - 0.8) / 0.2
      ctx.fillStyle = '#fbbf24'
      ctx.fillText('80', x0 + pad, y0 + 116)
      const ax = x0 + pad + 40, aw = 90 * t
      ctx.strokeStyle = '#fbbf24'
      ctx.beginPath(); ctx.moveTo(ax, y0 + 111); ctx.lineTo(ax + aw, y0 + 111); ctx.stroke()
      if (t > 0.9) ctx.fillText('8080', ax + 96, y0 + 116)
    }
  }

  return { setProgress, resize }
}
```

- [ ] **Step 2: Wire in `main.js`** — create terminal; drive it from scroll progress in the loop.

Compute scroll progress in the loop and map the run beat:

```js
  const terminal = createTerminal(document.getElementById('terminal'))
```

import: `import { createTerminal } from './overlay/terminal.js'`

In the rAF loop, before `composer.render()`:

```js
    const sp = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1)
    terminal.setProgress(sp <= 0.85 ? 0 : (sp - 0.85) / 0.15)
```

- [ ] **Step 3: Verify the terminal appears near the bottom**

Extend `e2e/smoke.spec.js`:

```js
test('terminal draws near bottom of scroll', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'webgl')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(600)
  // canvas has non-empty pixels in the terminal region
  const hasInk = await page.evaluate(() => {
    const c = document.getElementById('terminal')
    const ctx = c.getContext('2d')
    const d = ctx.getImageData(60, c.height - 150, 400, 120).data
    return d.some((v, i) => i % 4 === 3 && v > 0)
  })
  expect(hasInk).toBe(true)
})
```

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/overlay/terminal.js src/main.js e2e/smoke.spec.js
git commit -m "feat: canvas2d docker-run boot terminal + port map"
```

---

### Task 11: HTML scene copy, recap cheat-sheet, browser frame, styling

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `src/main.js` (inject recap Dockerfile text + icons)

**Interfaces:**
- Consumes: `DOCKERFILE_TEXT`, `RUNTIME_LAYERS`, `mdi()`.
- Produces: readable copy per beat pinned within each `.scene`, a final recap panel (`#recap`) with the assembled Dockerfile and takeaway chips, and a "running app" browser frame shown in the run beat.

- [ ] **Step 1: Add copy blocks + recap + browser frame to `index.html`** (replace the empty `<section>`s)

```html
      <div id="scenes">
        <section class="scene" data-beat="hero">
          <div class="copy center">
            <h1>Anatomy of a Docker Image</h1>
            <p>Scroll to build this app's image, one layer at a time.</p>
            <div class="hint" id="scroll-hint"></div>
          </div>
        </section>
        <section class="scene" data-beat="build">
          <div class="copy">
            <span class="label">Act I — build stage</span>
            <p>Each instruction adds a read-only <b>layer</b>. Copy <code>package*.json</code> before the source so the install layer stays cached.</p>
          </div>
        </section>
        <section class="scene" data-beat="cut">
          <div class="copy">
            <span class="label">Multi-stage</span>
            <p>A second <code>FROM</code> starts a fresh stage. The whole build stage is thrown away.</p>
          </div>
        </section>
        <section class="scene" data-beat="artifact">
          <div class="copy">
            <span class="label">Copy across stages</span>
            <p><code>COPY --from=build</code> takes only <code>dist/</code> into the slim runtime image.</p>
          </div>
        </section>
        <section class="scene" data-beat="explode">
          <div class="copy">
            <span class="label">Your image</span>
            <p>Four runtime layers, roughly 25&nbsp;MB — no Node, no toolchain.</p>
          </div>
        </section>
        <section class="scene" data-beat="run">
          <div class="copy">
            <span class="label">docker run</span>
            <p>Map the container's port 80 to 8080 and it's live.</p>
            <div class="browser-frame" id="browser-frame">
              <div class="bar"><span></span><span></span><span></span>localhost:8080</div>
              <div class="viewport">nginx is serving your site</div>
            </div>
          </div>
        </section>
        <section class="scene" data-beat="recap">
          <div class="copy recap" id="recap">
            <h2>Recap</h2>
            <pre id="recap-code"></pre>
            <div class="chips">
              <span class="chip">layer caching</span>
              <span class="chip">multi-stage = slim image</span>
            </div>
            <p class="cta">Now write your own Dockerfile.</p>
          </div>
        </section>
      </div>
```

- [ ] **Step 2: Append styles to `src/style.css`**

```css
.scene { display: flex; align-items: center; padding: 0 8vw; }
.scene[data-beat="hero"] { justify-content: center; }
.copy { max-width: 460px; background: rgba(5,10,18,.55); border: 1px solid #16303f;
  border-radius: 12px; padding: 20px 22px; backdrop-filter: blur(3px); }
.copy.center { text-align: center; background: transparent; border: 0; }
.copy h1 { color: #e2e8f0; font-size: clamp(28px, 5vw, 52px); margin: 0 0 10px; }
.copy h2 { color: #e2e8f0; }
.copy p { color: #9fb3c8; line-height: 1.6; }
.label { display: inline-block; text-transform: uppercase; letter-spacing: 2px;
  font-size: 11px; color: var(--cyan); margin-bottom: 8px; }
code { color: #a5f3fc; background: rgba(56,245,201,.08); padding: 1px 5px; border-radius: 4px; }
.hint { margin-top: 24px; opacity: .7; display: flex; justify-content: center; animation: nudge 1.6s infinite; }
@keyframes nudge { 0%,100% { transform: translateY(0); } 50% { transform: translateY(8px); } }

.browser-frame { margin-top: 16px; border: 1px solid #16606b; border-radius: 8px; overflow: hidden; }
.browser-frame .bar { background: #0e1826; color: #64748b; font-size: 11px; padding: 6px 10px; display: flex; gap: 6px; align-items: center; }
.browser-frame .bar span { width: 8px; height: 8px; border-radius: 50%; background: #334155; }
.browser-frame .viewport { background: #050a12; color: #38f5c9; padding: 28px; text-align: center; font-size: 13px; }

.recap pre { background: #050a12; border: 1px solid #16606b; border-radius: 8px; padding: 14px; color: #a5f3fc; overflow: auto; font-size: 12.5px; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.chip { background: rgba(56,245,201,.14); color: #7cffe0; border-radius: 20px; padding: 4px 10px; font-size: 11px; }
.cta { color: #e2e8f0; font-weight: 600; }

@media (prefers-reduced-motion: reduce) { .hint { animation: none; } }
```

- [ ] **Step 3: Populate recap + scroll-hint icon in `main.js`** (runs in both modes, before the webgl branch)

```js
import { DOCKERFILE_TEXT } from './dockerfile.js'
import { mdi } from './icons.js'
document.getElementById('recap-code').textContent = DOCKERFILE_TEXT
const hint = document.getElementById('scroll-hint')
if (hint) hint.innerHTML = mdi('mdiChevronDown', 28, '#38f5c9')
```

- [ ] **Step 4: Verify copy + recap present**

Add to `e2e/smoke.spec.js`:

```js
test('recap shows the assembled dockerfile', async ({ page }) => {
  await page.goto('/')
  const code = await page.locator('#recap-code').textContent()
  expect(code).toContain('FROM node:20-alpine AS build')
  expect(code).toContain('FROM nginx:alpine')
})
```

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html src/style.css src/main.js e2e/smoke.spec.js
git commit -m "feat: scene copy, recap cheat-sheet, browser frame, MDI scroll hint"
```

---

### Task 12: `fallback.js` — no-WebGL / reduced-motion static blueprint

**Files:**
- Create: `src/fallback.js`
- Modify: `src/main.js`
- Test: `tests/fallback.test.js`

**Interfaces:**
- Produces:
  - `export function shouldUseFallback({ gl, reducedMotion })` → boolean (`true` if `!gl` OR `reducedMotion`). Pure; unit-tested.
  - `export function renderFallback(root)` → appends a static SVG blueprint listing every layer (instruction + note) built from `LAYERS`, plus the assembled Dockerfile. No animation.

- [ ] **Step 1: Write the failing test** — `tests/fallback.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/fallback.js`.

- [ ] **Step 3: Write `src/fallback.js`**

```js
import { LAYERS, DOCKERFILE_TEXT } from './dockerfile.js'
import { mdi } from './icons.js'

export function shouldUseFallback({ gl, reducedMotion }) {
  return !gl || !!reducedMotion
}

export function renderFallback(root) {
  const wrap = document.createElement('div')
  wrap.className = 'fallback'
  wrap.innerHTML = `
    <h1>Anatomy of a Docker Image</h1>
    <p>A static view of this app's multi-stage Dockerfile.</p>
    <ol class="fb-layers">
      ${LAYERS.map((l) => `
        <li>
          <span class="fb-icon">${mdi(l.icon, 18, '#38f5c9')}</span>
          <code>${l.instruction} ${l.args}</code>
          <span class="fb-note">${l.note}</span>
        </li>`).join('')}
    </ol>
    <pre>${DOCKERFILE_TEXT}</pre>
  `
  root.append(wrap)
}
```

- [ ] **Step 4: Add fallback styles to `src/style.css`**

```css
.fb-layers { list-style: none; padding: 0; max-width: 760px; }
.fb-layers li { display: grid; grid-template-columns: 28px 1fr; gap: 6px 12px;
  align-items: start; padding: 10px 0; border-bottom: 1px solid #16303f; }
.fb-layers .fb-note { grid-column: 2; color: #9fb3c8; font-size: 13px; }
.fallback pre { background: #050a12; border: 1px solid #16606b; border-radius: 8px;
  padding: 14px; color: #a5f3fc; overflow: auto; }
```

- [ ] **Step 5: Use it in `main.js`** — replace the top-level webgl gate

```js
import { shouldUseFallback, renderFallback } from './fallback.js'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (shouldUseFallback({ gl, reducedMotion })) {
  document.body.dataset.mode = 'fallback'
  document.getElementById('scenes').style.display = 'none'
  renderFallback(document.getElementById('app'))
} else {
  document.body.dataset.mode = 'webgl'
  // ... existing webgl wiring ...
}
```

- [ ] **Step 6: Run unit tests**

Run: `npm test`
Expected: PASS (dockerfile + icons + fallback suites).

- [ ] **Step 7: Add a reduced-motion e2e test** — `e2e/fallback.spec.js`

```js
import { test, expect } from '@playwright/test'

test.use({ reducedMotion: 'reduce' })
test('reduced motion renders the static blueprint', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'fallback')
  await expect(page.locator('.fallback')).toContainText('nginx:alpine')
})
```

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/fallback.js src/main.js src/style.css tests/fallback.test.js e2e/fallback.spec.js
git commit -m "feat: no-webgl / reduced-motion static blueprint fallback"
```

---

### Task 13: Final integration, full-scroll smoke, cleanup

**Files:**
- Modify: `src/main.js` (final review of loop order + exposure)
- Modify: `e2e/smoke.spec.js`
- Delete: any leftover dashboard artifacts (`src/main.js` old code already replaced)

**Interfaces:**
- No new exports. Verifies the whole system end-to-end.

- [ ] **Step 1: Review `main.js` loop order** — ensure the rAF loop calls, in order: `whale.update(t)`, `particles.update(t)`, `annotations.update()`, `terminal.setProgress(...)`, `camera.lookAt(lookTarget)`, `world.composer.render()`. Fix ordering if drifted.

- [ ] **Step 2: Add a full 7-beat scrub e2e** — append to `e2e/smoke.spec.js`

```js
test('scrubbing through all beats produces no errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => document.body.dataset.mode === 'webgl')
  const steps = 12
  for (let i = 0; i <= steps; i++) {
    await page.evaluate((f) => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo(0, max * f)
    }, i / steps)
    await page.waitForTimeout(120)
  }
  expect(errors, errors.join('\n')).toEqual([])
})
```

- [ ] **Step 3: Run the whole suite**

Run: `npm test && npm run test:e2e`
Expected: all unit + e2e tests PASS.

- [ ] **Step 4: Production build sanity**

Run: `npm run build && npm run preview`
Expected: build succeeds; preview serves at `:8080` with the scene working (manual check).

- [ ] **Step 5: Update `README.md`** to describe the new site (replace dashboard text)

```markdown
# docker-scrollytelling

A single-page, scroll-driven 3D explainer of a multi-stage Dockerfile — built
with Vite, Three.js, anime.js v4, SVG, and Canvas 2D. Scroll to build the image
layer by layer; falls back to a static blueprint without WebGL or with
reduced-motion.

## Run
\`\`\`bash
npm install
npm run dev      # http://localhost:5173
\`\`\`

## Test
\`\`\`bash
npm test         # unit (vitest)
npm run test:e2e # smoke (playwright)
\`\`\`
```

- [ ] **Step 6: Commit**

```bash
git add src/main.js e2e/smoke.spec.js README.md
git commit -m "test: full-scroll smoke + docs; final integration"
```

---

## Self-Review

**Spec coverage:**
- Replace dashboard → Task 1 (gut main.js, new index.html). ✔
- Multi-stage Dockerfile as data → Task 2. ✔
- Sticky canvas + scroll-scrubbed master timeline (anime v4 onScroll/link) → Tasks 3, 7. ✔
- Three.js world + bloom → Task 3. ✔
- Solid whale + edge glow (not wireframe) → Task 4. ✔
- Layer slabs, build-stack, multi-stage discard, artifact copy, exploded cutaway, sail → Tasks 5, 7. ✔
- SVG blueprint annotations → Task 8. ✔
- Canvas 2D particles → Task 9; boot terminal + port map → Task 10. ✔
- HTML/CSS sections, recap cheat-sheet, browser frame → Task 11. ✔
- No-WebGL / reduced-motion fallback → Task 12. ✔
- No emojis; MDI icons → icons.js (Task 8), used in hint (Task 11) + fallback (Task 12); global constraint stated. ✔
- Dependencies: add three + @mdi/js, upgrade animejs v4, drop dashboard libs → Task 1. ✔
- Testing: unit (dockerfile, icons, fallback) + Playwright smoke → throughout. ✔

**Placeholder scan:** No TBD/TODO. The one prose note (whale accent lines) is immediately followed by concrete replacement code in Task 4 Step 2. ✔

**Type consistency:** `createWorld(canvas, camera)→{scene,renderer,composer,resize}`; `createCameraRig()→{camera,lookTarget}`; `createWhale()→{object,update}`; `createLayers()→{object,slabs:[{id,data,mesh,edges,home}]}`; `createMasterTimeline({camera,lookTarget,whale,layers,scrollEl})`; `createAnnotations({svgRoot,slabs,camera,renderer})→{update}`; `createParticles(canvas)→{update,resize}`; `createTerminal(canvas)→{setProgress,resize}`; `mdi(name,size,color)`; `shouldUseFallback({gl,reducedMotion})`; `renderFallback(root)`. Names/shapes used consistently across tasks. ✔

## Notes for the implementer

- The visual fidelity in these code blocks is a correct, runnable *baseline*. During each task's verify step, tune magnitudes (bloom strength, slab sizes, camera keys, stagger timing) for polish — the interfaces stay fixed.
- Three.js addon import paths use the `three/addons/...` alias, which Vite resolves from the `three` package. If resolution fails, use `three/examples/jsm/...` instead.
- anime.js v4 API only. If `onScroll(...).link(tl)` scrubbing feels off, confirm `sync` is a number (smoothed) and that `scrollEl` is the scrolling element (`document.documentElement`).

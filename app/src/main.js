import './style.css'
import * as THREE from 'three'
import { createCameraRig } from './scene/camera.js'
import { createWorld } from './scene/world.js'
import { createWhale } from './scene/whale.js'
import { createLayers } from './scene/layers.js'
import { createMasterTimeline } from './timeline.js'
import { createAnnotations } from './overlay/annotations.js'
import { createParticles } from './overlay/particles.js'
import { mdi } from './icons.js'
import { shouldUseFallback, renderFallback } from './fallback.js'
import { createAudio } from './audio/index.js'

const hint = document.getElementById('scroll-hint')
if (hint) hint.innerHTML = mdi('mdiChevronDown', 28, '#38f5c9')

const canvas = document.getElementById('stage')
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (shouldUseFallback({ gl, reducedMotion })) {
  document.body.dataset.mode = 'fallback'
  document.getElementById('scenes').style.display = 'none'
  renderFallback(document.getElementById('app'))
} else {
  document.body.dataset.mode = 'webgl'
  const { camera, lookTarget } = createCameraRig()
  const world = createWorld(canvas, camera)
  const whale = createWhale()
  world.scene.add(whale.object)
  const layers = createLayers()
  world.scene.add(layers.object)
  const clock = new THREE.Clock()

  const master = createMasterTimeline({
    camera, lookTarget, whale, layers, bloom: world.bloom,
    scrollEl: document.documentElement,
  })

  const annotations = createAnnotations({
    svgRoot: document.getElementById('svg-overlay'),
    slabs: layers.slabs, camera, renderer: world.renderer,
  })

  const particles = createParticles(document.getElementById('particles'))
  const ceremonyEl = document.getElementById('ceremony')

  // --- audio: one-time hero invite → resumes context; then a corner mute toggle ---
  const audio = createAudio({ musicUrl: import.meta.env.BASE_URL + 'ambient.mp3' })
  const invite = document.getElementById('sound-invite')
  const toggle = document.getElementById('sound-toggle')
  if (invite && toggle) {
    invite.innerHTML = mdi('mdiVolumeHigh', 20, '#38f5c9') + '<span>Enable sound</span>'
    toggle.innerHTML = mdi('mdiVolumeHigh', 22, '#38f5c9')
    toggle.setAttribute('aria-pressed', 'false')
    invite.style.display = 'flex'
    invite.addEventListener('click', async () => {
      invite.style.display = 'none' // hide before awaiting so a rapid double-click can't re-enter enable()
      try {
        await audio.enable()
        toggle.style.display = 'grid'
      } catch (e) {
        invite.style.display = 'flex' // allow retry if the context failed to start
      }
    })
    toggle.addEventListener('click', () => {
      const muted = audio.toggleMute()
      toggle.innerHTML = mdi(muted ? 'mdiVolumeOff' : 'mdiVolumeHigh', 22, '#38f5c9')
      toggle.setAttribute('aria-pressed', String(muted))
    })
  }
  window.__audio = audio

  let last = 0
  function frame() {
    requestAnimationFrame(frame)
    const elapsed = clock.getElapsedTime()
    const delta = elapsed - last; last = elapsed
    const sp = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1)
    camera.lookAt(lookTarget)
    whale.update(elapsed)
    // Finale: once the Docker logo is revealed (its containers scaled in), spin
    // the whole whale as a continuous 360° turntable; otherwise keep it forward.
    const revealed = sp > 0.6 && whale.containers.scale.x > 0.9
    whale.object.rotation.y = revealed ? whale.object.rotation.y + delta * 0.5 : 0
    if (ceremonyEl) ceremonyEl.classList.toggle('show', revealed)
    annotations.update()
    particles.update(elapsed)
    audio.update(master.progress)
    world.composer.render()
  }
  frame()

  // expose for later tasks / debugging
  window.__scene = { THREE, camera, lookTarget, world, clock, whale, layers, master, annotations }
}

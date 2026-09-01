import { createTimeline, onScroll } from 'animejs'
import { CAMERA_KEYS } from './scene/camera.js'
import { LAYER_SPACING, LAYER_BASE_Y } from './scene/layers.js'
import { BUILD_DROPS, RUNTIME_DROPS } from './beats.js'

const D = 1000 // total timeline units; scroll 0..1 maps to 0..D

export function createMasterTimeline({ camera, lookTarget, whale, layers, bloom, scrollEl }) {
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
    const at = BUILD_DROPS[i] * D
    const dur = 0.05 * D
    tl.add(s.mesh.position, { y: s.home.y, duration: dur, ease: 'outBack' }, at)
    tl.add(s.mat, { opacity: 0.9, duration: dur }, at)
    tl.add(s.edgeMat, { opacity: 1, duration: dur }, at)
    tl.add(s.labelOn, { v: 1, duration: dur }, at)
  })

  // --- Multi-stage cut (45%..58%): a second FROM starts a fresh stage. The
  //     build stack stays on screen (moved aside, dimmed, UNLABELLED) so both
  //     stages are visible; it is discarded for good only at the final reveal. ---
  build.forEach((s) => {
    tl.add(s.labelOn, { v: 0, duration: 0.05 * D }, 0.46 * D)
    tl.add(s.mat, { opacity: 0.4, duration: 0.08 * D }, 0.46 * D)
    tl.add(s.edgeMat, { opacity: 0.5, duration: 0.08 * D }, 0.46 * D)
    tl.add(s.mesh.position, { x: -1.5, duration: 0.1 * D, ease: 'inOutQuad' }, 0.48 * D)
  })

  // --- Runtime stage (52%..72%): slabs appear from y=0 upward, small stack ---
  const runtime = layers.slabs.filter((s) => s.data.stage === 'runtime')
  runtime.forEach((s, i) => {
    // restack runtime slabs on the deck (independent of build home)
    const targetY = LAYER_BASE_Y + i * LAYER_SPACING
    s.home.set(0, targetY, 0)
    s.mesh.position.set(0, targetY + 5, 0)
    const at = RUNTIME_DROPS[i] * D
    const dur = 0.05 * D
    tl.add(s.mesh.position, { y: targetY, duration: dur, ease: 'outBack' }, at)
    tl.add(s.mat, { opacity: 0.92, duration: dur }, at)
    tl.add(s.edgeMat, { opacity: 1, duration: dur }, at)
    tl.add(s.labelOn, { v: 1, duration: dur }, at)
  })

  // --- Exploded cutaway (72%..85%): a MINIMAL fan-out of BOTH stacks — each
  //     expands upward (base anchored) so it never dips into the whale — then
  //     reassembles. ---
  layers.slabs.forEach((s) => {
    const stack = s.data.stage === 'build' ? build : runtime
    const i = stack.indexOf(s)
    tl.add(s.mesh.position, { y: s.home.y + i * 0.45, duration: 0.06 * D, ease: 'outQuad' }, 0.73 * D)
    tl.add(s.mesh.position, { y: s.home.y, duration: 0.05 * D, ease: 'inOutQuad' }, 0.80 * D)
  })

  // --- FINALE (85%..99%): the two stacks COMBINE, then the real Docker logo reveals ---
  // 1. both stacks swoop onto the whale's deck while shrinking in LOCKSTEP with
  //    the move: position and scale share the same window and ease, so the gap
  //    between containers and the containers themselves shrink by the same
  //    factor and never interpenetrate mid-flight. Explicit [from, to] on scale
  //    so reverse scrubbing fills deterministically.
  layers.slabs.forEach((s) => {
    tl.add(s.labelOn, { v: 0, duration: 0.02 * D }, 0.85 * D)
    tl.add(s.mesh.position, { x: 0, y: 0.4, z: 0, duration: 0.06 * D, ease: 'inOutQuad' }, 0.85 * D)
    tl.add(s.mesh.scale, {
      x: [1, 0.01], y: [1, 0.01], z: [1, 0.01],
      duration: 0.06 * D, ease: 'inOutQuad',
    }, 0.85 * D)
  })
  // 2. the shrinking stacks dissolve as the real containers take their place
  layers.slabs.forEach((s) => {
    tl.add(s.mat, { opacity: 0, duration: 0.05 * D }, 0.87 * D)
    tl.add(s.edgeMat, { opacity: 0, duration: 0.05 * D }, 0.87 * D)
  })
  // 3. white flash at the moment of reveal
  tl.add('#flash', { opacity: 0.85, duration: 0.02 * D, ease: 'outQuad' }, 0.905 * D)
  tl.add('#flash', { opacity: 0, duration: 0.07 * D, ease: 'inQuad' }, 0.925 * D)
  // 4. bloom flare, then settle
  tl.add(bloom, { strength: 1.9, duration: 0.02 * D }, 0.905 * D)
  tl.add(bloom, { strength: 0.75, duration: 0.07 * D, ease: 'outQuad' }, 0.925 * D)
  // 5. the whale's OWN containers burst in (elastic pop). Explicit [from, to]
  //    so the tween fills deterministically both ways (reverses on scroll-up).
  tl.add(whale.containers.scale, {
    x: [0.0001, 1], y: [0.0001, 1], z: [0.0001, 1],
    duration: 0.085 * D, ease: 'outElastic(1, .45)',
  }, 0.91 * D)
  // 6. a triumphant spin of the whole whale as the logo lands
  tl.add(whale.body.rotation, { y: [0, Math.PI * 0.6], duration: 0.09 * D, ease: 'outCubic' }, 0.90 * D)
  // (the DOCKER ascii ceremony is toggled from the render loop on reveal — see main.js)

  // --- link to scroll ---
  onScroll({ target: scrollEl, sync: 0.15, enter: 'top top', leave: 'bottom bottom' }).link(tl)

  return tl
}

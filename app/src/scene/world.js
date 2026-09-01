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
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.6, 0.25,
  )
  composer.addPass(bloom)
  composer.setSize(window.innerWidth, window.innerHeight)

  function resize() {
    const w = window.innerWidth, h = window.innerHeight
    camera.aspect = w / h
    // The scroll camera path is tuned for landscape. On narrow/portrait
    // viewports the horizontal FOV collapses, so zoom out (zoom < 1) until the
    // whale + stacks fit the width again. Zoom is orthogonal to the timeline's
    // position/lookAt tweens, so this composes with any scroll pose.
    camera.zoom = Math.min(1, Math.max(0.55, camera.aspect / 1.4))
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
  }
  window.addEventListener('resize', resize)
  resize()

  return { scene, renderer, composer, bloom, resize }
}

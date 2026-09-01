import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// The Docker "Moby" whale (David Balan, CC-BY — public/whale.glb). The whale
// BODY is re-skinned into the blueprint look (self-lit Docker colours + cyan
// edges). The model's own iconic blue containers are moved into a stable
// `containers` group and hidden (scale ~0) so the finale can reveal them with an
// epic pop — the "your image is built" payoff (the real Docker logo).
//
// Loads asynchronously; createWhale() returns synchronously with stable groups
// (`object`, `body`, `containers`) so scene wiring + the scroll timeline work
// regardless of load timing. Bob is applied to inner `body`; outer `object`
// position stays free; timeline animates `body.rotation.y` (spin) + `containers`.
export function createWhale() {
  const object = new THREE.Group()
  object.position.y = -1.2
  const body = new THREE.Group()
  object.add(body)
  const containers = new THREE.Group() // the model's own containers, revealed at the finale
  body.add(containers)

  const edgeMat = new THREE.LineBasicMaterial({
    color: '#38f5c9', transparent: true, opacity: 0.85,
  })

  // BASE_URL-prefixed so the asset resolves under GitHub Pages' /<repo>/ base
  new GLTFLoader().load(import.meta.env.BASE_URL + 'whale.glb', (gltf) => {
    const model = gltf.scene
    const toContainers = []

    model.traverse((o) => {
      if (!o.isMesh) return
      const m = o.material
      if (m && m.name === 'mat5') {
        // the model's own containers — self-lit Docker blue, revealed at finale
        m.emissive = m.color.clone().multiplyScalar(0.5)
        m.emissiveIntensity = 1
        m.metalness = 0.15
        m.roughness = 0.5
        toContainers.push(o)
        return
      }
      if (m && m.color) {
        m.emissive = m.color.clone().multiplyScalar(0.4)
        m.emissiveIntensity = 1
        m.metalness = 0.15
        m.roughness = 0.5
      }
      o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), edgeMat))
    })

    // Center + scale so the longest dimension ~= 6 units.
    const box = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3(); box.getSize(size)
    const center = new THREE.Vector3(); box.getCenter(center)
    const scale = 6 / Math.max(size.x, size.y, size.z)
    model.scale.setScalar(scale)
    model.position.copy(center).multiplyScalar(-scale)
    model.rotation.y = Math.PI / 2

    body.add(model)

    // Move the containers into the stable group (preserving world transform),
    // then hide them — the finale scales this group back up for the reveal.
    for (const o of toContainers) containers.attach(o)
    containers.scale.setScalar(0.0001)
  })

  function update(elapsed) {
    body.position.y = Math.sin(elapsed * 1.2) * 0.18
    body.rotation.z = Math.sin(elapsed * 0.8) * 0.03
  }

  return { object, body, containers, update }
}

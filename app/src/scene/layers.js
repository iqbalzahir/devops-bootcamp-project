import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { LAYERS } from '../dockerfile.js'

// The container is ~square; scale it UNIFORMLY (preserve its shape) to SIDE
// units, and stack with SPACING between layer centres. Sized + based to nestle
// on the whale's deck (where the model's own containers sit, world y ~0.4).
const SIDE = 0.7, GAP = 0.15
export const LAYER_SPACING = SIDE + GAP
export const LAYER_BASE_Y = -0.35

// Each Dockerfile instruction becomes one real Docker container (Quaternius,
// CC0 — public/container.glb), themed per stage and outlined in cyan. The slab
// interface is unchanged for the timeline/annotations: { mesh (group), mat,
// edgeMat, home }. Groups + materials are created synchronously; the container
// geometry is cloned in once the GLB loads (opacity is driven via the shared
// `mat`/`edgeMat`, so the scroll timeline works regardless of load timing).
export function createLayers() {
  const object = new THREE.Group()
  const slabs = []

  LAYERS.forEach((data, i) => {
    const isRuntime = data.stage === 'runtime'
    const mat = new THREE.MeshStandardMaterial({
      color: isRuntime ? '#0e6a72' : '#123a4a',
      emissive: '#0a5a6b', emissiveIntensity: 0.3,
      transparent: true, opacity: 0, metalness: 0.1, roughness: 0.6,
    })
    const edgeMat = new THREE.LineBasicMaterial({
      color: '#38f5c9', transparent: true, opacity: 0,
    })
    const mesh = new THREE.Group()
    const home = new THREE.Vector3(0, LAYER_BASE_Y + i * LAYER_SPACING, 0)
    mesh.position.copy(home).setY(home.y + 6) // start above; timeline drops it in
    object.add(mesh)
    // labelOn.v (0..1) toggles the annotation independently of container
    // visibility, so the build stack can stay on screen without its labels.
    slabs.push({ id: data.id, data, mesh, mat, edgeMat, home: home.clone(), labelOn: { v: 0 } })
  })

  // BASE_URL-prefixed so the asset resolves under GitHub Pages' /<repo>/ base
  new GLTFLoader().load(import.meta.env.BASE_URL + 'container.glb', (gltf) => {
    const proto = gltf.scene
    const box = new THREE.Box3().setFromObject(proto)
    const size = new THREE.Vector3(); box.getSize(size)
    const center = new THREE.Vector3(); box.getCenter(center)
    const u = SIDE / Math.max(size.x, size.y, size.z) // uniform → keep it square

    for (const s of slabs) {
      const clone = proto.clone(true)
      clone.scale.setScalar(u)
      clone.position.copy(center).multiplyScalar(-u)
      clone.traverse((o) => {
        if (!o.isMesh) return
        o.material = s.mat
        o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), s.edgeMat))
      })
      s.mesh.add(clone)
    }
  })

  return { object, slabs }
}

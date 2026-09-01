import * as THREE from 'three'

export function createCameraRig() {
  const camera = new THREE.PerspectiveCamera(
    50, window.innerWidth / window.innerHeight, 0.1, 200,
  )
  camera.position.set(0, 1.2, 13)
  const lookTarget = new THREE.Vector3(0, 0, 0)
  camera.lookAt(lookTarget)
  return { camera, lookTarget }
}

// Camera poses per beat (0..1 scroll). Timeline interpolates between these.
// Tuned for the taller stack of square containers riding on the whale.
export const CAMERA_KEYS = [
  { at: 0.00, pos: [0, 1.2, 13], look: [0, 0, 0] },    // hero (whale)
  { at: 0.30, pos: [5.5, 2.6, 13], look: [0, 1.4, 0] },// build stacking (orbit)
  { at: 0.52, pos: [-4.5, 2.6, 13], look: [0, 1.4, 0] }, // multi-stage cut
  { at: 0.70, pos: [4.5, 1.8, 11.5], look: [0, 1, 0] },// artifact travels
  { at: 0.82, pos: [0, 2.4, 15], look: [0, 1.4, 0] },  // exploded pull-back
  { at: 0.92, pos: [3, 1.6, 10], look: [0, 0.5, 0] },  // finale reveal (punch-in + orbit)
  { at: 1.00, pos: [0, 1.2, 13], look: [0, 0.4, 0] },  // recap
]

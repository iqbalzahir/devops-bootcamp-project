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

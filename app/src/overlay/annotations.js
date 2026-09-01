import * as THREE from 'three'
import { mdiPath } from '../icons.js'

const SVGNS = 'http://www.w3.org/2000/svg'
// Base sizes at desktop scale (+50% over the original blueprint scale). Every
// metric shrinks together on narrow viewports — see layout().
const FONT = 22, CHIP_H = 40, PAD = 14, ICON = 26, GAP = 11, MIN_GAP = 54
// Step-number badge: the container stack builds bottom-first, but a Dockerfile
// reads top-down, so each chip carries its 1-based command sequence number to
// make the true order explicit. Badges sit in one fixed column at the right
// edge of the screen; chips right-align against that column.
const BADGE_R = 13, NUM_FONT = 17, BADGE_GAP = 10
const EDGE = 28   // margin from the right screen edge to the badge column
const LEFT = 12   // minimum margin a chip may keep from the left screen edge
// Viewport width at (and above) which chips render at full size; below it they
// scale down proportionally, floored so text stays legible on phones.
const SCALE_REF = 1150, SCALE_MIN = 0.55

// Blueprint annotations: each visible layer slab gets a labelled chip near the
// right screen edge, joined to the slab by a leader line. Chips right-align
// (short commands stay clear of the busy 3D) and are de-collided vertically so
// stacked layers don't overlap. layout() re-derives all sizes whenever the
// viewport width changes, truncating any command that cannot fit beside the
// badge column (small portrait screens).
export function createAnnotations({ svgRoot, slabs, camera, renderer }) {
  const groups = slabs.map((s, i) => {
    const g = document.createElementNS(SVGNS, 'g')

    const line = document.createElementNS(SVGNS, 'line')
    line.setAttribute('stroke', '#38f5c9')
    line.setAttribute('stroke-width', '1.6')
    line.setAttribute('stroke-dasharray', '4 3')
    line.setAttribute('opacity', '0.8')

    const rect = document.createElementNS(SVGNS, 'rect')
    rect.setAttribute('rx', '6')
    rect.setAttribute('fill', '#050a12')
    rect.setAttribute('fill-opacity', '0.82')
    rect.setAttribute('stroke', '#1c6b78')
    rect.setAttribute('stroke-width', '1')

    // Step-number badge (slab index in Dockerfile order, 1-based).
    const badge = document.createElementNS(SVGNS, 'circle')
    badge.setAttribute('fill', '#38f5c9')
    const num = document.createElementNS(SVGNS, 'text')
    num.setAttribute('fill', '#050a12')
    num.setAttribute('font-family', 'ui-monospace, monospace')
    num.setAttribute('font-weight', '700')
    num.setAttribute('text-anchor', 'middle')
    num.setAttribute('dominant-baseline', 'central')
    num.textContent = `${i + 1}`

    const icon = document.createElementNS(SVGNS, 'svg')
    icon.setAttribute('viewBox', '0 0 24 24')
    const ipath = document.createElementNS(SVGNS, 'path')
    ipath.setAttribute('fill', '#38f5c9')
    ipath.setAttribute('d', mdiPath(s.data.icon))
    icon.append(ipath)

    const text = document.createElementNS(SVGNS, 'text')
    text.setAttribute('fill', '#d6fff5')
    text.setAttribute('font-family', 'ui-monospace, monospace')
    text.setAttribute('font-size', FONT)
    text.setAttribute('dominant-baseline', 'middle')
    const full = `${s.data.instruction} ${s.data.args}`
    text.textContent = full

    g.append(line, rect, badge, num, icon, text)
    svgRoot.append(g)

    // Monospace: per-character width measured once at the base font size, then
    // scaled linearly — avoids re-measuring hidden text on later layouts.
    const tw = text.getComputedTextLength() || full.length * FONT * 0.6
    const baseCharW = tw / full.length
    return { s, g, line, rect, badge, num, icon, text, full, baseCharW, chipW: 0, sx: 0, sy: 0, cy: 0 }
  })

  // Responsive layout: run on the first update and again whenever the viewport
  // width changes (resize / rotation).
  let lastW = 0
  let m = null // current metrics
  function layout(w) {
    lastW = w
    const k = Math.min(1, Math.max(SCALE_MIN, w / SCALE_REF))
    m = {
      font: FONT * k, chipH: CHIP_H * k, pad: PAD * k, icon: ICON * k,
      gap: GAP * k, minGap: MIN_GAP * k, badgeR: BADGE_R * k,
      numFont: NUM_FONT * k, badgeGap: BADGE_GAP * k,
    }
    const maxChipW = w - LEFT - (EDGE + 2 * m.badgeR + m.badgeGap)
    const maxTextW = maxChipW - (m.pad + m.icon + m.gap + m.pad)
    for (const o of groups) {
      o.text.setAttribute('font-size', m.font)
      o.num.setAttribute('font-size', m.numFont)
      o.rect.setAttribute('height', m.chipH)
      o.icon.setAttribute('width', m.icon)
      o.icon.setAttribute('height', m.icon)
      o.badge.setAttribute('r', m.badgeR)
      const charW = o.baseCharW * k
      let label = o.full
      if (label.length * charW > maxTextW) {
        label = label.slice(0, Math.max(4, Math.floor(maxTextW / charW) - 1)) + '…'
      }
      o.text.textContent = label
      o.chipW = m.pad + m.icon + m.gap + label.length * charW + m.pad
    }
  }

  const v = new THREE.Vector3()
  function update() {
    const w = renderer.domElement.clientWidth
    const h = renderer.domElement.clientHeight
    if (w !== lastW) layout(w)

    const badgeCx = w - EDGE - m.badgeR
    const chipRight = badgeCx - m.badgeR - m.badgeGap

    // Which labels are visible, and where their slab projects on screen.
    const vis = []
    for (const o of groups) {
      const on = o.s.labelOn.v > 0.5
      o.g.style.display = on ? '' : 'none'
      if (!on) continue
      o.s.mesh.getWorldPosition(v).project(camera)
      o.sx = (v.x * 0.5 + 0.5) * w
      o.sy = (-v.y * 0.5 + 0.5) * h
      vis.push(o)
    }

    // De-collide: sort by projected y, enforce a minimum vertical gap.
    vis.sort((a, b) => a.sy - b.sy)
    let prevY = -Infinity
    for (const o of vis) {
      o.cy = o.sy < prevY + m.minGap ? prevY + m.minGap : o.sy
      prevY = o.cy
    }

    for (const o of vis) {
      const cy = o.cy
      const x = chipRight - o.chipW
      o.rect.setAttribute('x', x)
      o.rect.setAttribute('y', cy - m.chipH / 2)
      o.rect.setAttribute('width', o.chipW)
      o.icon.setAttribute('x', x + m.pad)
      o.icon.setAttribute('y', cy - m.icon / 2)
      o.text.setAttribute('x', x + m.pad + m.icon + m.gap)
      o.text.setAttribute('y', cy)
      o.badge.setAttribute('cx', badgeCx)
      o.badge.setAttribute('cy', cy)
      o.num.setAttribute('x', badgeCx)
      o.num.setAttribute('y', cy)
      o.line.setAttribute('x1', o.sx)
      o.line.setAttribute('y1', o.sy)
      o.line.setAttribute('x2', x - 4)
      o.line.setAttribute('y2', cy)
    }
  }

  return { update }
}

// Pure scroll-sync trigger logic — no Web Audio, fully unit-testable.

// Which one-shot cues fire this frame. Forward-only: scrolling up or standing
// still is silent. Multiple 'tick' cues crossed in one frame (fast scrub)
// collapse to a single tick so it never machine-guns. The prev < at <= curr test
// re-arms a cue automatically once the user scrolls back below it.
//
// cues: [{ id, at, kind }]   kind ∈ 'tick' | 'cut' | 'riser'
// No jitter-epsilon on the prev < at <= curr test: onScroll({ sync: 0.15 }) in
// timeline.js already smooths the playhead into a monotonic-forward progress,
// so boundaries can't oscillate frame-to-frame and re-fire spuriously.
export function crossedForward(prev, curr, cues) {
  if (curr <= prev) return []
  const out = []
  let tickTaken = false
  for (const c of cues) {
    if (!(prev < c.at && c.at <= curr)) continue
    if (c.kind === 'tick') {
      if (tickTaken) continue
      tickTaken = true
    }
    out.push({ id: c.id, kind: c.kind })
  }
  return out
}

// Shaped ambient-bed intensity (0..1) for a scroll progress (0..1): a gentle
// rise through the build with an extra swell into the finale.
export function bedCurve(progress) {
  if (progress >= 1) return 1
  const p = clamp01(progress)
  return clamp01(0.3 + 0.35 * p + 0.35 * smoothstep(0.85, 0.95, p))
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x }
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

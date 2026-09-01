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

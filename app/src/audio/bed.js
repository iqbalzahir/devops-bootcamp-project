// Ambient underwater drone: a few detuned low sine oscillators through a lowpass
// with a slow LFO on the cutoff, sent dry + into the shared reverb. Scroll drives
// gain + brightness via setIntensity().
export function createBed({ ctx, master, reverb }) {
  const out = ctx.createGain()
  out.gain.value = 0.0001
  out.connect(master)
  out.connect(reverb)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 260
  filter.Q.value = 6
  filter.connect(out)

  const freqs = [55, 55.4, 82.5] // A1 + slight detune + a fifth-ish partial
  const oscs = []
  let lfo = null

  function start() {
    for (const f of freqs) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.5
      o.connect(g).connect(filter)
      o.start()
      oscs.push(o)
    }
    lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 120
    lfo.connect(lfoGain).connect(filter.frequency) // modulates cutoff around its set value
    lfo.start()
  }

  // x in 0..1 → smoothly-ramped gain + lowpass cutoff. Kept as a faint sub-
  // undercurrent beneath the real ambient track (music.js), so the two low ends
  // don't clash; it still swells subtly with scroll.
  function setIntensity(x) {
    const t = ctx.currentTime
    out.gain.setTargetAtTime(0.006 + 0.04 * x, t, 0.3)
    filter.frequency.setTargetAtTime(220 + 900 * x, t, 0.3)
  }

  function stop() {
    for (const o of oscs) o.stop()
    if (lfo) lfo.stop()
  }

  return { start, setIntensity, stop }
}

// Three synthesized one-shots. Each builds a short, self-contained voice at the
// current time, connects dry (master) + wet (reverb), and auto-stops after its
// tail. exponentialRamp targets stay > 0 (Web Audio requirement).
export function createSfx({ ctx, master, reverb }) {
  // pitched oscillator with an attack/decay envelope
  function voice({ type = 'sine', from, to, dur, peak, sweepDur, wet = 0.25 }) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    if (to != null) o.frequency.exponentialRampToValueAtTime(to, t + (sweepDur || dur))
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master)
    const w = ctx.createGain(); w.gain.value = wet
    g.connect(w); w.connect(reverb)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  // short filtered noise burst (for the cut swoosh)
  function noiseBurst({ dur, peak, cutoff, wet = 0.3 }) {
    const t = ctx.currentTime
    const len = Math.floor(dur * ctx.sampleRate)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource(); src.buffer = buf
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = cutoff; f.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g); g.connect(master)
    const w = ctx.createGain(); w.gain.value = wet
    g.connect(w); w.connect(reverb)
    src.start(t); src.stop(t + dur)
  }

  // crisp rising HUD blip on a layer drop
  function tick() {
    voice({ type: 'triangle', from: 660, to: 1320, dur: 0.14, peak: 0.14, sweepDur: 0.09, wet: 0.2 })
  }

  // multi-stage cut: filtered swoosh + descending low thunk
  function cut() {
    noiseBurst({ dur: 0.35, peak: 0.12, cutoff: 900, wet: 0.4 })
    voice({ type: 'sine', from: 180, to: 70, dur: 0.4, peak: 0.18, sweepDur: 0.35, wet: 0.3 })
  }

  // finale reveal: upward sweep + sub-boom + bright shimmer
  function riser() {
    voice({ type: 'sawtooth', from: 120, to: 900, dur: 1.2, peak: 0.16, sweepDur: 1.0, wet: 0.5 })
    voice({ type: 'sine', from: 48, to: 40, dur: 1.4, peak: 0.28, sweepDur: 1.2, wet: 0.3 })
    voice({ type: 'sine', from: 1200, to: 2400, dur: 0.9, peak: 0.06, sweepDur: 0.7, wet: 0.6 })
  }

  return { tick, cut, riser }
}

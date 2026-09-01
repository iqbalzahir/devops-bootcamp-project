// The single Web Audio context: a master gain (the mute gate → destination) and
// a runtime-synthesized reverb (no impulse file). Voices connect to `master`
// (dry) and/or `reverb` (wet). Context starts suspended; resume() must run inside
// a user gesture to satisfy the browser autoplay policy.
export function createAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()

  const master = ctx.createGain()
  master.gain.value = 0 // silent until enable() ramps it up
  master.connect(ctx.destination)

  // Reverb: a short exponentially-decaying stereo noise impulse, rendered once.
  const reverb = ctx.createConvolver()
  reverb.buffer = makeImpulse(ctx, 1.8, 2.6)
  const wet = ctx.createGain()
  wet.gain.value = 0.5
  reverb.connect(wet).connect(master)

  return { ctx, master, reverb, resume: () => ctx.resume() }
}

function makeImpulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate
  const len = Math.floor(seconds * rate)
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

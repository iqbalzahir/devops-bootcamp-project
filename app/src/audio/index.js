import { createAudioContext } from './context.js'
import { createBed } from './bed.js'
import { createSfx } from './sfx.js'
import { createMusic } from './music.js'
import { crossedForward, bedCurve } from './triggers.js'
import { AUDIO_CUES } from '../beats.js'

// Owns the audio lifecycle and the per-frame scroll → sound mapping. DOM-free;
// main.js supplies the UI and calls update() each frame with the timeline
// playhead (master.progress, 0..1).
export function createAudio({ musicUrl } = {}) {
  let bundle = null  // { ctx, master, reverb }
  let bed = null
  let sfx = null
  let music = null
  let enabled = false
  let enabling = false // synchronous re-entrancy guard: blocks a second call while the
                        // first is still awaiting bundle.resume(), before `enabled` flips
  let muted = false
  let prev = 0

  async function enable() {
    if (enabled || enabling) return
    enabling = true
    try {
      bundle = createAudioContext()
      bed = createBed(bundle)
      sfx = createSfx(bundle)
      if (musicUrl) music = createMusic(bundle, musicUrl)
      await bundle.resume()
      bed.start()
      if (music) music.start()
      bundle.master.gain.setTargetAtTime(0.9, bundle.ctx.currentTime, 0.4)
      enabled = true
    } finally {
      enabling = false
    }
  }

  function toggleMute() {
    if (!enabled) return muted
    muted = !muted
    bundle.master.gain.setTargetAtTime(muted ? 0 : 0.9, bundle.ctx.currentTime, 0.2)
    return muted
  }

  function update(progress) {
    const p = Number.isFinite(progress) ? progress : 0
    if (enabled && !muted) {
      bed.setIntensity(bedCurve(p))
      for (const { kind } of crossedForward(prev, p, AUDIO_CUES)) {
        if (kind === 'tick') sfx.tick()
        else if (kind === 'cut') sfx.cut()
        else if (kind === 'riser') sfx.riser()
      }
    }
    prev = p // always advance, so enabling mid-scroll doesn't replay past cues
  }

  return {
    get enabled() { return enabled },
    get muted() { return muted },
    enable,
    toggleMute,
    update,
  }
}

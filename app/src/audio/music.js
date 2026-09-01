// Looping ambient background track, routed through the shared master gain so the
// existing enable/mute controls it alongside the synth bed + SFX. Uses a detached
// <audio> element (never attached to the DOM) via a MediaElementSource, kept low
// in the mix and faded in on enable. Import-safe in jsdom (no `Audio` / Web Audio
// at module load — only inside createMusic); real playback is covered by e2e.
export function createMusic({ ctx, master }, url) {
  const el = new Audio(url)
  el.loop = true
  el.preload = 'auto'

  const gain = ctx.createGain()
  gain.gain.value = 0.0001
  ctx.createMediaElementSource(el).connect(gain).connect(master)

  function start() {
    gain.gain.setTargetAtTime(0.28, ctx.currentTime, 2) // gentle fade to a low bg level
    const p = el.play()
    // enable() runs inside a user gesture, so this is allowed; swallow any stray
    // autoplay/decoding rejection so a missing/blocked track never breaks enable().
    if (p && p.catch) p.catch(() => {})
  }

  function stop() {
    el.pause()
  }

  return { start, stop }
}

export function createPcmPlayer(sampleRate = 48000) {
  let ctx = null
  let nextTime = 0

  const push = (int16) => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      ctx.resume().catch(() => {})
      nextTime = ctx.currentTime + 0.05
    }
    const f32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768
    const buf = ctx.createBuffer(1, f32.length, sampleRate)
    buf.getChannelData(0).set(f32)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    const when = Math.max(ctx.currentTime + 0.02, nextTime)
    src.start(when)
    nextTime = when + buf.duration
  }

  const stop = () => {
    if (ctx) {
      ctx.close().catch(() => {})
      ctx = null
    }
  }

  return { push, stop }
}

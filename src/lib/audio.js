export async function startCapture({ onPcmFrame }) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const ctx = new AudioContext()
  await ctx.audioWorklet.addModule('/audio-processor.js')
  const source = ctx.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(ctx, 'pcm-processor')
  node.port.onmessage = (event) => onPcmFrame(event.data)
  source.connect(node)
  return {
    stop: async () => {
      try {
        node.port.postMessage({ type: 'stop' })
        node.disconnect()
        source.disconnect()
      } catch {
        /* already stopped */
      }
      stream.getTracks().forEach((track) => track.stop())
      try {
        await ctx.close()
      } catch {
        /* context already closed */
      }
    },
  }
}

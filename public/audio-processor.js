class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.chunkSize = Math.round(sampleRate * 0.1)
    this.samples = []
    this.running = true
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === 'stop') this.running = false
    }
  }

  process(inputs) {
    if (!this.running) return false
    const input = inputs[0]
    if (input && input[0]) {
      const channel = input[0]
      for (let i = 0; i < channel.length; i++) {
        const value = channel[i]
        this.samples.push(Math.max(-1, Math.min(1, value)) * 32767)
      }
      while (this.samples.length >= this.chunkSize) {
        const chunk = new Int16Array(this.chunkSize)
        for (let i = 0; i < this.chunkSize; i++) chunk[i] = this.samples[i]
        this.samples.splice(0, this.chunkSize)
        this.port.postMessage(chunk.buffer, [chunk.buffer])
      }
    }
    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)

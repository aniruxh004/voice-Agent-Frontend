const API_URL = import.meta.env.VITE_API_URL || location.origin
const proto = API_URL.includes('https') ? 'wss' : 'ws'
const host = new URL(API_URL).host

export function connectAudio({ onOpen, onPartial, onFinal, onAnswer, onAudioChunk, onError, onClose }) {
  const ws = new WebSocket(`${proto}://${host}/ws/audio`)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => onOpen?.(ws)

  ws.onmessage = (event) => {
    if (typeof event.data !== 'string') {
      onAudioChunk?.(new Int16Array(event.data))
      return
    }
    let msg
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    switch (msg.type) {
      case 'partial':
        onPartial?.(msg.text ?? '')
        break
      case 'final':
        onFinal?.(msg.text ?? '')
        break
      case 'answer':
        onAnswer?.(msg.data ?? {})
        break
      case 'error':
        onError?.(msg.message ?? 'Unknown error')
        break
      default:
        break
    }
  }

  ws.onerror = () => onError?.('Connection to the voice service failed.')
  ws.onclose = () => onClose?.()

  return ws
}
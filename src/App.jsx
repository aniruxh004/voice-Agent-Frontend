import { useEffect, useRef, useState } from 'react'

import { askQuestion } from './lib/api.js'
import { startCapture } from './lib/audio.js'
import { connectAudio } from './lib/realtime.js'
import { createPcmPlayer } from './lib/playback.js'
import { MessageBubble } from './components/MessageBubble.jsx' 



const STATUS = { IDLE: 'idle', CONNECTING: 'connecting', LISTENING: 'listening', PROCESSING: 'processing' }

function TypingIndicator() {
  return (
    <div className="bubble assistant typing">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [interim, setInterim] = useState('')
  const [status, setStatus] = useState(STATUS.IDLE)
  const [micSupported] = useState(() => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia))
  const [micError, setMicError] = useState(null)
  
  const sessionIdRef = useRef(crypto.randomUUID())
  const wsRef = useRef(null)
  const captureRef = useRef(null)
  const messagesRef = useRef(null)
  const inputRef = useRef(null)
  const playerRef = useRef(null)
  const pendingAnswerRef = useRef(null)
  const pendingTimerRef = useRef(null)

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, interim, status])

  const cleanupVoice = () => {
    captureRef.current?.stop()
    captureRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    playerRef.current?.stop()
    playerRef.current = null
    clearTimeout(pendingTimerRef.current)
    pendingAnswerRef.current = null
    setInterim('')
    setStatus(STATUS.IDLE)
  }

  const renderAnswer = () => {
    const data = pendingAnswerRef.current
    if (!data) return
    pendingAnswerRef.current = null
    clearTimeout(pendingTimerRef.current)
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: data.answer ?? data.message ?? 'No answer returned.',
        citations: data.citations ?? [],
        source: data.source ?? 'backend',
      },
    ])
    setStatus(STATUS.IDLE)
  }

  const stopMicCapture = () => {
    captureRef.current?.stop()
    captureRef.current = null
  }

  const startVoice = () => {
    setMicError(null)
    setStatus(STATUS.CONNECTING)
    const ws = connectAudio({
      onOpen: async () => {
        setStatus(STATUS.LISTENING)
        ws.send(JSON.stringify({ type: 'start', sampleRate: 48000, sessionId: sessionIdRef.current }))
        try {
          const capture = await startCapture({
            onPcmFrame: (buffer) => ws.send(buffer),
          })
          captureRef.current = capture
        } catch (err) {
          const message =
            err.name === 'NotAllowedError'
              ? 'Microphone access denied. Enable it in your browser settings to use voice input.'
              : `Could not start the microphone: ${err.message}`
          setMicError(message)
          try {
            ws.send(JSON.stringify({ type: 'end' }))
          } catch {
            /* socket closed */
          }
          ws.close()
          wsRef.current = null
          setStatus(STATUS.IDLE)
        }
      },
      onPartial: setInterim,
      onAudioChunk: (chunk) => {
        const player = (playerRef.current ??= createPcmPlayer())
        player.push(chunk)
        if (pendingAnswerRef.current) renderAnswer()
      },
      onFinal: (text) => {
        const question = text.trim()
        if (!question) {
          cleanupVoice()
          return
        }
        stopMicCapture()
        setInterim('')
        setMessages((prev) => [...prev, { role: 'user', text: question }])
        setStatus(STATUS.PROCESSING)
      },
      onAnswer: (data) => {
        pendingAnswerRef.current = data
        pendingTimerRef.current = setTimeout(renderAnswer, 10000)
      },
      onError: (message) => {
        setMicError(message)
        cleanupVoice()
      },
      onClose: () => {
        if (wsRef.current === ws) wsRef.current = null
        if (pendingAnswerRef.current) {
          renderAnswer()
          return
        }
        if (status === STATUS.LISTENING || status === STATUS.CONNECTING) {
          stopMicCapture()
          setStatus(STATUS.IDLE)
        } else if (status === STATUS.PROCESSING) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: 'The connection closed before an answer arrived. Try again.',
              source: 'offline',
            },
          ])
          setStatus(STATUS.IDLE)
        }
      },
    })
    wsRef.current = ws
  }

  const toggleMic = () => {
    if (status === STATUS.PROCESSING) return
    if (status === STATUS.LISTENING || status === STATUS.CONNECTING) {
      stopMicCapture()
      wsRef.current?.send(JSON.stringify({ type: 'end' }))
      setInterim('')
      setStatus(STATUS.PROCESSING)
      return
    }
    startVoice()
  }

  const send = async (question) => {
    const q = (question ?? input).trim()
    if (!q || status === STATUS.PROCESSING) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setStatus(STATUS.PROCESSING)
    try {
      const data = await askQuestion(q)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer ?? data.message ?? 'No answer returned.',
          citations: data.citations ?? [],
          source: data.source ?? 'backend',
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: "Couldn't reach the assistant backend. The pipeline isn't wired up yet — start the FastAPI server and add the /ask endpoint to see answers here.",
          source: 'offline',
        },
      ])
    } finally {
      setStatus(STATUS.IDLE)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const listening = status === STATUS.LISTENING

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">AC</span>
          <div>
            <h1>AcmeCRM Voice Assistant</h1>
            <p className="subtitle">Ask about billing, security, API limits and more</p>
          </div>
        </div>
        <span className={`status-pill ${status}`}>
          {status === STATUS.CONNECTING && 'Connecting...'}
          {status === STATUS.LISTENING && 'Listening...'}
          {status === STATUS.PROCESSING && 'Thinking...'}
          {status === STATUS.IDLE && 'Ready'}
        </span>
      </header>

      <main className="chat" ref={messagesRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🎙️</div>
            <p>Press the mic and ask a question, or type one below.</p>
            <p className="empty-hints">
              e.g. “What is the default API rate limit?” · “How do I reset my password?”
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {interim && (
          <div className="bubble user interim">
            <div className="bubble-body">
              {interim}
              <span className="caret" />
            </div>
          </div>
        )}
        {status === STATUS.PROCESSING && <TypingIndicator />}
      </main>

      <footer className="input-bar">
        {micError && <div className="mic-error">{micError}</div>}
        <div className="input-row">
          {micSupported ? (
            <button
              className={`mic-btn ${listening ? 'active' : ''}`}
              onClick={toggleMic}
              title={listening ? 'Stop listening' : 'Ask by voice'}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
              </svg>
            </button>
          ) : (
            <button className="mic-btn disabled" disabled title="Voice input needs a browser with microphone support">
              🚫
            </button>
          )}
          <textarea
            ref={inputRef}
            className="question-input"
            rows={1}
            placeholder={listening ? 'Listening… speak now' : 'Ask a question…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            className="send-btn"
            onClick={() => send()}
            disabled={!input.trim() || status === STATUS.PROCESSING}
            title="Send question"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3.4 20.4 20.85 12 3.4 3.6 3.39 10.2 15 12 3.39 13.8 3.4 20.4Z" />
            </svg>
          </button>
        </div>
        <p className="input-note">
          {listening ? 'Speak your question — it will be sent automatically' : 'Tip: use the mic for voice questions'}
        </p>
      </footer>
    </div>
  )
}

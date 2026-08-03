import { speak, stopSpeaking } from "../lib/speech"
import { useState } from "react"


export function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const [speaking, setSpeaking] = useState(false)

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
    } else {
      speak(message.text, { onEnd: () => setSpeaking(false) })
      setSpeaking(true)
    }
  }

  return (
    <div className={`bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="bubble-body">{message.text}</div>
      {!isUser && message.citations?.length > 0 && (
        <div className="citations">
          {message.citations.map((c, i) => (
            <span className="citation" key={i} title={`${c.section} (page ${c.page})`}>
           {c.doc_id} · {c.section}
            </span>
          ))}
        </div>
      )}
      {!isUser && message.source && (
        <div className="bubble-footer">
          <button className="speak-btn" onClick={toggleSpeak}>
            {speaking ? 'Stop' : 'Listen'}
          </button>
          <span className="source-tag">{message.source}</span>
        </div>
      )}
    </div>
  )
}

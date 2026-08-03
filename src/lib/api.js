const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? '').replace(/\/$/, '')
const BASE = `${import.meta.env.VITE_API_URL}/ask`

export async function askQuestion(question) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Backend error ${res.status}: ${detail}`)
  }
  return res.json()
}



import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { ChatMessage } from '../types'
import { pickVoice, speak, stopSpeaking, useListen } from '../useVoice'

/**
 * Public, full-screen voice call page. Visit /talk?to=<id>&name=<n>&phone=<p>
 * to skip the dashboard and go straight into a voice chat with Anya.
 * Each turn is persisted to calls.db via session_id so it shows up in the
 * Calls tab on the dashboard.
 */
export default function Talk() {
  const [sp] = useSearchParams()
  const name = sp.get('name') || 'there'
  const contactId = sp.get('to') || ''
  const phone = sp.get('phone') || ''
  const sessionId = useMemo(() => {
    const stored = sessionStorage.getItem('talk-session')
    if (stored) return stored
    const s = `talk-${crypto.randomUUID().slice(0, 12)}`
    sessionStorage.setItem('talk-session', s)
    return s
  }, [])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [ended, setEnded] = useState(false)
  const activeRef = useRef(false)

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const update = () => setVoice(pickVoice())
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  const callAgent = async (next: ChatMessage[]) => {
    setBusy(true); setError(null)
    try {
      const r = await api.chatSession(next, {
        student_name: name,
        session_id: sessionId,
        contact_id: contactId,
        phone,
      })
      const newMessages: ChatMessage[] = [...next, { role: 'assistant', content: r.say }]
      setMessages(newMessages)
      if (r.say) {
        setSpeaking(true)
        await speak(r.say, voice)
        setSpeaking(false)
        if (r.end_call) {
          activeRef.current = false
          setEnded(true)
        } else if (activeRef.current) {
          startListening()
        }
      }
    } catch (e: any) {
      setError(e.message)
      setSpeaking(false)
    } finally { setBusy(false) }
  }

  const { start: startListening, stop: stopListening, listening, interim } = useListen({
    onResult: (text) => {
      const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
      setMessages(next)
      callAgent(next)
    },
    onError: (err) => setError(err),
  })

  const begin = async () => {
    activeRef.current = true
    await callAgent([])
  }

  const hangUp = () => {
    activeRef.current = false
    stopListening()
    stopSpeaking()
    setSpeaking(false)
    setEnded(true)
  }

  const lastAgent = [...messages].reverse().find(m => m.role === 'assistant')

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 safe-pt safe-pb">
      <header className="px-6 pt-8 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-700 text-3xl shadow-lg">
          🎓
        </div>
        <h1 className="mt-3 text-xl font-semibold">Anya · IITM Admissions</h1>
        <p className="text-xs text-slate-400">{name && name !== 'there' ? `Hi ${name} ·` : ''} live voice call</p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        {!activeRef.current && messages.length === 0 && !ended ? (
          <div className="text-center">
            <p className="mb-6 text-sm text-slate-300">
              Tap the call button below to start a quick voice chat with Anya.
              She'll ask if you want to take admission in BCA at IITM and answer your questions.
            </p>
            <button
              onClick={begin}
              disabled={busy}
              className="grid h-32 w-32 place-items-center rounded-full bg-emerald-600 text-5xl shadow-2xl transition hover:bg-emerald-700 disabled:opacity-50"
              aria-label="Start call"
            >📞</button>
            <p className="mt-3 text-[11px] text-slate-500">Your browser may ask for microphone permission — allow it.</p>
          </div>
        ) : ended ? (
          <div className="text-center">
            <div className="mb-3 text-5xl">📴</div>
            <h2 className="text-lg font-semibold">Call ended</h2>
            <p className="mt-1 text-sm text-slate-400">Thanks for talking with Anya.</p>
            <button
              onClick={() => { setEnded(false); setMessages([]); sessionStorage.removeItem('talk-session'); begin() }}
              className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium"
            >Call again</button>
          </div>
        ) : (
          <>
            <button
              onClick={() => { if (listening) stopListening(); else if (speaking) { stopSpeaking(); setSpeaking(false) } else startListening() }}
              disabled={busy && !listening && !speaking}
              className={`grid h-44 w-44 place-items-center rounded-full text-7xl shadow-2xl transition disabled:opacity-50 ${
                listening ? 'bg-red-600 animate-pulse'
                : speaking ? 'bg-amber-500 animate-pulse'
                : 'bg-brand-600 hover:bg-brand-700'
              }`}
              aria-label="Talk"
            >{listening ? '⏹️' : speaking ? '🔊' : '🎙️'}</button>
            <div className="mt-5 min-h-6 text-center text-sm text-slate-300">
              {listening && (interim ? <span className="italic text-slate-100">"{interim}"</span> : 'Listening…')}
              {speaking && 'Anya is speaking…'}
              {busy && !listening && !speaking && 'Anya is thinking…'}
              {!listening && !speaking && !busy && 'Tap to talk'}
            </div>
            {lastAgent && (
              <div className="mt-4 max-w-md rounded-xl bg-brand-900/30 px-4 py-2 text-center text-sm italic text-slate-200">
                "{lastAgent.content}"
              </div>
            )}
            {error && <div className="mt-3 text-xs text-red-300">{error}</div>}
            <button onClick={hangUp} className="mt-8 rounded-full bg-red-600 px-5 py-2 text-sm font-medium">
              End call
            </button>
          </>
        )}
      </main>

      <footer className="pb-3 text-center text-[10px] text-slate-600">
        © Rohit Jangra · SiksaSarovar
      </footer>
    </div>
  )
}

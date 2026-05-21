import { FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { ChatMessage, Health } from '../types'
import { Badge, Button, Card, H1, Input } from '../components/ui'
import { isSpeechSupported, pickVoice, speak, stopSpeaking, useListen } from '../useVoice'

type Mode = 'text' | 'voice'

export default function Chat() {
  const [studentName, setStudentName] = useState('Riya')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [mode, setMode] = useState<Mode>('text')
  const [autoLoop, setAutoLoop] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  const support = isSpeechSupported()
  const endRef = useRef<HTMLDivElement>(null)
  const callActiveRef = useRef(false)

  useEffect(() => { api.health().then(setHealth).catch(() => {}) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  // Voices load asynchronously on most browsers
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const update = () => setVoice(pickVoice())
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  const sendToAgent = async (next: ChatMessage[]) => {
    setBusy(true); setError(null)
    try {
      const r = await api.chat(next, studentName)
      const newMessages: ChatMessage[] = [...next, { role: 'assistant', content: r.say }]
      setMessages(newMessages)
      if (mode === 'voice' && r.say) {
        setSpeaking(true)
        await speak(r.say, voice)
        setSpeaking(false)
        if (r.end_call) {
          callActiveRef.current = false
        } else if (autoLoop && callActiveRef.current) {
          startListening()
        }
      }
      if (r.end_call) {
        setMessages(m => [...m, { role: 'assistant', content: `— ended (${r.sentiment}) —` }])
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
      sendToAgent(next)
    },
    onError: (err) => setError(err),
  })

  const openCall = async () => {
    if (messages.length > 0) return
    callActiveRef.current = true
    setBusy(true); setError(null)
    try {
      const r = await api.chat([], studentName)
      setMessages([{ role: 'assistant', content: r.say }])
      if (mode === 'voice' && r.say) {
        setSpeaking(true)
        await speak(r.say, voice)
        setSpeaking(false)
        if (autoLoop && callActiveRef.current) startListening()
      }
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  const sendText = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    await sendToAgent(next)
  }

  const reset = () => {
    callActiveRef.current = false
    stopListening()
    stopSpeaking()
    setMessages([]); setError(null); setInput(''); setSpeaking(false)
  }

  const onMicPress = () => {
    if (listening) { stopListening(); return }
    if (speaking) { stopSpeaking(); setSpeaking(false) }
    if (messages.length === 0) { openCall(); return }
    startListening()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <H1>Agent</H1>
        {health?.agent && (
          <Badge tone={health.agent.backend === 'ollama' ? 'green' : 'blue'}>
            {health.agent.backend === 'ollama' ? `Ollama · ${health.agent.model}` : `Claude · ${health.agent.model}`}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('text')}
          className={`rounded-lg py-2 text-sm font-medium transition ${mode === 'text' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-300'}`}
        >💬 Text</button>
        <button
          onClick={() => setMode('voice')}
          disabled={!support.listen}
          className={`rounded-lg py-2 text-sm font-medium transition ${mode === 'voice' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-300'} disabled:opacity-50`}
          title={support.listen ? '' : 'Speech recognition not supported on this browser'}
        >🎙️ Voice</button>
      </div>

      <Card className="!p-3">
        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap text-xs text-slate-400">Student</label>
          <Input value={studentName} onChange={e => setStudentName(e.target.value)} className="flex-1" />
          {messages.length === 0
            ? <Button onClick={openCall} disabled={busy}>Start</Button>
            : <Button variant="ghost" onClick={reset}>Reset</Button>}
        </div>
        {mode === 'voice' && (
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={autoLoop} onChange={e => setAutoLoop(e.target.checked)} />
            Auto-listen after the agent finishes speaking (continuous call mode)
          </label>
        )}
      </Card>

      {error && <Card className="border-red-700/60 bg-red-900/20 text-sm text-red-200">{error}</Card>}

      {mode === 'voice' && (
        <Card className="!p-3">
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              onClick={onMicPress}
              disabled={busy && !listening && !speaking}
              className={`grid h-28 w-28 place-items-center rounded-full text-4xl shadow-lg transition disabled:opacity-50 ${
                listening
                  ? 'bg-red-600 animate-pulse'
                  : speaking
                  ? 'bg-amber-500'
                  : 'bg-brand-600 hover:bg-brand-700'
              }`}
              aria-label={listening ? 'Stop listening' : speaking ? 'Stop speaking' : 'Talk'}
            >
              {listening ? '⏹️' : speaking ? '🔊' : '🎙️'}
            </button>
            <div className="text-center text-xs text-slate-400">
              {listening && (interim ? <span className="italic text-slate-200">"{interim}"</span> : 'listening…')}
              {speaking && 'agent speaking…'}
              {busy && !listening && !speaking && 'agent thinking…'}
              {!listening && !speaking && !busy && (messages.length === 0
                ? 'Tap mic to start — student-side of the call'
                : 'Tap mic to reply')}
            </div>
            {voice && <div className="text-[10px] text-slate-500">voice: {voice.name} ({voice.lang})</div>}
          </div>
        </Card>
      )}

      <div className="space-y-2 pb-2">
        {messages.length === 0 && !busy && mode === 'text' && (
          <Card className="text-sm text-slate-400">
            Tap <span className="font-medium text-slate-200">Start</span> to have the agent open with its greeting,
            then chat as if you were the student.
          </Card>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl p-3 text-sm ${
              m.role === 'assistant'
                ? 'border border-brand-700/40 bg-brand-900/30'
                : 'border border-slate-800 bg-slate-900'
            }`}
          >
            <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-500">
              {m.role === 'assistant' ? 'Anya' : 'You (as student)'}
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="rounded-xl border border-brand-700/40 bg-brand-900/20 p-3 text-sm text-slate-400">
            Anya is typing…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {mode === 'text' && (
        <form onSubmit={sendText} className="sticky bottom-16 flex gap-2 rounded-xl bg-slate-950/95 p-2 backdrop-blur">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={messages.length === 0 ? 'Press Start first' : 'Your reply as the student'}
            disabled={busy || messages.length === 0}
          />
          <Button type="submit" disabled={busy || !input.trim() || messages.length === 0}>Send</Button>
        </form>
      )}
    </div>
  )
}

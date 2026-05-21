import { FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { ChatMessage, Health } from '../types'
import { Badge, Button, Card, H1, Input } from '../components/ui'

export default function Chat() {
  const [studentName, setStudentName] = useState('Riya')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { api.health().then(setHealth).catch(() => {}) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  const openCall = async () => {
    if (messages.length > 0) return
    setBusy(true); setError(null)
    try {
      const r = await api.chat([], studentName)
      setMessages([{ role: 'assistant', content: r.say }])
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true); setError(null)
    try {
      const r = await api.chat(next, studentName)
      setMessages([...next, { role: 'assistant', content: r.say }])
      if (r.end_call) {
        setMessages(m => [...m, { role: 'assistant', content: `— call ended (${r.sentiment}) —` }])
      }
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  const reset = () => { setMessages([]); setError(null); setInput('') }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <H1>Chat with Agent</H1>
        {health?.agent && (
          <Badge tone={health.agent.backend === 'ollama' ? 'green' : 'blue'}>
            {health.agent.backend === 'ollama' ? `Ollama · ${health.agent.model}` : `Claude · ${health.agent.model}`}
          </Badge>
        )}
      </div>

      <Card className="!p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Student name</label>
          <Input value={studentName} onChange={e => setStudentName(e.target.value)} className="flex-1" />
          {messages.length === 0
            ? <Button onClick={openCall} disabled={busy}>Start</Button>
            : <Button variant="ghost" onClick={reset}>Reset</Button>}
        </div>
      </Card>

      {error && <Card className="border-red-700/60 bg-red-900/20 text-sm text-red-200">{error}</Card>}

      <div className="space-y-2 pb-2">
        {messages.length === 0 && !busy && (
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

      <form onSubmit={send} className="sticky bottom-16 flex gap-2 rounded-xl bg-slate-950/95 p-2 backdrop-blur">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={messages.length === 0 ? 'Press Start first' : 'Your reply as the student'}
          disabled={busy || messages.length === 0}
        />
        <Button type="submit" disabled={busy || !input.trim() || messages.length === 0}>Send</Button>
      </form>
    </div>
  )
}

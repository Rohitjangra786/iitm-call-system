import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { CallRow, TranscriptTurn } from '../types'
import { Badge, Card, H1 } from '../components/ui'

export default function CallDetail() {
  const { sid = '' } = useParams()
  const [call, setCall] = useState<CallRow | null>(null)
  const [turns, setTurns] = useState<TranscriptTurn[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const r = await api.call(sid)
      setCall(r.call)
      setTurns(r.transcript)
    } catch (e: any) { setError(e.message) }
  }

  useEffect(() => {
    load()
    // Poll while call is live
    const t = setInterval(() => {
      if (call?.status === 'in-progress') load()
    }, 2500)
    return () => clearInterval(t)
  }, [sid, call?.status])

  if (error) return <div className="text-sm text-red-400">{error}</div>
  if (!call) return <div className="text-sm text-slate-400">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <H1>{call.name || 'Call'}</H1>
        <Link to="/calls" className="text-xs text-slate-400 hover:text-brand-400">← Back</Link>
      </div>

      <Card>
        <div className="flex items-center justify-between text-sm">
          <div>
            <div className="text-xs text-slate-400">{call.phone}</div>
            <div className="font-mono text-[10px] text-slate-500">{call.call_sid}</div>
          </div>
          <Badge tone={call.status === 'in-progress' ? 'blue' : call.remark === 'Interested' ? 'green' : call.remark === 'Not Interested' ? 'red' : 'slate'}>
            {call.remark || call.status}
          </Badge>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
          <div>Started: {call.started_at || '—'}</div>
          <div>Ended: {call.ended_at || '—'}</div>
        </div>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Transcript</h2>
        {turns.length === 0 ? (
          <div className="text-xs text-slate-500">No turns yet.</div>
        ) : (
          <div className="space-y-2">
            {turns.map(t => (
              <div
                key={t.turn_no}
                className={`rounded-xl p-3 text-sm ${
                  t.role === 'agent'
                    ? 'bg-brand-900/30 border border-brand-700/40'
                    : 'bg-slate-900 border border-slate-800'
                }`}
              >
                <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                  {t.role === 'agent' ? 'Anya (agent)' : 'Student'} · {t.created_at?.slice(11, 19)}
                </div>
                <div>{t.text}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

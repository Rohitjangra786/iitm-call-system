import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useStream } from '../useStream'
import { Badge, Card, Empty, H1 } from '../components/ui'
import type { Health } from '../types'

export default function Dashboard() {
  const snap = useStream()
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  const summary = snap?.summary
  const active = snap?.active ?? []

  return (
    <div className="space-y-4">
      <H1>Dashboard</H1>

      {health && (!health.twilio_configured || !health.anthropic_configured) && (
        <Card className="border-amber-700/60 bg-amber-900/20">
          <div className="text-sm">
            <div className="mb-1 font-medium text-amber-300">Setup incomplete</div>
            <ul className="list-disc pl-5 text-xs text-amber-100/80">
              {!health.twilio_configured && <li>Twilio credentials missing in <code>.env</code></li>}
              {!health.anthropic_configured && <li>Anthropic API key missing in <code>.env</code></li>}
            </ul>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total calls" value={summary?.total ?? 0} />
        <Stat label="Active" value={summary?.active ?? 0} tone="blue" />
        <Stat label="Completed" value={summary?.completed ?? 0} tone="green" />
        <Stat label="Interested" value={summary?.buckets?.['Interested'] ?? 0} tone="green" />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Active calls</h2>
          <span className="text-xs text-slate-500">live · SSE</span>
        </div>
        {active.length === 0 ? (
          <Empty title="No calls in progress" hint="Start a campaign or place a single call." />
        ) : (
          <div className="space-y-2">
            {active.map(c => (
              <Link
                key={c.call_sid}
                to={`/calls/${c.call_sid}`}
                className="block rounded-xl border border-slate-800 bg-slate-900 p-3 hover:border-brand-500"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{c.name || '(no name)'}</div>
                    <div className="text-xs text-slate-400">{c.phone}</div>
                  </div>
                  <Badge tone="blue">in progress</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {snap?.campaigns && snap.campaigns.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Campaigns</h2>
          <div className="space-y-2">
            {snap.campaigns.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-mono text-xs text-slate-400">{c.id}</div>
                  <Badge tone={c.status === 'running' ? 'blue' : c.status === 'done' ? 'green' : 'slate'}>
                    {c.status}
                  </Badge>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-brand-500 transition-all"
                    style={{ width: `${Math.min(100, (c.placed / Math.max(1, c.total)) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">{c.placed} / {c.total} placed</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'slate' }: {
  label: string
  value: number
  tone?: 'slate' | 'blue' | 'green'
}) {
  const colour = {
    slate: 'text-slate-100',
    blue: 'text-brand-400',
    green: 'text-emerald-400',
  }[tone]
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${colour}`}>{value}</div>
    </Card>
  )
}

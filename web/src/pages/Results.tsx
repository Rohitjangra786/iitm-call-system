import { useEffect, useState } from 'react'
import { api, OfflineError } from '../api'
import type { Summary } from '../types'
import { Badge, Button, Card, Empty, H1 } from '../components/ui'

export default function Results() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const load = () =>
      api.summary()
        .then(s => { setSummary(s); setOffline(false) })
        .catch(e => {
          if (e instanceof OfflineError) { setSummary(null); setOffline(true) }
        })
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <H1>Results</H1>
        <div className="flex items-center gap-2">
          {offline && <Badge tone="amber">Offline</Badge>}
          {!offline && (
            <a href={api.exportCsvUrl()} download>
              <Button variant="secondary">Export CSV</Button>
            </a>
          )}
        </div>
      </div>

      {offline && (
        <Card className="border-amber-700/40 bg-amber-900/10 text-xs text-amber-100/80">
          Call outcomes are stored in the backend's <code>calls.db</code>. Start the Python
          server to see them. You can still export your contact list from the Contacts tab.
        </Card>
      )}

      {!summary || summary.total === 0 ? (
        <Empty title="No results yet" hint={offline ? undefined : 'Results appear here as calls complete.'} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Total</div>
              <div className="mt-1 text-2xl font-semibold">{summary.total}</div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Active</div>
              <div className="mt-1 text-2xl font-semibold text-brand-400">{summary.active}</div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Completed</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-400">{summary.completed}</div>
            </Card>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold">By outcome</h2>
            <div className="space-y-2">
              {Object.entries(summary.buckets).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                const pct = (v / Math.max(1, summary.total)) * 100
                return (
                  <Card key={k} className="!p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>{k}</span>
                      <span className="text-slate-400">{v}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full ${
                          k === 'Interested' ? 'bg-emerald-500'
                          : k === 'Not Interested' ? 'bg-red-500'
                          : 'bg-slate-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

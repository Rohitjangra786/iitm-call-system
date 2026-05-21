import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api'
import type { CampaignState, Contact } from '../types'
import { Badge, Button, Card, Empty, H1, Input, Label } from '../components/ui'

export default function Campaigns() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [campaigns, setCampaigns] = useState<CampaignState[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [delay, setDelay] = useState(45)
  const [limit, setLimit] = useState(0)
  const [skipDone, setSkipDone] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    try {
      const [c, cps] = await Promise.all([api.contacts(), api.campaigns()])
      setContacts(c)
      setCampaigns(cps)
    } catch (e: any) { setError(e.message) }
  }

  useEffect(() => {
    reload()
    const t = setInterval(reload, 3000)
    return () => clearInterval(t)
  }, [])

  const toggle = (id: number) => {
    setSelected(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === contacts.length) setSelected(new Set())
    else setSelected(new Set(contacts.filter(c => !c.do_not_call).map(c => c.id)))
  }

  const onStart = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const ids = selected.size > 0 ? Array.from(selected) : undefined
      await api.startCampaign({
        contact_ids: ids,
        delay_seconds: delay,
        limit,
        skip_done: skipDone,
      })
      setSelected(new Set())
      await reload()
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  const onCancel = async (id: string) => {
    await api.cancelCampaign(id)
    await reload()
  }

  return (
    <div className="space-y-4">
      <H1>Campaigns</H1>

      {error && <Card className="border-red-700/60 bg-red-900/20 text-sm text-red-200">{error}</Card>}

      <Card>
        <form onSubmit={onStart} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Delay between calls (s)</Label>
              <Input type="number" min={5} max={600} value={delay} onChange={e => setDelay(Number(e.target.value))} />
            </div>
            <div>
              <Label>Limit (0 = all)</Label>
              <Input type="number" min={0} value={limit} onChange={e => setLimit(Number(e.target.value))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skipDone} onChange={e => setSkipDone(e.target.checked)} />
            Skip contacts already completed
          </label>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {selected.size > 0 ? `${selected.size} selected` : 'All contacts (excluding DNC) will be called'}
            </div>
            <Button type="submit" disabled={busy || contacts.length === 0}>Start campaign</Button>
          </div>
        </form>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pick contacts (optional)</h2>
          <Button variant="ghost" onClick={toggleAll}>{selected.size === contacts.length ? 'Clear' : 'Select all'}</Button>
        </div>
        {contacts.length === 0 ? (
          <Empty title="No contacts yet" hint="Add some on the Contacts tab first." />
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-2">
            {contacts.map(c => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-800">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} disabled={!!c.do_not_call} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.phone}</div>
                </div>
                {c.do_not_call ? <Badge tone="red">DNC</Badge> : null}
              </label>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">History</h2>
        {campaigns.length === 0 ? (
          <Empty title="No campaigns yet" />
        ) : (
          <div className="space-y-2">
            {campaigns.map(cp => (
              <Card key={cp.id} className="!p-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-slate-400">{cp.id}</div>
                  <div className="flex items-center gap-2">
                    <Badge tone={cp.status === 'running' ? 'blue' : cp.status === 'done' ? 'green' : 'slate'}>
                      {cp.status}
                    </Badge>
                    {cp.status === 'running' && (
                      <Button variant="danger" onClick={() => onCancel(cp.id)}>Cancel</Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, (cp.placed / Math.max(1, cp.total)) * 100)}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-500">{cp.placed} / {cp.total} placed · delay {cp.delay}s</div>
                {cp.log.length > 0 && (
                  <details className="mt-2 text-xs text-slate-400">
                    <summary className="cursor-pointer">Log ({cp.log.length})</summary>
                    <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                      {cp.log.slice(-50).reverse().map((l, i) => (
                        <div key={i}>
                          <span className="text-slate-500">#{l.contact_id}</span>{' '}
                          <span className="text-slate-300">{l.name}</span>{' '}
                          <span className="text-slate-500">{l.phone}</span>{' '}
                          <span className={l.result.startsWith('placed') ? 'text-emerald-400' : 'text-amber-400'}>{l.result}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

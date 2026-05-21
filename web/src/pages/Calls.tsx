import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { CallRow } from '../types'
import { Badge, Card, Empty, H1, Input } from '../components/ui'

const tone = (r: CallRow) =>
  r.remark === 'Interested' ? 'green'
  : r.remark === 'Not Interested' ? 'red'
  : r.status === 'in-progress' ? 'blue'
  : 'slate'

export default function Calls() {
  const [items, setItems] = useState<CallRow[]>([])
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.calls().then(setItems).catch(() => setItems([]))
    const t = setInterval(() => { api.calls().then(setItems).catch(() => {}) }, 5000)
    return () => clearInterval(t)
  }, [])

  const filtered = items.filter(r =>
    !filter
    || (r.name || '').toLowerCase().includes(filter.toLowerCase())
    || (r.phone || '').includes(filter)
    || (r.remark || '').toLowerCase().includes(filter.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <H1>Calls</H1>
      <Input placeholder="Search by name, phone, or remark" value={filter} onChange={e => setFilter(e.target.value)} />

      {filtered.length === 0 ? (
        <Empty title="No calls yet" hint="Place a single call from Contacts, or start a campaign." />
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Link
              key={r.call_sid}
              to={`/calls/${r.call_sid}`}
              className="block rounded-xl border border-slate-800 bg-slate-900 p-3 hover:border-brand-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name || '(no name)'}</div>
                  <div className="text-xs text-slate-400">{r.phone}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-500">{r.call_sid}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={tone(r) as any}>{r.remark || r.status}</Badge>
                  {r.started_at && <span className="text-[10px] text-slate-500">{r.started_at.slice(11, 16)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

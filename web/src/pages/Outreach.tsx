import { useEffect, useState } from 'react'
import { api, buildTalkLink } from '../api'
import type { Contact } from '../types'
import { HELPLINES, telHref } from '../helplines'
import { Badge, Button, Card, Empty, H1, Input } from '../components/ui'

export default function Outreach() {
  const [items, setItems] = useState<Contact[]>([])
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    api.contacts().then(setItems).catch(() => setItems([]))
  }, [])

  const filtered = items.filter(c =>
    !filter ||
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.phone.includes(filter),
  )

  const cleanPhone = (phone: string) =>
    phone.replace(/[^\d+]/g, '').replace(/^\+/, '')

  const onWhatsApp = (c: Contact) => {
    setBusy(c.id)
    try {
      const r = buildTalkLink(c, baseUrl)
      const wa = `https://wa.me/${cleanPhone(c.phone)}?text=${encodeURIComponent(r.message)}`
      window.open(wa, '_blank')
    } finally { setBusy(null) }
  }

  const onSMS = (c: Contact) => {
    setBusy(c.id)
    try {
      const r = buildTalkLink(c, baseUrl)
      const sms = `sms:${c.phone}?body=${encodeURIComponent(r.message)}`
      window.location.href = sms
    } finally { setBusy(null) }
  }

  const onCopy = async (c: Contact) => {
    setBusy(c.id)
    try {
      const r = buildTalkLink(c, baseUrl)
      await navigator.clipboard.writeText(r.message)
      alert('Message copied — paste it anywhere.')
    } catch (e: any) { alert(e.message) }
    finally { setBusy(null) }
  }

  const onShare = async (c: Contact) => {
    setBusy(c.id)
    try {
      const r = buildTalkLink(c, baseUrl)
      if (navigator.share) {
        await navigator.share({
          title: 'IITM admissions 2026-27',
          text: r.message,
          url: r.url,
        })
      } else {
        await navigator.clipboard.writeText(r.message)
        alert('Native share unavailable — message copied instead')
      }
    } catch { /* user cancelled */ }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <H1>Outreach</H1>

      <Card className="border-emerald-700/40 bg-emerald-900/10 text-sm text-emerald-100/80">
        Send a personalized voice-call link to each contact via WhatsApp or SMS. The message
        includes a greeting with their name, the link to chat with Anya, and the full
        course-wise admission helpline list.
        <div className="mt-2 text-xs text-emerald-200/60">
          Links open the WhatsApp / SMS / phone app on this device — works fully offline.
        </div>
      </Card>

      <details className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-200">
          📋 Course-wise Admission Helpline · 2026-27
        </summary>
        <div className="mt-3 space-y-2">
          {HELPLINES.map(h => (
            <div key={h.course} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone="blue">{h.course}</Badge>
                  <span className="truncate text-xs text-slate-400">{h.fullName}</span>
                </div>
                <div className="mt-1 text-sm">{h.lead}</div>
                <div className="text-xs text-slate-400">{h.phone}</div>
              </div>
              <a
                href={telHref(h.phone)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                title={`Call ${h.lead}`}
              >📞</a>
            </div>
          ))}
        </div>
      </details>

      <Input placeholder="Search by name or phone" value={filter} onChange={e => setFilter(e.target.value)} />

      {filtered.length === 0 ? (
        <Empty title="No contacts" hint="Add contacts on the Contacts tab first." />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="!p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  {c.do_not_call ? <Badge tone="red">DNC</Badge> : null}
                </div>
                <div className="truncate text-xs text-slate-400">{c.phone}</div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <a
                  href={`tel:${c.phone}`}
                  onClick={e => { if (c.do_not_call) e.preventDefault() }}
                  className={`inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 ${c.do_not_call ? 'cursor-not-allowed opacity-50' : ''}`}
                  title="Dial from this phone's SIM"
                >📲 Dial</a>
                <button
                  onClick={() => onWhatsApp(c)}
                  disabled={busy === c.id || !!c.do_not_call}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >🟢 WA</button>
                <button
                  onClick={() => onSMS(c)}
                  disabled={busy === c.id || !!c.do_not_call}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >💬 SMS</button>
                <Button variant="ghost" onClick={() => onShare(c)} disabled={busy === c.id} className="!px-2.5 !py-1.5 !text-xs">Share</Button>
                <Button variant="ghost" onClick={() => onCopy(c)} disabled={busy === c.id} className="!px-2.5 !py-1.5 !text-xs">Copy</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

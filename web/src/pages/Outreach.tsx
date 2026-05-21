import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Contact } from '../types'
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

  const buildLink = async (c: Contact) => {
    return api.makeTalkLink(c.id, baseUrl)
  }

  const onWhatsApp = async (c: Contact) => {
    setBusy(c.id)
    try {
      const r = await buildLink(c)
      const text = `${r.wa_text} ${r.url}`
      const cleanPhone = c.phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
      const wa = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      window.open(wa, '_blank')
    } catch (e: any) { alert(e.message) }
    finally { setBusy(null) }
  }

  const onSMS = async (c: Contact) => {
    setBusy(c.id)
    try {
      const r = await buildLink(c)
      const text = `${r.wa_text} ${r.url}`
      const sms = `sms:${c.phone}?body=${encodeURIComponent(text)}`
      window.location.href = sms
    } catch (e: any) { alert(e.message) }
    finally { setBusy(null) }
  }

  const onCopy = async (c: Contact) => {
    setBusy(c.id)
    try {
      const r = await buildLink(c)
      await navigator.clipboard.writeText(r.url)
      alert(`Link copied:\n${r.url}`)
    } catch (e: any) { alert(e.message) }
    finally { setBusy(null) }
  }

  const onShare = async (c: Contact) => {
    setBusy(c.id)
    try {
      const r = await buildLink(c)
      if (navigator.share) {
        await navigator.share({
          title: 'IITM admissions',
          text: r.wa_text,
          url: r.url,
        })
      } else {
        await navigator.clipboard.writeText(`${r.wa_text} ${r.url}`)
        alert('Native share unavailable — message copied instead')
      }
    } catch (e: any) { /* user cancelled */ }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <H1>Outreach</H1>

      <Card className="border-emerald-700/40 bg-emerald-900/10 text-sm text-emerald-100/80">
        Send a personalized voice-call link to each contact via WhatsApp or SMS. When they
        tap the link, they get a full-screen voice chat with Anya (the IITM agent). No phone
        charges to you — and the conversation shows up in the Calls tab automatically.
      </Card>

      <Input placeholder="Search by name or phone" value={filter} onChange={e => setFilter(e.target.value)} />

      {filtered.length === 0 ? (
        <Empty title="No contacts" hint="Add contacts on the Contacts tab first." />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="!p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    {c.do_not_call ? <Badge tone="red">DNC</Badge> : null}
                  </div>
                  <div className="text-xs text-slate-400">{c.phone}</div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <button
                    onClick={() => onWhatsApp(c)}
                    disabled={busy === c.id || !!c.do_not_call}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >🟢 WA</button>
                  <button
                    onClick={() => onSMS(c)}
                    disabled={busy === c.id || !!c.do_not_call}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >💬 SMS</button>
                  <Button variant="ghost" onClick={() => onShare(c)} disabled={busy === c.id}>Share</Button>
                  <Button variant="ghost" onClick={() => onCopy(c)} disabled={busy === c.id}>Copy</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

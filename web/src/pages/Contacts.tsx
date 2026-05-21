import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import { api, OfflineError } from '../api'
import type { Contact } from '../types'
import { Badge, Button, Card, Empty, H1, Input, Label } from '../components/ui'

export default function Contacts() {
  const [items, setItems] = useState<Contact[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', notes: '' })
  const [filter, setFilter] = useState('')
  const [online, setOnline] = useState<boolean | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    try { setItems(await api.contacts()) }
    catch (e: any) { setError(e.message) }
  }

  useEffect(() => {
    reload()
    api.isOnline().then(setOnline)
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required')
      return
    }
    setBusy(true); setError(null)
    try {
      if (editing) {
        await api.updateContact(editing.id, form)
      } else {
        await api.createContact(form)
      }
      setForm({ name: '', phone: '', notes: '' })
      setEditing(null)
      await reload()
    } catch (e: any) {
      setError(e.message)
    } finally { setBusy(false) }
  }

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError(null)
    try {
      const r = await api.uploadContactsCsv(file)
      await reload()
      alert(`Imported ${r.imported} contacts`)
    } catch (e: any) { setError(e.message) }
    finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onSeed = async () => {
    setBusy(true); setError(null)
    try {
      const r = await api.seedFromCsv()
      await reload()
      alert(`Seeded ${r.imported} contacts`)
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  const onExport = () => {
    const csv = api.exportContactsCsv()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this contact?')) return
    await api.deleteContact(id)
    await reload()
  }

  const onClearAll = async () => {
    if (items.length === 0) return
    if (!confirm(`Delete ALL ${items.length} contacts? This cannot be undone.`)) return
    if (!confirm('Are you sure? This will remove every contact.')) return
    setBusy(true); setError(null)
    try {
      for (const c of items) {
        try { await api.deleteContact(c.id) } catch { /* keep going */ }
      }
      await reload()
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  const onToggleDnc = async (c: Contact) => {
    await api.updateContact(c.id, { do_not_call: !c.do_not_call })
    await reload()
  }

  const onCall = async (c: Contact) => {
    if (!confirm(`Place a call to ${c.name} at ${c.phone}?`)) return
    setBusy(true); setError(null)
    try {
      const r = await api.placeCall({ phone: c.phone, name: c.name, contact_id: String(c.id) })
      alert(`Call placed — CallSid ${r.call_sid}`)
    } catch (e: any) {
      if (e instanceof OfflineError) {
        setError('AI calling requires the backend. Use 📲 Dial to call from this phone, or 🟢 WA / 💬 SMS on the Outreach tab.')
      } else {
        setError(e.message)
      }
    }
    finally { setBusy(false) }
  }

  const filtered = items.filter(c =>
    !filter ||
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.phone.includes(filter),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <H1>Contacts ({items.length})</H1>
        {online === false && <Badge tone="amber">Offline mode</Badge>}
      </div>

      {online === false && (
        <Card className="border-amber-700/40 bg-amber-900/10 text-xs text-amber-100/80">
          Backend not reachable — contacts are saved on this device only. CSV import, Dial, WA, and SMS still work.
        </Card>
      )}

      {error && <Card className="border-red-700/60 bg-red-900/20 text-sm text-red-200">{error}</Card>}

      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Riya Sharma" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+9198XXXXXXXX" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="optional" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>{editing ? 'Save' : 'Add contact'}</Button>
            {editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm({ name: '', phone: '', notes: '' }) }}>Cancel</Button>}
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={onUpload} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>Import CSV</Button>
            <Button variant="ghost" onClick={onSeed} disabled={busy}>Seed</Button>
            <Button variant="ghost" onClick={onExport} disabled={items.length === 0}>Export CSV</Button>
            <Button variant="danger" onClick={onClearAll} disabled={busy || items.length === 0}>Clear all</Button>
          </div>
        </form>
      </Card>

      <Input placeholder="Search by name or phone" value={filter} onChange={e => setFilter(e.target.value)} />

      {filtered.length === 0 ? (
        <Empty title="No contacts" hint="Add one above, import a CSV, or tap Seed." />
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
                {c.notes && <div className="mt-1 truncate text-xs text-slate-500">{c.notes}</div>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <a
                  href={`tel:${c.phone}`}
                  onClick={e => { if (c.do_not_call) e.preventDefault() }}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 ${c.do_not_call ? 'cursor-not-allowed opacity-50' : ''}`}
                  title="Dial from this phone's SIM (you talk)"
                >📲 Dial</a>
                <Button
                  variant="primary"
                  onClick={() => onCall(c)}
                  disabled={!!c.do_not_call || online === false}
                  className="!px-2.5 !py-1.5 !text-xs"
                >🤖 AI</Button>
                <Button variant="ghost" onClick={() => onToggleDnc(c)} className="!px-2.5 !py-1.5 !text-xs">{c.do_not_call ? 'Un-DNC' : 'DNC'}</Button>
                <Button variant="ghost" onClick={() => { setEditing(c); setForm({ name: c.name, phone: c.phone, notes: c.notes }) }} className="!px-2.5 !py-1.5 !text-xs">Edit</Button>
                <Button variant="danger" onClick={() => onDelete(c.id)} className="!px-2.5 !py-1.5 !text-xs">×</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

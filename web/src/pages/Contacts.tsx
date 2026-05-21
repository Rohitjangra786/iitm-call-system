import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Contact } from '../types'
import { Badge, Button, Card, Empty, H1, Input, Label } from '../components/ui'

export default function Contacts() {
  const [items, setItems] = useState<Contact[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', notes: '' })
  const [filter, setFilter] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    try { setItems(await api.contacts()) }
    catch (e: any) { setError(e.message) }
  }

  useEffect(() => { reload() }, [])

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
      alert(`Seeded ${r.imported} contacts from data/contacts.csv`)
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this contact?')) return
    await api.deleteContact(id)
    await reload()
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
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  const filtered = items.filter(c =>
    !filter ||
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.phone.includes(filter),
  )

  return (
    <div className="space-y-4">
      <H1>Contacts ({items.length})</H1>

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
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{editing ? 'Save' : 'Add contact'}</Button>
            {editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm({ name: '', phone: '', notes: '' }) }}>Cancel</Button>}
            <div className="flex-1" />
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={onUpload} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>Import CSV</Button>
            <Button variant="ghost" onClick={onSeed} disabled={busy}>Seed</Button>
          </div>
        </form>
      </Card>

      <Input placeholder="Search by name or phone" value={filter} onChange={e => setFilter(e.target.value)} />

      {filtered.length === 0 ? (
        <Empty title="No contacts" hint="Add one above or import a CSV." />
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
                  {c.notes && <div className="mt-1 text-xs text-slate-500">{c.notes}</div>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <Button variant="primary" onClick={() => onCall(c)} disabled={!!c.do_not_call}>Call</Button>
                  <Button variant="ghost" onClick={() => onToggleDnc(c)}>{c.do_not_call ? 'Un-DNC' : 'DNC'}</Button>
                  <Button variant="ghost" onClick={() => { setEditing(c); setForm({ name: c.name, phone: c.phone, notes: c.notes }) }}>Edit</Button>
                  <Button variant="danger" onClick={() => onDelete(c.id)}>×</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Client-side persistence so the PWA works without the Python backend.
 *
 * Backed by localStorage so it survives reloads, install-to-home-screen,
 * and offline use. Same shape as the backend's /api/contacts responses.
 */
import type { Contact } from './types'

const KEY = 'siksa.contacts.v1'
const ID_KEY = 'siksa.contacts.nextId'

function read(): Contact[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

function write(items: Contact[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

function nextId(): number {
  const cur = Number(localStorage.getItem(ID_KEY) || '0')
  const next = cur + 1
  localStorage.setItem(ID_KEY, String(next))
  return next
}

export function normPhone(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return ''
  const digits = s.replace(/\D/g, '')
  if (s.startsWith('+') && digits.length >= 10) return '+' + digits
  if (digits.length === 10) return '+91' + digits
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits
  if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1)
  return digits ? '+' + digits : ''
}

function nowIso(): string { return new Date().toISOString() }

export const localStore = {
  list(): Contact[] {
    return read().sort((a, b) => a.name.localeCompare(b.name))
  },

  get(id: number): Contact | undefined {
    return read().find(c => c.id === id)
  },

  create(input: Partial<Contact>): Contact {
    const items = read()
    const phone = normPhone(input.phone || '')
    if (!phone) throw new Error('phone is required')
    const existing = items.find(c => c.phone === phone)
    if (existing) {
      return this.update(existing.id, {
        name: input.name || existing.name,
        notes: input.notes ?? existing.notes,
      })
    }
    const now = nowIso()
    const c: Contact = {
      id: nextId(),
      name: (input.name || '').trim() || '(no name)',
      phone,
      notes: input.notes || '',
      do_not_call: input.do_not_call ? 1 : 0,
      created_at: now,
      updated_at: now,
    }
    items.push(c)
    write(items)
    return c
  },

  update(id: number, patch: Partial<Contact>): Contact {
    const items = read()
    const i = items.findIndex(c => c.id === id)
    if (i < 0) throw new Error('contact not found')
    const cur = items[i]
    const next: Contact = {
      ...cur,
      ...('name' in patch ? { name: (patch.name || cur.name).trim() } : {}),
      ...('phone' in patch ? { phone: normPhone(patch.phone || cur.phone) } : {}),
      ...('notes' in patch ? { notes: patch.notes ?? cur.notes } : {}),
      ...('do_not_call' in patch ? { do_not_call: patch.do_not_call ? 1 : 0 } : {}),
      updated_at: nowIso(),
    }
    items[i] = next
    write(items)
    return next
  },

  remove(id: number): boolean {
    const items = read()
    const next = items.filter(c => c.id !== id)
    if (next.length === items.length) return false
    write(next)
    return true
  },

  clear() { write([]) },

  upsertFromRows(rows: { name: string; phone: string; notes?: string }[]): number {
    const items = read()
    const byPhone = new Map(items.map(c => [c.phone, c]))
    let added = 0
    let updated = 0
    for (const r of rows) {
      const phone = normPhone(r.phone)
      const name = (r.name || '').trim()
      if (!phone || !name) continue
      const existing = byPhone.get(phone)
      if (existing) {
        existing.name = name
        existing.notes = r.notes ?? existing.notes
        existing.updated_at = nowIso()
        updated++
      } else {
        const now = nowIso()
        const c: Contact = {
          id: nextId(),
          name,
          phone,
          notes: r.notes || '',
          do_not_call: 0,
          created_at: now,
          updated_at: now,
        }
        items.push(c)
        byPhone.set(phone, c)
        added++
      }
    }
    write(items)
    return added + updated
  },

  toCsv(): string {
    const items = this.list()
    const head = ['name', 'phone', 'notes', 'do_not_call']
    const escape = (v: string) =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    const lines = [head.join(',')]
    for (const c of items) {
      lines.push([
        escape(c.name),
        escape(c.phone),
        escape(c.notes || ''),
        c.do_not_call ? '1' : '0',
      ].join(','))
    }
    return lines.join('\n')
  },
}

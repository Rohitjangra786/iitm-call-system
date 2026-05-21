import type {
  AgentTurn, CallRow, CampaignState, ChatMessage, Contact, Health, Summary, TranscriptTurn,
} from './types'
import { localStore, normPhone } from './localStore'
import { parseCsv, rowToContact } from './parseCsv'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

/** Class thrown by req() so callers can detect "backend unavailable" and fall back. */
export class OfflineError extends Error {
  constructor(msg: string) { super(msg); this.name = 'OfflineError' }
}

async function req<T>(path: string, init?: RequestInit, timeoutMs = 4000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      signal: ctrl.signal,
      ...init,
    })
  } catch (e: any) {
    throw new OfflineError(`backend unreachable: ${e?.message || e}`)
  } finally { clearTimeout(t) }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`)
  }
  if (res.status === 204) return undefined as unknown as T
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return (await res.text()) as unknown as T
  return res.json() as Promise<T>
}

/** Cached probe — true if /api/health responded recently. */
let onlineCache: { value: boolean; at: number } | null = null
async function probeOnline(): Promise<boolean> {
  if (onlineCache && Date.now() - onlineCache.at < 10_000) return onlineCache.value
  try {
    await req<Health>('/api/health', undefined, 2500)
    onlineCache = { value: true, at: Date.now() }
    return true
  } catch {
    onlineCache = { value: false, at: Date.now() }
    return false
  }
}

export function invalidateOnline() { onlineCache = null }

/** Build the personalised /talk?to=&name=&phone= link entirely client-side. */
export function buildTalkLink(c: Contact, baseUrl: string): { url: string; wa_text: string } {
  const qs = new URLSearchParams({
    to: String(c.id),
    name: c.name,
    phone: c.phone,
  }).toString()
  return {
    url: `${baseUrl.replace(/\/$/, '')}/talk?${qs}`,
    wa_text: `Hi ${c.name}, this is IITM admissions team. ` +
             `You can have a quick chat with our AI counselor Anya about ` +
             `the BCA programme. Tap here:`,
  }
}

const localContact = (c: Contact): Contact => ({ ...c, do_not_call: c.do_not_call ? 1 : 0 })

export const api = {
  isOnline: probeOnline,

  health: async (): Promise<Health> => {
    try { return await req<Health>('/api/health', undefined, 2500) }
    catch {
      return {
        ok: false,
        service: 'siksa-pwa-offline',
        twilio_configured: false,
        anthropic_configured: false,
        public_url: '',
        agent: { backend: 'anthropic', model: 'offline' },
      }
    }
  },

  // contacts — offline-first; backend wins when reachable, otherwise localStore
  contacts: async (): Promise<Contact[]> => {
    try { return await req<Contact[]>('/api/contacts') }
    catch (e) {
      if (e instanceof OfflineError) return localStore.list()
      throw e
    }
  },

  createContact: async (c: Partial<Contact>): Promise<Contact> => {
    try {
      return await req<Contact>('/api/contacts', { method: 'POST', body: JSON.stringify(c) })
    } catch (e) {
      if (e instanceof OfflineError) return localContact(localStore.create(c))
      throw e
    }
  },

  updateContact: async (id: number, patch: Partial<Contact>): Promise<Contact> => {
    try {
      return await req<Contact>(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
    } catch (e) {
      if (e instanceof OfflineError) return localContact(localStore.update(id, patch))
      throw e
    }
  },

  deleteContact: async (id: number): Promise<void> => {
    try { await req<void>(`/api/contacts/${id}`, { method: 'DELETE' }) }
    catch (e) {
      if (e instanceof OfflineError) { localStore.remove(id); return }
      throw e
    }
  },

  uploadContactsCsv: async (file: File): Promise<{ imported: number }> => {
    // Always parse client-side so the same flow works online or offline.
    // (Online uploads still POST to the backend so the server DB is updated.)
    const text = await file.text()
    const rows = parseCsv(text).map(rowToContact)
      .filter(r => r.name && r.phone)
      .map(r => ({ name: r.name, phone: normPhone(r.phone), notes: r.notes }))
    if (await probeOnline()) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch(`${BASE}/api/contacts/upload`, { method: 'POST', body: fd })
        if (res.ok) return res.json() as Promise<{ imported: number }>
      } catch { /* fall through to local */ }
    }
    const n = localStore.upsertFromRows(rows)
    return { imported: n }
  },

  seedFromCsv: async (): Promise<{ imported: number }> => {
    if (await probeOnline()) {
      try {
        return await req<{ imported: number }>('/api/contacts/seed-from-csv', { method: 'POST' })
      } catch { /* fall through to local */ }
    }
    // Offline: load the bundled CSV that's cached by the service worker.
    const res = await fetch('/contacts.csv')
    if (!res.ok) throw new Error('seed CSV not available offline')
    const text = await res.text()
    const rows = parseCsv(text).map(rowToContact)
      .filter(r => r.name && r.phone)
      .map(r => ({ name: r.name, phone: normPhone(r.phone), notes: r.notes }))
    const n = localStore.upsertFromRows(rows)
    return { imported: n }
  },

  exportContactsCsv: (): string => localStore.toCsv(),

  // calls — backend-only (Twilio dials the phone)
  calls: (limit = 200) => req<CallRow[]>(`/api/calls?limit=${limit}`),
  activeCalls: () => req<CallRow[]>('/api/calls/active'),
  call: (sid: string) =>
    req<{ call: CallRow; transcript: TranscriptTurn[] }>(`/api/calls/${sid}`),
  placeCall: (payload: { phone: string; name?: string; contact_id?: string }) =>
    req<{ call_sid: string; phone: string; name: string }>('/api/calls', {
      method: 'POST', body: JSON.stringify(payload),
    }),

  // campaigns — backend-only
  startCampaign: (payload: {
    contact_ids?: number[]
    limit?: number
    delay_seconds?: number
    skip_done?: boolean
  }) => req<CampaignState>('/api/campaigns', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  campaigns: () => req<CampaignState[]>('/api/campaigns'),
  campaign: (id: string) => req<CampaignState>(`/api/campaigns/${id}`),
  cancelCampaign: (id: string) =>
    req<CampaignState>(`/api/campaigns/${id}/cancel`, { method: 'POST' }),

  // results — backend-only (real call outcomes live in calls.db)
  summary: () => req<Summary>('/api/results/summary'),
  exportCsvUrl: () => `${BASE}/api/results/export.csv`,

  // agent chat — backend-only (LLM lives there)
  chat: (messages: ChatMessage[], student_name = 'there') =>
    req<AgentTurn>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, student_name }),
    }, 30_000),

  chatSession: (
    messages: ChatMessage[],
    opts: { student_name?: string; session_id: string; contact_id?: string; phone?: string },
  ) =>
    req<AgentTurn>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, ...opts }),
    }, 30_000),

  // outreach link — always built client-side now (the backend version did the same thing)
  makeTalkLink: async (contact_id: number, base_url: string) => {
    const c = localStore.get(contact_id)
      ?? (await api.contacts()).find(x => x.id === contact_id)
    if (!c) throw new Error('contact not found')
    const { url, wa_text } = buildTalkLink(c, base_url)
    return { url, wa_text, contact: c }
  },
}

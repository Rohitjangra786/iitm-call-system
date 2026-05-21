import type {
  CallRow, CampaignState, Contact, Health, Summary, TranscriptTurn,
} from './types'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`)
  }
  if (res.status === 204) return undefined as unknown as T
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return (await res.text()) as unknown as T
  return res.json() as Promise<T>
}

export const api = {
  health: () => req<Health>('/api/health'),

  // contacts
  contacts: () => req<Contact[]>('/api/contacts'),
  createContact: (c: Partial<Contact>) => req<Contact>('/api/contacts', {
    method: 'POST', body: JSON.stringify(c),
  }),
  updateContact: (id: number, patch: Partial<Contact>) =>
    req<Contact>(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteContact: (id: number) =>
    req<void>(`/api/contacts/${id}`, { method: 'DELETE' }),
  uploadContactsCsv: async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/api/contacts/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(`upload failed: ${res.status}`)
    return res.json() as Promise<{ imported: number }>
  },
  seedFromCsv: () =>
    req<{ imported: number }>('/api/contacts/seed-from-csv', { method: 'POST' }),

  // calls
  calls: (limit = 200) => req<CallRow[]>(`/api/calls?limit=${limit}`),
  activeCalls: () => req<CallRow[]>('/api/calls/active'),
  call: (sid: string) =>
    req<{ call: CallRow; transcript: TranscriptTurn[] }>(`/api/calls/${sid}`),
  placeCall: (payload: { phone: string; name?: string; contact_id?: string }) =>
    req<{ call_sid: string; phone: string; name: string }>('/api/calls', {
      method: 'POST', body: JSON.stringify(payload),
    }),

  // campaigns
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

  // results
  summary: () => req<Summary>('/api/results/summary'),
  exportCsvUrl: () => `${BASE}/api/results/export.csv`,
}

export interface Contact {
  id: number
  name: string
  phone: string
  notes: string
  do_not_call: number | boolean
  created_at: string
  updated_at: string
}

export interface CallRow {
  call_sid: string
  contact_id: string | null
  name: string
  phone: string
  status: string
  sentiment: string | null
  remark: string | null
  started_at: string | null
  ended_at: string | null
}

export interface TranscriptTurn {
  turn_no: number
  role: 'agent' | 'student'
  text: string
  created_at: string
}

export interface CampaignState {
  id: string
  status: 'pending' | 'running' | 'done' | 'cancelled'
  total: number
  placed: number
  delay: number
  limit: number
  log: { contact_id: string; name: string; phone: string; result: string; call_sid?: string }[]
  cancel: boolean
}

export interface Summary {
  total: number
  active: number
  completed: number
  buckets: Record<string, number>
}

export interface StreamSnapshot {
  summary: Summary
  active: CallRow[]
  campaigns: { id: string; status: string; placed: number; total: number }[]
}

export interface Health {
  ok: boolean
  service: string
  twilio_configured: boolean
  anthropic_configured: boolean
  public_url: string
  agent: { backend: 'anthropic' | 'ollama'; model: string; url?: string }
}

export interface AgentTurn {
  say: string
  sentiment: string
  note: string
  end_call: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

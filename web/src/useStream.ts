import { useEffect, useState } from 'react'
import type { StreamSnapshot } from './types'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export function useStream(): StreamSnapshot | null {
  const [snap, setSnap] = useState<StreamSnapshot | null>(null)

  useEffect(() => {
    const es = new EventSource(`${BASE}/api/stream`)
    es.onmessage = (e) => {
      try { setSnap(JSON.parse(e.data) as StreamSnapshot) } catch { /* ignore */ }
    }
    es.onerror = () => { /* EventSource auto-reconnects */ }
    return () => es.close()
  }, [])

  return snap
}

import { useEffect, useState } from 'react'
import type { StreamSnapshot } from './types'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

/** SSE snapshot from the backend. Returns null forever when the backend
 *  isn't reachable (so callers can fall back to a static empty UI). */
export function useStream(): StreamSnapshot | null {
  const [snap, setSnap] = useState<StreamSnapshot | null>(null)

  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource(`${BASE}/api/stream`)
      es.onmessage = (e) => {
        try { setSnap(JSON.parse(e.data) as StreamSnapshot) } catch { /* ignore */ }
      }
      // Don't spam reconnects forever — browsers throttle EventSource, but
      // when the backend is intentionally offline we just stop trying.
      let errors = 0
      es.onerror = () => {
        errors++
        if (errors > 3 && es) { es.close(); es = null }
      }
    } catch { /* EventSource unavailable */ }
    return () => { if (es) es.close() }
  }, [])

  return snap
}

'use client'

import { useEffect, useState } from 'react'

interface TokenState {
  token: string | null
  error: string | null
}

export function useRealtimeToken(workflowId: string): TokenState {
  const [state, setState] = useState<TokenState>({ token: null, error: null })

  useEffect(() => {
    let cancelled = false
    async function fetchToken() {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/realtime-token`)
        if (!res.ok) throw new Error(`Token fetch failed: HTTP ${res.status}`)
        const data = (await res.json()) as { token: string }
        if (!cancelled) setState({ token: data.token, error: null })
      } catch (e) {
        if (!cancelled) setState({ token: null, error: e instanceof Error ? e.message : 'Token error' })
      }
    }
    void fetchToken()
    return () => {
      cancelled = true
    }
  }, [workflowId])

  return state
}

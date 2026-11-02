import { useEffect, useState } from 'react'
import type { Signals } from './steps.ts'

// What the API knows about each plan beyond the ideas list: a finished video, a post, the latest activity.
export type ProductionSignals = Record<string, Signals>

export async function loadProduction(): Promise<ProductionSignals> {
  const r = await fetch('/api/production')
  if (!r.ok) return {}
  const body = (await r.json().catch(() => null)) as { ideas?: ProductionSignals } | null
  return body?.ideas ?? {}
}

// Loads when the board opens, again when the tab comes back into view, and when `refreshKey` changes
// (a move on the board). Without a backend (sample data) every plan simply has no signals.
export function useProduction(refreshKey: unknown): ProductionSignals {
  const [signals, setSignals] = useState<ProductionSignals>({})
  useEffect(() => {
    let live = true
    const load = () => {
      loadProduction()
        .then((s) => live && setSignals(s))
        .catch(() => undefined)
    }
    load()
    const onShow = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [refreshKey])
  return signals
}

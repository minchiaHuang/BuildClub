import { useEffect, useState } from 'react'
import { getSummary } from '../../lib/publish'
import type { PublishSummary } from '../../lib/publish'

// Loaded once per page view and shared by every card that asks, so a board of cards makes one request.
// A failed request or a server without publishing simply gives null: the screens then show nothing.
let cached: { at: number; promise: Promise<PublishSummary | null> } | null = null
const FRESH_MS = 5000

export function usePublishSummary(): PublishSummary | null {
  const [summary, setSummary] = useState<PublishSummary | null>(null)
  useEffect(() => {
    let live = true
    if (!cached || Date.now() - cached.at > FRESH_MS) cached = { at: Date.now(), promise: getSummary().catch(() => null) }
    void cached.promise.then((s) => live && setSummary(s))
    return () => {
      live = false
    }
  }, [])
  return summary
}

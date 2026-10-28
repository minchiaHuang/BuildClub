import { useEffect, useState } from 'react'
import { checkLive } from './live'

export interface LiveStats {
  videosScanned: number
  searches: number
}

export interface LiveInfo {
  // 'unknown' until /api/health answers: show neither the sample nor the live parts then.
  mode: 'unknown' | 'live' | 'sample'
  // Real counts from the API; null when it is off or can't say.
  stats: LiveStats | null
}

// The landing pages and heroes show before the app knows its mode, so they ask once for themselves.
let pending: Promise<LiveInfo> | null = null

function load(): Promise<LiveInfo> {
  pending ??= checkLive().then(async (live) => {
    if (!live) return { mode: 'sample', stats: null }
    try {
      const r = await fetch('/api/stats')
      if (!r.ok) return { mode: 'live', stats: null }
      const s = await r.json()
      return typeof s.videosScanned === 'number' ? { mode: 'live', stats: s as LiveStats } : { mode: 'live', stats: null }
    } catch {
      return { mode: 'live', stats: null }
    }
  })
  return pending
}

export function useLiveInfo(): LiveInfo {
  const [info, setInfo] = useState<LiveInfo>({ mode: 'unknown', stats: null })
  useEffect(() => {
    let current = true
    load().then((i) => current && setInfo(i))
    return () => {
      current = false
    }
  }, [])
  return info
}

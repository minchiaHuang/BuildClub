import { useEffect, useState } from 'react'
import type { Platform, SavedIdea } from './types'

export type Sort = 'outlier' | 'ratio' | 'newest' | 'fastest'

export interface Query {
  keyword: string
  platforms: Platform[]
  days: number
  maxLength: number // 0 = any length
  clientId: string
}

export const defaultQuery: Query = {
  // Starts empty so the search page shows example searches first.
  keyword: '',
  platforms: ['instagram', 'tiktok'],
  days: 30,
  maxLength: 0,
  clientId: 'evergreen',
}

const IDEAS_KEY = 'trend-finder.ideas.v1'

function readIdeas(): SavedIdea[] {
  try {
    const raw = localStorage.getItem(IDEAS_KEY)
    return raw ? (JSON.parse(raw) as SavedIdea[]) : []
  } catch {
    return []
  }
}

// Saved ideas live in this browser only, so the demo keeps its state between reloads.
export function useSavedIdeas() {
  const [ideas, setIdeas] = useState<SavedIdea[]>(readIdeas)
  useEffect(() => {
    try {
      localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas))
    } catch {
      // Storage blocked: the demo still works, it just won't remember.
    }
  }, [ideas])
  return [ideas, setIdeas] as const
}

export function inTwoWeeks(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

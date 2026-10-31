import { useEffect, useState } from 'react'
import type { AgencySettings, Platform, SavedIdea } from './types'
import { sampleIdeas } from './data/sample'

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
  platforms: ['tiktok', 'instagram'],
  days: 30,
  maxLength: 0,
  clientId: 'evergreen',
}

// State that lives in this browser only, so the demo keeps where it was between reloads.
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage blocked: the demo still works, it just won't remember.
    }
  }, [key, value])
  return [value, setValue] as const
}

export const useSavedIdeas = () => useStored<SavedIdea[]>('trend-finder.ideas.v4', sampleIdeas)

// 'all' is the agency view across every client.
export type Workspace = 'all' | string

export const defaultAgency: AgencySettings = { agencyName: 'Sample Social Co.', managerName: 'Annie' }

export function inTwoWeeks(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

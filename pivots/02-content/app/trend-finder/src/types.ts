export type Platform = 'instagram' | 'tiktok'

export interface Video {
  id: string
  platform: Platform
  handle: string
  hook: string
  views: number
  followers: number
  // The account's usual (median) views per video. Outlier score = views / medianViews.
  medianViews: number
  daysAgo: number
  lengthSec: number
  shares: number
  // Instagram doesn't show saves publicly, so this can be null.
  saves: number | null
  formatId: string
  keywords: string[]
}

export interface Shot {
  time: string
  shot: string
  text?: string
}

export interface Format {
  id: string
  name: string
  // How people would search for it ("tofu desserts"). Used in search suggestions.
  short: string
  // Words that point a search at this format ("dessert", "taste test").
  tags: string[]
  // Who this format tends to work for. Used by audience search ("for busy mums").
  audiences: string[]
  summary: string
  why: {
    hook: string
    first3s: string
    length: string
    format: string
    sound: string
  }
  shotList: Shot[]
  props: string[]
  needs: string[]
  // How hard it is for a typical client to film.
  effort: 'easy' | 'medium' | 'hard'
  editorNotes: string
}

export interface Client {
  id: string
  name: string
  niche: string
  audience: string
  monthlyTarget: number
  // Things this client can't do, used for the "Can they film this?" check.
  cannot: string[]
}

export type IdeaStatus = 'saved' | 'waiting' | 'approved' | 'rejected'

export interface SavedIdea {
  id: string
  videoId: string
  clientId: string
  status: IdeaStatus
  dueDate: string
  notes: string
}

export type Platform = 'instagram' | 'tiktok'

export interface Video {
  id: string
  platform: Platform
  handle: string
  hook: string
  views: number
  followers: number
  // The account's usual (median) views per video. Outlier score = views / medianViews.
  // Null when we haven't fetched it (live results); the score then falls back to followers.
  medianViews: number | null
  daysAgo: number
  lengthSec: number
  shares: number
  // Instagram doesn't show saves publicly, so this can be null.
  saves: number | null
  formatId: string
  keywords: string[]
  // Live results only (real TikTok videos).
  live?: boolean
  url?: string
  thumbnail?: string
  caption?: string
  music?: string
  hashtags?: string[]
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
  // Starter searches shown on the search page for this client.
  examples: string[]
  // What the daily trend check searches for (first one is used). Optional so older saved clients still load.
  topics?: string[]
  // Things this client can't do, used for the "Can they film this?" check.
  cannot: string[]
  // Every approval and rejection for this client, oldest first. Optional so older saved clients still load.
  memory?: ClientEvent[]
}

export type IdeaStatus = 'saved' | 'waiting' | 'approved' | 'rejected'

// Who is signed in. Staff are team members or the manager; only the manager can approve or send back plans.
// A client account sees its own plans, read-only. Demo only: picked at login, nothing is checked.
export type Role = 'member' | 'manager' | 'client'

export interface AgencySettings {
  agencyName: string
  // The person who approves plans, shown wherever the UI says who reviews ("Waiting for Annie").
  managerName: string
}

// One manager decision, kept on the client so Remake remembers what each client likes and dislikes.
export interface ClientEvent {
  ideaId: string
  kind: 'approved' | 'approved-with-changes' | 'sent-back'
  reason?: string
  at: number
}

export interface SavedIdea {
  id: string
  videoId: string
  clientId: string
  status: IdeaStatus
  dueDate: string
  // Notes for the editor, used once the idea is approved.
  notes: string
  // The client's own version of the shot list. Starts as a copy of the reference format's shots.
  shots?: Shot[]
  // Short pitch shown to the approver with the plan.
  noteToApprover?: string
  sentAt?: number
  rejectReason?: string
  // Set when the manager decides.
  approvedAt?: number
  // "Approve with changes": what the manager wants changed.
  managerNote?: string
  // The manager's comment per shot, keyed by shot index.
  shotComments?: Record<number, string>
}

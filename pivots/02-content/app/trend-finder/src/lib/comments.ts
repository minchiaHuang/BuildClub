import { LinkClosed } from './share.ts'

// A note pinned to a second of a plan's reference video. Added and read, never edited or deleted.
export interface Comment {
  id: string
  ideaId: string
  videoId: string
  atSec: number
  text: string
  author: string
  createdAt: number
}

export const MAX_COMMENT_LENGTH = 500

// 75.4 -> "1:15", 3725 -> "1:02:05"
export function formatAt(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export const sortByTime = <T extends { atSec: number }>(c: T[]): T[] => [...c].sort((a, b) => a.atSec - b.atSec)

// "1:15", "1:02:05" or "42" -> seconds; null when it isn't a time.
export function parseAt(text: string): number | null {
  const parts = text.trim().split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d{1,5}$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.slice(1).some((n) => n > 59)) return null
  return nums.reduce((total, n) => total * 60 + n, 0)
}

// Signed-in staff use /api/ideas/..., the approver's page goes through its link and needs no login.
const base = (ideaId: string, token?: string) =>
  token
    ? `/api/review/${encodeURIComponent(token)}/ideas/${encodeURIComponent(ideaId)}/comments`
    : `/api/ideas/${encodeURIComponent(ideaId)}/comments`

export async function listComments(ideaId: string, token?: string): Promise<Comment[]> {
  const r = await fetch(base(ideaId, token))
  if (r.status === 404 && token) throw new LinkClosed()
  if (!r.ok) throw new Error("Couldn't load the comments.")
  return r.json()
}

export async function addComment(
  ideaId: string,
  c: { videoId: string; atSec: number; text: string; author: string },
  token?: string,
): Promise<Comment> {
  const r = await fetch(base(ideaId, token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  })
  if (r.status === 404 && token) throw new LinkClosed()
  if (r.status === 409) throw new Error('This video has the most comments it can hold.')
  if (!r.ok) throw new Error("Couldn't save your comment.")
  return r.json()
}

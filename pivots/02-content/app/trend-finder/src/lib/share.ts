import type { Format, SavedIdea, Video } from '../types'

// The approver's share link. The team creates and turns it off; the approver opens /review/<token> with no login.
export async function createShareLink(clientId: string): Promise<{ token: string; url: string }> {
  const r = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  })
  if (!r.ok) throw new Error("Couldn't create the link.")
  const { token } = (await r.json()) as { token: string }
  // Built here, not by the server, so the scheme and host are the ones the approver will actually open.
  return { token, url: `${window.location.origin}/review/${token}` }
}

// Turns off every link this client has. Never creates one.
export async function revokeClientLinks(clientId: string): Promise<void> {
  const r = await fetch(`/api/share?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
  if (!r.ok) throw new Error("Couldn't turn off the link.")
}

export interface ReviewItem {
  // The API leaves out `notes`, the team's private note to the editor.
  idea: Omit<SavedIdea, 'notes'>
  // Missing when the saved video's breakdown isn't on the API.
  video?: Video
  format?: Format
}

// A finished video waiting for the approver. `version` is a decimal string: the file's mtime in ns exceeds 2^53.
export interface ReviewCutItem {
  idea: Omit<SavedIdea, 'notes'>
  video?: Video
  format?: Format
  cut: { url: string; durationSec: number; version: string; sentAt: number }
}

export interface Review {
  client: { name: string }
  ideas: ReviewItem[]
  cuts: ReviewCutItem[]
}

// null when the link is turned off or never existed. Any other failure throws.
export async function loadReview(token: string): Promise<Review | null> {
  const r = await fetch(`/api/review/${encodeURIComponent(token)}`)
  if (r.status === 404) return null
  if (!r.ok) throw new Error("Couldn't load this page.")
  const review = (await r.json()) as Omit<Review, 'cuts'> & { cuts?: ReviewCutItem[] }
  // An older backend has no finished videos to review.
  return { ...review, cuts: review.cuts ?? [] }
}

// Preset reasons for sending a plan back, in the order the approver sees them. The API accepts any short text.
export const REJECT_TAGS: readonly string[] = [
  "Doesn't fit the brand's tone",
  "Format doesn't suit this client",
  'Too hard or costly to film',
  'Did something similar recently',
  'Other',
]

// The idea is no longer waiting (answered already, or sent back to the team), so there is nothing to answer.
export class AlreadyReviewed extends Error {
  constructor() {
    super('Already reviewed.')
  }
}

// The link was turned off while the page was open.
export class LinkClosed extends Error {
  constructor() {
    super('This link is closed.')
  }
}

// The video was replaced while the approver was watching it.
export class VideoReplaced extends Error {
  constructor() {
    super('This video was replaced.')
  }
}

export async function sendDecision(
  token: string,
  ideaId: string,
  approved: boolean,
  reason?: string,
  tags?: string[],
): Promise<void> {
  const r = await fetch(`/api/review/${encodeURIComponent(token)}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ideaId, decision: approved ? 'approved' : 'rejected', reason, tags }),
  })
  if (r.status === 404) {
    const body = (await r.json().catch(() => null)) as { code?: string } | null
    throw body?.code === 'link_closed' ? new LinkClosed() : new AlreadyReviewed()
  }
  if (!r.ok) throw new Error("Couldn't save your answer.")
}

// Approves or sends back a finished video. `version` is the one the approver watched.
export async function decideCut(token: string, ideaId: string, approved: boolean, version: string, reason?: string): Promise<void> {
  const r = await fetch(`/api/review/${encodeURIComponent(token)}/cuts/${encodeURIComponent(ideaId)}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: approved ? 'approved' : 'rejected', reason, version }),
  })
  if (r.status === 404) {
    const body = (await r.json().catch(() => null)) as { code?: string } | null
    throw body?.code === 'link_closed' ? new LinkClosed() : new AlreadyReviewed()
  }
  if (r.status === 409) {
    const body = (await r.json().catch(() => null)) as { code?: string } | null
    if (body?.code === 'replaced') throw new VideoReplaced()
  }
  if (!r.ok) throw new Error("Couldn't save your answer.")
}

// The token in /review/<token>, or null on any other path.
export function reviewTokenFromPath(path: string): string | null {
  const m = /^\/review\/([A-Za-z0-9_-]+)\/?$/.exec(path)
  return m ? m[1] : null
}

import type { Format, SavedIdea, Video } from '../types'

// The approver's share link. Daphne creates and turns it off; Annie opens /review/<token> with no login.
export async function createShareLink(clientId: string): Promise<{ token: string; url: string }> {
  const r = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  })
  if (!r.ok) throw new Error("Couldn't create the link.")
  const { token } = (await r.json()) as { token: string }
  // Built here, not by the server, so the scheme and host are the ones Annie will actually open.
  return { token, url: `${window.location.origin}/review/${token}` }
}

// Turns off every link this client has. Never creates one.
export async function revokeClientLinks(clientId: string): Promise<void> {
  const r = await fetch(`/api/share?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
  if (!r.ok) throw new Error("Couldn't turn off the link.")
}

export interface ReviewItem {
  // The API leaves out `notes`, Daphne's private note to her editor.
  idea: Omit<SavedIdea, 'notes'>
  // Missing when the saved video's breakdown isn't on the API.
  video?: Video
  format?: Format
}

export interface Review {
  client: { name: string }
  ideas: ReviewItem[]
}

// null when the link is turned off or never existed.
export async function loadReview(token: string): Promise<Review | null> {
  const r = await fetch(`/api/review/${encodeURIComponent(token)}`)
  if (r.status === 404) return null
  if (!r.ok) throw new Error("Couldn't load this page.")
  return r.json()
}

export async function sendDecision(token: string, ideaId: string, approved: boolean, reason?: string): Promise<void> {
  const r = await fetch(`/api/review/${encodeURIComponent(token)}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ideaId, decision: approved ? 'approved' : 'rejected', reason }),
  })
  if (!r.ok) throw new Error("Couldn't save your answer.")
}

// The token in /review/<token>, or null on any other path.
export function reviewTokenFromPath(path: string): string | null {
  const m = /^\/review\/([A-Za-z0-9_-]+)\/?$/.exec(path)
  return m ? m[1] : null
}

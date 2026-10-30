import type { ClientEvent, Format, SavedIdea, Video } from '../types'

// What the manager decided on one plan. The comment is the change asked for, or the reason it was sent back.
export interface Decision {
  kind: ClientEvent['kind']
  comment?: string
  // Comments per shot, keyed by shot index.
  shotComments?: Record<number, string>
}

export const decisionLabel: Record<ClientEvent['kind'], string> = {
  approved: 'Approved',
  'approved-with-changes': 'Approved with changes',
  'sent-back': 'Sent back',
}

// The idea after a decision. "Approved with changes" is status 'approved' plus managerNote.
export function applyDecision(idea: SavedIdea, d: Decision, at: number): SavedIdea {
  const approved = d.kind !== 'sent-back'
  const comments = Object.fromEntries(Object.entries(d.shotComments ?? {}).filter(([, c]) => c.trim()))
  return {
    ...idea,
    status: approved ? 'approved' : 'rejected',
    approvedAt: approved ? at : undefined,
    managerNote: d.kind === 'approved-with-changes' ? d.comment : undefined,
    rejectReason: approved ? undefined : d.comment,
    shotComments: Object.keys(comments).length ? comments : undefined,
  }
}

// "4 approved, 1 sent back". Approved with changes counts as approved, and is also called out.
export function memorySummary(events: ClientEvent[]): string {
  const count = (k: ClientEvent['kind']) => events.filter((e) => e.kind === k).length
  const changes = count('approved-with-changes')
  const approved = count('approved') + changes
  const back = count('sent-back')
  return [
    `${approved} approved${changes ? ` (${changes} with changes)` : ''}`,
    `${back} sent back`,
  ].join(', ')
}

// The plan's name for the memory list: format and the reference hook.
export function planTitle(
  ideaId: string,
  ideas: SavedIdea[],
  videoById: Map<string, Video>,
  formatById: Map<string, Format>,
): { title: string; detail?: string } {
  const idea = ideas.find((i) => i.id === ideaId)
  const v = idea && videoById.get(idea.videoId)
  const f = v && formatById.get(v.formatId)
  if (!v || !f) return { title: 'A plan that was removed' }
  return { title: f.name, detail: `Reference: "${v.hook}"` }
}

import type { Client, ClientEvent, Decision as Answer, Format, SavedIdea, Video } from '../types'

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
  const answer: Answer = { decision: approved ? 'approved' : 'rejected', decidedAt: at }
  if (!approved && d.comment) answer.reason = d.comment
  return {
    ...idea,
    status: approved ? 'approved' : 'rejected',
    decidedAt: at,
    history: [...(idea.history ?? []), answer],
    rejectTags: undefined,
    approvedAt: approved ? at : undefined,
    managerNote: d.kind === 'approved-with-changes' ? d.comment : undefined,
    rejectReason: approved ? undefined : d.comment,
    shotComments: Object.keys(comments).length ? comments : undefined,
  }
}

// Every decision on this client's plans, oldest first: the events recorded in this browser plus the answers kept on the
// plans themselves (which is where an answer from the review link arrives). The same answer is not listed twice.
export function memoryEvents(client: Client, ideas: SavedIdea[]): ClientEvent[] {
  const events = [...(client.memory ?? [])]
  const seen = new Set(events.map((e) => `${e.ideaId}-${e.at}`))
  for (const idea of ideas) {
    if (idea.clientId !== client.id) continue
    for (const h of idea.history ?? []) {
      if (seen.has(`${idea.id}-${h.decidedAt}`)) continue
      events.push({
        ideaId: idea.id,
        kind: h.decision === 'approved' ? 'approved' : 'sent-back',
        reason: h.reason,
        tags: h.tags,
        at: h.decidedAt,
      })
    }
  }
  return events.sort((a, b) => a.at - b.at)
}

// The last time the approver sent this plan back, if ever. Still available after the team sends it again.
export function lastSentBack(idea: SavedIdea): Answer | undefined {
  return [...(idea.history ?? [])].reverse().find((h) => h.decision === 'rejected')
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

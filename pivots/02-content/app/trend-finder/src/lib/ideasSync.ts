import type { SavedIdea } from '../types'

const same = (a: SavedIdea, b: SavedIdea) => JSON.stringify(a) === JSON.stringify(b)

// The ideas in `now` that are new or different from `base` (the list the server last held).
export function changedIdeas(base: SavedIdea[], now: SavedIdea[]): SavedIdea[] {
  const before = new Map(base.map((i) => [i.id, i]))
  return now.filter((i) => {
    const old = before.get(i.id)
    return !old || !same(old, i)
  })
}

// Another tab saved first. Start from its list and apply what this tab changed since `base`:
// new or edited ideas replace theirs, ideas this tab deleted go (unless the other tab edited them too).
export function rebaseIdeas(base: SavedIdea[], mine: SavedIdea[], theirs: SavedIdea[]): SavedIdea[] {
  const baseById = new Map(base.map((i) => [i.id, i]))
  const mineById = new Map(mine.map((i) => [i.id, i]))
  const edited = new Map(changedIdeas(base, mine).map((i) => [i.id, i]))
  const out: SavedIdea[] = []
  const seen = new Set<string>()
  for (const t of theirs) {
    seen.add(t.id)
    const b = baseById.get(t.id)
    if (b && !mineById.has(t.id)) {
      if (same(b, t)) continue // deleted here, untouched there
      out.push(t)
      continue
    }
    out.push(edited.get(t.id) ?? t)
  }
  for (const e of edited.values()) if (!seen.has(e.id)) out.push(e)
  return out
}

// Edits saved in this browser before a sign-in interrupted them, laid over the server's list.
export function applyDraft(remote: SavedIdea[], draft: SavedIdea[]): SavedIdea[] {
  const byId = new Map(draft.map((i) => [i.id, i]))
  const out = remote.map((i) => byId.get(i.id) ?? i)
  const have = new Set(remote.map((i) => i.id))
  return [...out, ...draft.filter((i) => !have.has(i.id))]
}

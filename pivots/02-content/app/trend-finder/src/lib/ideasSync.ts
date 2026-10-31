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

const canon = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)]))
      : v

// True when both lists hold the same ideas in the same order, whatever order the fields were written in.
export function sameIdeaList(a: SavedIdea[], b: SavedIdea[]): boolean {
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b))
}

// Keeps the edits the server has not confirmed in sessionStorage, so a reload before signing back in doesn't lose them.
// `confirmed` is the list the server last acknowledged (not the one a save in flight is about to become).
export function keepUnsavedDraft(
  confirmed: SavedIdea[] | null,
  now: SavedIdea[],
  key: string,
  storage: Pick<Storage, 'setItem'>,
): void {
  try {
    const draft = changedIdeas(confirmed ?? [], now)
    if (draft.length) storage.setItem(key, JSON.stringify(draft))
  } catch {
    // Without storage the edits are still kept while this tab stays open.
  }
}

// The items in `list` that are not this app's built-in samples.
export function withoutSamples<T extends { id: string }>(list: T[], samples: { id: string }[]): T[] {
  const ids = new Set(samples.map((s) => s.id))
  return list.filter((x) => !ids.has(x.id))
}

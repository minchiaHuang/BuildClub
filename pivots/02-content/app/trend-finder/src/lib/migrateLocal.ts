import type { SavedIdea } from '../types'

// The ideas an older version kept only in this browser move to the server once. After that the server is the
// only copy that counts, so signing in again or reloading can never upload them twice or overwrite what it holds.
export function pickInitialIdeas(
  remote: SavedIdea[] | null,
  local: SavedIdea[] | null,
  alreadyMigrated: boolean,
): { ideas: SavedIdea[]; upload: boolean } {
  if (alreadyMigrated || remote) return { ideas: remote ?? [], upload: false }
  return local?.length ? { ideas: local, upload: true } : { ideas: [], upload: false }
}

export const MIGRATED_KEY = 'trend-finder.migrated.v1'

export function wasMigrated(): boolean {
  try {
    return localStorage.getItem(MIGRATED_KEY) === '1'
  } catch {
    return false
  }
}

export function markMigrated(): void {
  try {
    localStorage.setItem(MIGRATED_KEY, '1')
  } catch {
    // Storage blocked: the server copy still wins next time, because remote is not null by then.
  }
}

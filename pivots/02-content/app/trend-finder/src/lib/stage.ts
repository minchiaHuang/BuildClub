import type { SavedIdea, Stage } from '../types'
import { t } from './i18n.ts'

// Production stages of an approved plan, in order.
export const STAGES: Stage[] = ['approved', 'filming', 'editing', 'posted']

// Getters, so the label follows the language on show.
export const STAGE_LABEL: Record<Stage, string> = {
  get approved() {
    return t('home.stage.approved')
  },
  get filming() {
    return t('home.stage.filming')
  },
  get editing() {
    return t('home.stage.editing')
  },
  get posted() {
    return t('home.stage.posted')
  },
}

// An approved plan's stage (none set means ready to film); null for any plan not approved.
export function stageOf(idea: SavedIdea): Stage | null {
  return idea.status === 'approved' ? (idea.stage ?? 'approved') : null
}

// The patch that moves a plan to `stage`, or null when it isn't approved. The posted date is set on the
// first move to posted and cleared when it moves back.
export function moveTo(idea: SavedIdea, stage: Stage, now = Date.now()): Partial<SavedIdea> | null {
  if (idea.status !== 'approved') return null
  const postedAt = stage === 'posted' ? (idea.stage === 'posted' && idea.postedAt ? idea.postedAt : now) : undefined
  return { stage, postedAt }
}

// Plans posted in the same local calendar month as `now`.
export function postedThisMonth(ideas: SavedIdea[], now = new Date()): number {
  return ideas.filter((i) => {
    if (stageOf(i) !== 'posted' || !i.postedAt) return false
    const d = new Date(i.postedAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
}

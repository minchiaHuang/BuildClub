import type { SavedIdea, Shot } from '../types'
import { moveTo } from './stage.ts'
import { t, tp } from './i18n.ts'

// The six steps of a video, in order. A card's step is worked out from its data every time (stepOf), never stored.
export type Step = 'idea' | 'script' | 'storyboard' | 'filming' | 'editing' | 'posted'

export const STEPS: Step[] = ['idea', 'script', 'storyboard', 'filming', 'editing', 'posted']

// Getters, so the label follows the language on show.
export const STEP_LABEL: Record<Step, string> = {
  get idea() {
    return t('home.step.idea')
  },
  get script() {
    return t('home.step.script')
  },
  get storyboard() {
    return t('home.step.storyboard')
  },
  get filming() {
    return t('home.step.filming')
  },
  get editing() {
    return t('home.step.editing')
  },
  get posted() {
    return t('home.step.posted')
  },
}

// What the idea's own record cannot say: a finished video, a post that went out, and when anything last happened
// (a take, the video, a post). All come from GET /api/production; missing means "not known".
export interface Signals {
  cut?: boolean
  published?: boolean
  activityAt?: number | null
}

export const STUCK_DAYS = 3
const DAY = 86_400_000

const hasLine = (s: Shot) => !!s.line?.trim()
const hasFrame = (s: Shot) => !!s.frameImage?.trim()

export function shotNeeds(shots: Shot[]) {
  return { shots: shots.length, lines: shots.filter((s) => !hasLine(s)).length, frames: shots.filter((s) => !hasFrame(s)).length }
}

// Where a plan is now.
//   Idea       saved, and no shot has a line yet
//   Script     at least one line, not every shot has a frame, not sent
//   Storyboard every shot has a frame, or the plan was sent for approval and is not approved yet
//   Filming    approved, stage Ready to film or Filming
//   Editing    approved, and the stage is Editing or a finished video exists
//   Posted     stage Posted, or a post went out
// `shots` are the plan's own shots (old plans have no lines or frames, so they read as Idea).
export function stepOf(idea: SavedIdea, shots: Shot[], signals: Signals = {}): Step {
  if (signals.published || (idea.status === 'approved' && idea.stage === 'posted')) return 'posted'
  if (idea.status === 'approved') return idea.stage === 'editing' || signals.cut ? 'editing' : 'filming'
  if (idea.status === 'waiting') return 'storyboard'
  if (shots.length > 0 && shots.every(hasFrame)) return 'storyboard'
  return shots.some(hasLine) ? 'script' : 'idea'
}

// What moves the card on, in a few words.
export function nextAction(idea: SavedIdea, shots: Shot[], signals: Signals, who: { canDecide: boolean; manager: string }): string {
  const step = stepOf(idea, shots, signals)
  const need = shotNeeds(shots)
  if (idea.status === 'rejected') return t('home.step.fixAndResend')
  switch (step) {
    case 'idea':
    case 'script':
      if (need.shots === 0) return t('home.step.addShotList')
      if (need.lines > 0) return tp('home.step.writeLines', need.lines)
      return tp('home.step.makeFrames', need.frames)
    case 'storyboard':
      if (idea.status !== 'waiting') return t('home.step.sendForApproval')
      return who.canDecide ? t('home.step.approveOrBack') : t('home.step.waitingFor', { name: who.manager })
    case 'filming':
      return t('home.step.filmShots')
    case 'editing':
      return signals.cut ? t('home.step.approveThenPost') : t('home.step.makeVideo')
    case 'posted':
      return t('home.step.posted')
  }
}

export interface Flags {
  stuckDays?: number
  overdueDays?: number
}

// Local midnight of a "YYYY-MM-DD", or null.
function dayStart(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null
}

// Stuck: nothing has changed for 3 days (the newest of the plan's own save time, its decisions and the activity
// the API sees: takes, the video, posts). A plan with no timestamp at all is not flagged, since we cannot tell.
// Overdue: the due date is a day or more ago. A posted card has neither.
export function flagsOf(idea: SavedIdea, step: Step, signals: Signals, now = Date.now()): Flags {
  if (step === 'posted') return {}
  const flags: Flags = {}
  const seen = [idea.updatedAt, signals.activityAt, idea.decidedAt, idea.sentAt, idea.approvedAt].filter(
    (t): t is number => typeof t === 'number' && t > 0,
  )
  if (seen.length) {
    const days = Math.floor((now - Math.max(...seen)) / DAY)
    if (days >= STUCK_DAYS) flags.stuckDays = days
  }
  const due = dayStart(idea.dueDate)
  if (due !== null) {
    const d = new Date(now)
    const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const late = Math.round((today - due) / DAY)
    if (late >= 1) flags.overdueDays = late
  }
  return flags
}

// The change a drop on `target` makes, or null when a drop there means nothing. Dropping on a step never sets it
// directly: a plan only gets there by being sent, approved or staged, and targetsOf checks the result.
//   Storyboard  send for approval (a saved plan) or take the approval back (an approved one)
//   Filming     approve (a waiting plan, manager only; the board does it through onDecide), or back from Editing
//   Editing, Posted  the stage of an approved plan
export function patchFor(idea: SavedIdea, target: Step, _signals: Signals, canDecide: boolean, now = Date.now()): Partial<SavedIdea> | null {
  if (target === 'storyboard') {
    if (idea.status === 'approved') {
      return { status: 'waiting', sentAt: now, rejectReason: undefined, rejectTags: undefined, approvedAt: undefined, managerNote: undefined, shotComments: undefined, stage: undefined, postedAt: undefined }
    }
    if (idea.status === 'saved' || idea.status === 'rejected') return { status: 'waiting', sentAt: now, rejectReason: undefined, rejectTags: undefined }
    return null
  }
  if (target === 'filming') {
    if (idea.status === 'waiting') return canDecide ? { status: 'approved' } : null
    return moveTo(idea, 'approved', now)
  }
  if (target === 'editing') return moveTo(idea, 'editing', now)
  if (target === 'posted') return moveTo(idea, 'posted', now)
  return null
}

// The steps this card may be dropped on. A drop must really land there: the result is run through stepOf, so a
// card with a finished video cannot be dragged back to Filming, and nothing fakes Idea or Script.
export function targetsOf(idea: SavedIdea, shots: Shot[], signals: Signals, canDecide: boolean): Step[] {
  const here = stepOf(idea, shots, signals)
  return STEPS.filter((t) => {
    if (t === here) return false
    // Sending a plan for approval needs something to approve.
    if (t === 'storyboard' && idea.status !== 'approved' && shots.length === 0) return false
    const patch = patchFor(idea, t, signals, canDecide)
    if (!patch) return false
    return stepOf({ ...idea, ...patch }, shots, signals) === t
  })
}

// Taking an approval back (dropping an approved plan on Storyboard) asks first, like the plan page's Edit button.
export function needsConfirm(idea: SavedIdea, to: Step): boolean {
  return idea.status === 'approved' && to === 'storyboard'
}

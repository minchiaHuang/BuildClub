import type { KeyboardCoordinateGetter } from '@dnd-kit/core'
import type { Format, SavedIdea, Video } from '../../types'
import { STEPS } from '../../lib/steps.ts'
import type { Step } from '../../lib/steps.ts'
import { getActiveLang, t } from '../../lib/i18n'

// The Plans board columns, left to right: the six steps of a video.
export const COLUMNS: Step[] = STEPS

export const columnTitle = (step: Step): string => t(`plan.step.${step}`)

// The plan's name on the board: the format name, or how a live video starts.
export const planName = (v: Video, f?: Format) => (v.live ? v.hook : (f?.name ?? v.hook))


// Shots the team has written. A saved idea needs its own; one already sent uses the reference's, like the plan does.
export const shotsOf = (idea: SavedIdea, f?: Format) => idea.shots ?? (idea.status === 'saved' ? [] : (f?.shotList ?? []))

// "Nov 13" from "2026-11-13".
export const dueLabel = (iso: string) =>
  new Date(`${iso}T00:00`).toLocaleDateString(getActiveLang() === 'zh-Hant' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' })

export interface DragData {
  step: Step
  targets: Step[]
}

// Keyboard dragging: left and right arrows jump between the plan's own column and the columns it can go to.
export const columnKeys: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0
  const data = context.active?.data.current as DragData | undefined
  const box = context.collisionRect
  if (!step || !data || !box) return undefined
  event.preventDefault()
  const stops = COLUMNS.filter((c) => c === data.step || data.targets.includes(c))
    .map((c) => document.getElementById(`board-${c}`)?.getBoundingClientRect())
    .filter((r): r is DOMRect => !!r)
  if (!stops.length) return undefined
  const mid = currentCoordinates.x + box.width / 2
  const at = stops.reduce(
    (best, r, i) => (Math.abs(r.left + r.width / 2 - mid) < Math.abs(stops[best].left + stops[best].width / 2 - mid) ? i : best),
    0,
  )
  const next = stops[Math.min(Math.max(at + step, 0), stops.length - 1)]
  const top = next.top + 8
  return {
    x: next.left + next.width / 2 - box.width / 2,
    y: Math.min(Math.max(currentCoordinates.y, top), Math.max(top, next.bottom - box.height - 8)),
  }
}

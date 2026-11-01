import type { KeyboardCoordinateGetter } from '@dnd-kit/core'
import type { Format, IdeaStatus, SavedIdea, Video } from '../../types'

// The Plans board columns, left to right. Each column is one idea status.
export const COLUMNS: IdeaStatus[] = ['saved', 'waiting', 'approved']

export const columnTitle: Record<IdeaStatus, string> = {
  saved: 'Still planning',
  waiting: 'Waiting for approval',
  approved: 'Approved, ready to film',
  rejected: 'Sent back to fix',
}

// The plan's name on the board: the format name, or how a live video starts.
export const planName = (v: Video, f?: Format) => (v.live ? v.hook : (f?.name ?? v.hook))


// Shots the team has written. A saved idea needs its own; one already sent uses the reference's, like the plan does.
export const shotsOf = (idea: SavedIdea, f?: Format) => idea.shots ?? (idea.status === 'saved' ? [] : (f?.shotList ?? []))

// Where a plan can be moved: any other column, both ways. Only the manager can drop into Approved.
// A sent-back plan sits in Still planning, so it moves like one.
export function targetsFrom(from: IdeaStatus, canDecide: boolean): IdeaStatus[] {
  const at = from === 'rejected' ? 'saved' : from
  return COLUMNS.filter((c) => c !== at && (c !== 'approved' || canDecide))
}

// "Nov 13" from "2026-11-13".
export const dueLabel = (iso: string) =>
  new Date(`${iso}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export interface DragData {
  status: IdeaStatus
  targets: IdeaStatus[]
}

// Keyboard dragging: left and right arrows jump between the plan's own column and the columns it can go to.
export const columnKeys: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0
  const data = context.active?.data.current as DragData | undefined
  const box = context.collisionRect
  if (!step || !data || !box) return undefined
  event.preventDefault()
  const stops = COLUMNS.filter((c) => c === data.status || data.targets.includes(c))
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

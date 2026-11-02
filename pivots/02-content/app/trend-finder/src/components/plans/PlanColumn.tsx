import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { IdeaStatus } from '../../types'
import { columnTitle } from './moves'

interface Props {
  status: IdeaStatus
  count: number
  // While a plan is being dragged: can it be dropped here? null when nothing is being dragged.
  canDrop: boolean | null
  empty: string
  extra?: ReactNode
  children?: ReactNode
}

// One column of the Plans board. Only columns the dragged plan can move to take a drop.
export function PlanColumn(p: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: p.status, disabled: p.canDrop !== true })
  const drop = p.canDrop === null ? undefined : p.canDrop ? (isOver ? 'over' : 'yes') : 'no'
  const title = columnTitle[p.status]
  return (
    <section
      ref={setNodeRef}
      id={`board-${p.status}`}
      className={`plans-col plans-col-${p.status}`}
      data-drop={drop}
      aria-label={`${title}, ${p.count}`}
    >
      <header className="plans-col-head">
        <h2>
          {title} <span className="plans-count">· {p.count}</span>
        </h2>
      </header>
      {p.extra}
      {p.children ?? <p className="board-empty small muted">{p.empty}</p>}
    </section>
  )
}

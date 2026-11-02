import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Step } from '../../lib/steps.ts'
import { columnTitle } from './moves'
import { t } from '../../lib/i18n'

interface Props {
  step: Step
  count: number
  // While a plan is being dragged: can it be dropped here? null when nothing is being dragged.
  canDrop: boolean | null
  empty: string
  extra?: ReactNode
  children?: ReactNode
}

// One column of the Plans board. Only columns the dragged plan can move to take a drop.
export function PlanColumn(p: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: p.step, disabled: p.canDrop !== true })
  const drop = p.canDrop === null ? undefined : p.canDrop ? (isOver ? 'over' : 'yes') : 'no'
  const title = columnTitle(p.step)
  return (
    <section
      ref={setNodeRef}
      id={`board-${p.step}`}
      className={`plans-col pb-col plans-col-${p.step}`}
      data-drop={drop}
      aria-label={t('plan.col.aria', { title, n: p.count })}
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

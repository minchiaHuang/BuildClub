import type { Format, IdeaStage, SavedIdea, Video } from '../types'
import { dueLabel, formatDay } from '../lib/dates'
import { Thumb } from './Thumb'

const STAGES: { id: IdeaStage; label: string }[] = [
  { id: 'approved', label: 'Approved' },
  { id: 'filming', label: 'Filming' },
  { id: 'editing', label: 'Editing' },
  { id: 'posted', label: 'Posted' },
]

// An approved idea nobody has moved yet is still in the first column.
const stageOf = (idea: SavedIdea): IdeaStage => idea.stage ?? 'approved'

interface Props {
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  onMove: (ideaId: string, stage: IdeaStage) => void
  onOpen: (ideaId: string) => void
}

export function TrackingBoard({ ideas, videoById, formatById, onMove, onOpen }: Props) {
  return (
    <div className="board">
      {STAGES.map((col, n) => {
        const cards = ideas.filter((i) => stageOf(i) === col.id)
        return (
          <section key={col.id} className="board-col" aria-label={col.label}>
            <h2 className="board-head">
              {col.label} <span className="pill">{cards.length}</span>
            </h2>
            <ul className="board-cards">
              {cards.map((idea) => {
                const v = videoById.get(idea.videoId)
                if (!v) return null
                return (
                  <li key={idea.id} className="idea board-card">
                    <button className="board-open" onClick={() => onOpen(idea.id)}>
                      <Thumb video={v} />
                      <span className="idea-body">
                        <strong>{formatById.get(v.formatId)?.name}</strong>
                        {col.id === 'posted' ? (
                          <span className="small muted">{idea.postedAt ? `Posted ${formatDay(idea.postedAt)}` : `Due ${formatDay(idea.dueDate)}`}</span>
                        ) : (
                          <span className={`small ${dueLabel(idea.dueDate).late ? 'due-soon' : 'muted'}`}>{dueLabel(idea.dueDate).text}</span>
                        )}
                      </span>
                    </button>
                    <div className="board-moves">
                      {n > 0 && (
                        <button className="btn btn-ghost btn-sm" onClick={() => onMove(idea.id, STAGES[n - 1].id)}>
                          ← {STAGES[n - 1].label}
                        </button>
                      )}
                      {n < STAGES.length - 1 && (
                        <button className="btn btn-primary btn-sm" onClick={() => onMove(idea.id, STAGES[n + 1].id)}>
                          {STAGES[n + 1].label} →
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

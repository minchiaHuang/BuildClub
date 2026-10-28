import { useState } from 'react'
import type { Client, Format, IdeaStage, SavedIdea, Video } from '../types'
import { Thumb } from './Thumb'
import { TrackingBoard } from './TrackingBoard'

// The client's own shots if edited, otherwise the reference format's.
const shotCount = (idea: SavedIdea, f?: Format) => (idea.shots ?? f?.shotList ?? []).length

interface Props {
  client: Client
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  onOpen: (ideaId: string) => void
  onMove: (ideaId: string, stage: IdeaStage) => void
  onGoApprovals: () => void
}

export function PlansScreen({ client, ideas, videoById, onOpen, onMove, onGoApprovals, formatById }: Props) {
  const [mode, setMode] = useState<'list' | 'board'>('list')
  const approved = ideas
    .filter((i) => i.clientId === client.id && i.status === 'approved')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return (
    <section className="plans">
      <header className="page-head">
        <span className="eyebrow">{client.name} · Plans</span>
        <h1>Ready to film</h1>
        <p className="muted">Approved ideas, soonest due first. Open one to copy the brief for your editor.</p>
      </header>

      {approved.length > 0 && (
        <div className="view-switch" role="group" aria-label="Plans view">
          {(['list', 'board'] as const).map((m) => (
            <button key={m} className={`btn btn-sm ${mode === m ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === 'list' ? 'List' : 'Board'}
            </button>
          ))}
        </div>
      )}

      {approved.length === 0 ? (
        <div className="empty">
          <h2>No approved ideas yet</h2>
          <p>Once Annie approves an idea, its plan shows up here.</p>
          <button className="btn btn-primary" onClick={onGoApprovals}>
            Go to approvals
          </button>
        </div>
      ) : mode === 'board' ? (
        <TrackingBoard ideas={approved} videoById={videoById} formatById={formatById} onMove={onMove} onOpen={onOpen} />
      ) : (
        <ul className="idea-list">
          {approved.map((idea) => {
            const v = videoById.get(idea.videoId)
            if (!v) return null
            const f = formatById.get(v.formatId)
            return (
              <li key={idea.id} className="idea">
                <Thumb video={v} />
                <div className="idea-body">
                  <span className="plan-due">
                    Due <strong>{idea.dueDate}</strong>
                  </span>
                  <strong>{f?.name}</strong>
                  <span className="small muted">
                    {shotCount(idea, f) ? `${shotCount(idea, f)} shots · ${f?.props.length ?? 0} props` : 'Shots still to write'}
                  </span>
                </div>
                <div className="idea-actions">
                  <button className="btn btn-primary" onClick={() => onOpen(idea.id)}>
                    Open plan
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

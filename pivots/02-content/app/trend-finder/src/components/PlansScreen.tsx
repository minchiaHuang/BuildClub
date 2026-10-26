import type { Client, Format, SavedIdea, Video } from '../types'
import { Thumb } from './Thumb'

interface Props {
  client: Client
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  onOpen: (ideaId: string) => void
  onGoApprovals: () => void
}

export function PlansScreen({ client, ideas, videoById, onOpen, onGoApprovals, formatById }: Props) {
  const approved = ideas
    .filter((i) => i.clientId === client.id && i.status === 'approved')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return (
    <section className="plans">
      <header className="page-head">
        <span className="eyebrow">{client.name} · Recreate plans</span>
        <h1>Ready to film</h1>
        <p className="muted">Approved ideas with a shot list and editor brief, soonest due first.</p>
      </header>

      {approved.length === 0 ? (
        <div className="empty">
          <h2>No approved ideas yet</h2>
          <p>Once Annie approves an idea, its recreate plan shows up here.</p>
          <button className="btn btn-primary" onClick={onGoApprovals}>
            Go to approvals
          </button>
        </div>
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
                  <span className="small muted">Due {idea.dueDate}</span>
                  <strong>{f?.name}</strong>
                  <span className="small muted">
                    {f?.shotList.length ? `${f.shotList.length} shots · ${f.props.length} props` : 'Shot list to write from the reference'}
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

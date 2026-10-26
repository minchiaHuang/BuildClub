import type { Client, IdeaStatus, SavedIdea, Video } from '../types'
import { formats } from '../data/sample'
import { compact, outlierScore, times } from '../lib/metrics'
import { Thumb } from './Thumb'

interface Props {
  client: Client
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  setStatus: (ids: string[], status: IdeaStatus) => void
  onGoSaved: () => void
}

export function ApprovalsScreen({ client, ideas, videoById, setStatus, onGoSaved }: Props) {
  const mine = ideas.filter((i) => i.clientId === client.id)
  const waiting = mine.filter((i) => i.status === 'waiting')
  const decided = mine.filter((i) => i.status === 'approved' || i.status === 'rejected')

  const card = (idea: SavedIdea, actions: boolean) => {
    const v = videoById.get(idea.videoId)
    if (!v) return null
    const f = formats.find((x) => x.id === v.formatId)
    return (
      <li key={idea.id} className="approval">
        <Thumb video={v} />
        <div className="idea-body">
          {!actions && <span className={`status status-${idea.status}`}>{idea.status === 'approved' ? 'Approved' : 'Rejected'}</span>}
          <strong>{f?.name}</strong>
          <span className="small muted">
            Reference: "{v.hook}" · {compact(v.views)} views · {times(outlierScore(v))} usual
          </span>
        </div>
        {actions ? (
          <div className="approval-actions">
            <button className="approve" onClick={() => setStatus([idea.id], 'approved')}>
              ✓ Approve
            </button>
            <button className="reject" onClick={() => setStatus([idea.id], 'rejected')}>
              ✕ Reject
            </button>
          </div>
        ) : (
          <button className="link-btn" onClick={() => setStatus([idea.id], 'waiting')}>
            Undo
          </button>
        )}
      </li>
    )
  }

  return (
    <section className="approvals">
      <header className="page-head">
        <span className="eyebrow">{client.name} · Approvals</span>
        <h1>{waiting.length ? `${waiting.length} waiting for Annie` : 'Nothing waiting'}</h1>
        <p className="muted">Ideas sent for approval. Annie can approve here, or from her phone.</p>
      </header>

      {waiting.length === 0 ? (
        <div className="empty">
          <h2>All caught up</h2>
          <p>Send saved ideas for approval and they'll show up here.</p>
          <button className="btn btn-primary" onClick={onGoSaved}>
            Go to saved ideas
          </button>
        </div>
      ) : (
        <ul className="idea-list">{waiting.map((i) => card(i, true))}</ul>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="sub-head">Decided</h2>
          <ul className="idea-list">{decided.map((i) => card(i, false))}</ul>
        </>
      )}
    </section>
  )
}

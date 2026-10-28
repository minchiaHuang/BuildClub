import type { Client, Format, IdeaStatus, SavedIdea, Video } from '../types'
import { compact, hasScore, times, outlierScore, viewsWord } from '../lib/metrics'
import { Thumb } from './Thumb'

interface Props {
  client: Client
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  setStatus: (ideaIds: string[], status: IdeaStatus) => void
  onRemove: (ideaId: string) => void
  onPlan: (ideaId: string) => void
  onFindMore: () => void
}

const statusLabel: Record<IdeaStatus, string> = {
  saved: 'Not sent yet',
  waiting: 'Waiting for Annie',
  approved: 'Approved',
  rejected: 'Not approved',
}

// Small SVG ring for a monthly target. The fill grows in once on mount (CSS), then follows the value.
export function ProgressRing({
  value,
  size = 28,
  stroke = 4,
  tone,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: 'behind'
}) {
  const r = (size - stroke) / 2
  const pct = Math.max(0, Math.min(100, value))
  return (
    <svg
      className={`ring ${tone ? `ring-${tone}` : ''} ${pct === 0 ? 'ring-empty' : ''}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle
        className="ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        pathLength={100}
        style={{ '--ring-offset': 100 - pct } as React.CSSProperties}
      />
    </svg>
  )
}

export function ClientScreen(p: Props) {
  const client = p.client
  const mine = p.ideas.filter((i) => i.clientId === client.id)
  const count = (s: IdeaStatus) => mine.filter((i) => i.status === s).length
  const unsent = mine.filter((i) => i.status === 'saved')
  const approved = count('approved')
  const progress = Math.min(approved / client.monthlyTarget, 1) * 100

  return (
    <section className="client">
      <header className="client-head">
        <div>
          <span className="eyebrow">{client.name} · Saved ideas</span>
          <h1>Saved ideas</h1>
          <p className="muted">
            {client.niche} · Audience: {client.audience}
          </p>
        </div>
        <div className="target">
          <ProgressRing value={progress} size={56} stroke={6} />
          <div className="target-text">
            <span className="target-num">
              {approved} <span className="muted">of {client.monthlyTarget}</span>
            </span>
            <span className="small muted">videos approved this month</span>
          </div>
        </div>
      </header>

      <div className="status-row">
        <span className="pill">{count('saved')} not sent</span>
        <span className="pill pill-wait">{count('waiting')} waiting</span>
        <span className="pill pill-ok">{approved} approved</span>
        <span className="pill pill-no">{count('rejected')} not approved</span>
        {unsent.length > 0 && (
          <span className="small muted">Open an idea's plan to send it to Annie with your shots and a note.</span>
        )}
      </div>

      {mine.length === 0 ? (
        <div className="empty">
          <h2>No saved ideas yet</h2>
          <p>Save videos from the search results and they'll show up here, ready to plan and send for approval.</p>
          <button className="btn btn-primary" onClick={p.onFindMore}>
            Find trending videos
          </button>
        </div>
      ) : (
        <ul className="idea-list">
          {mine.map((idea) => {
            const v = p.videoById.get(idea.videoId)
            if (!v) return null
            const f = p.formatById.get(v.formatId)
            return (
              <li key={idea.id} className="idea">
                <Thumb video={v} />
                <div className="idea-body">
                  <span className={`status status-${idea.status}`}>{statusLabel[idea.status]}</span>
                  <strong>{f?.name}</strong>
                  <span className="small muted">
                    Reference: "{v.hook}" · {v.handle} · {compact(v.views)} {viewsWord(v)}{hasScore(v) && ` · ${times(outlierScore(v))}`}
                  </span>
                  {idea.status === 'approved' && <span className="small">Due {idea.dueDate}</span>}
                </div>
                <div className="idea-actions">
                  <button className="btn btn-ghost" onClick={() => p.onPlan(idea.id)}>
                    Open plan
                  </button>
                  <button className="link-btn" onClick={() => p.onRemove(idea.id)}>
                    Remove
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

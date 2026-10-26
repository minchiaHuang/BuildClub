import { useState } from 'react'
import type { Client, Format, IdeaStatus, SavedIdea, Video } from '../types'
import { compact, times, outlierScore } from '../lib/metrics'
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
  rejected: 'Rejected',
}

export function ClientScreen(p: Props) {
  const [phoneOpen, setPhoneOpen] = useState(false)
  const client = p.client
  const mine = p.ideas.filter((i) => i.clientId === client.id)
  const count = (s: IdeaStatus) => mine.filter((i) => i.status === s).length
  const unsent = mine.filter((i) => i.status === 'saved')
  const waiting = mine.filter((i) => i.status === 'waiting')
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
          <span className="target-num">
            {approved} <span className="muted">of {client.monthlyTarget}</span>
          </span>
          <span className="small muted">videos approved this month</span>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <div className="status-row">
        <span className="pill">{count('saved')} not sent</span>
        <span className="pill pill-wait">{count('waiting')} waiting</span>
        <span className="pill pill-ok">{approved} approved</span>
        <span className="pill pill-no">{count('rejected')} rejected</span>
        <span className="spacer" />
        {waiting.length > 0 && (
          <button className="btn btn-ghost" onClick={() => setPhoneOpen(true)}>
            See Annie's view
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={unsent.length === 0}
          onClick={() => {
            p.setStatus(
              unsent.map((i) => i.id),
              'waiting',
            )
            setPhoneOpen(true)
          }}
        >
          Send {unsent.length || ''} to Annie for approval
        </button>
      </div>

      {mine.length === 0 ? (
        <div className="empty">
          <h2>No saved ideas yet</h2>
          <p>Save videos from the search results and they'll show up here, ready to send for approval.</p>
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
                    Reference: "{v.hook}" · {v.handle} · {compact(v.views)} views · {times(outlierScore(v))}
                  </span>
                  {idea.status === 'approved' && <span className="small">Due {idea.dueDate}</span>}
                </div>
                <div className="idea-actions">
                  <button className="btn btn-ghost" onClick={() => p.onPlan(idea.id)}>
                    Recreate plan
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

      {phoneOpen && (
        <div className="phone-wrap" onClick={() => setPhoneOpen(false)}>
          <div
            className="phone"
            role="dialog"
            aria-modal="true"
            aria-label="Annie's approval view"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="phone-notch" />
            <div className="phone-head">
              <span className="small muted">What Annie sees on her phone</span>
              <strong>
                {client.name}: {waiting.length} to review
              </strong>
            </div>
            <div className="phone-list">
              {waiting.length === 0 && <p className="muted small">All done. Nothing waiting.</p>}
              {waiting.map((idea) => {
                const v = p.videoById.get(idea.videoId)!
                const f = p.formatById.get(v.formatId)
                return (
                  <div key={idea.id} className="phone-card">
                    <Thumb video={v} />
                    <div className="phone-card-body">
                      <strong>{f?.name}</strong>
                      <span className="small muted">{times(outlierScore(v))} usual views</span>
                      <div className="phone-actions">
                        <button className="yes" onClick={() => p.setStatus([idea.id], 'approved')}>
                          ✓ Approve
                        </button>
                        <button className="no" onClick={() => p.setStatus([idea.id], 'rejected')}>
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <button className="btn btn-ghost phone-close" onClick={() => setPhoneOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

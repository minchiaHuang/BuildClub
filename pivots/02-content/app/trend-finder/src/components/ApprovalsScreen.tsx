import { useEffect, useRef, useState } from 'react'
import type { Client, Format, IdeaStatus, SavedIdea, Video } from '../types'
import { compact, hasScore, outlierScore, times, viewsWord } from '../lib/metrics'
import { createShareLink, revokeShareLink } from '../lib/share'
import { Thumb } from './Thumb'

interface Props {
  client: Client
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  setStatus: (ids: string[], status: IdeaStatus) => void
  onGoSaved: () => void
  onPlan: (ideaId: string) => void
  onReview: () => void
  // The share link needs the API.
  live: boolean
}

export function ApprovalsScreen({ client, ideas, videoById, setStatus, onGoSaved, formatById, onPlan, onReview, live }: Props) {
  const [linkNote, setLinkNote] = useState('')
  const noteTimer = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(noteTimer.current), [])
  const flash = (text: string) => {
    setLinkNote(text)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setLinkNote(''), 2000)
  }
  const copyLink = () =>
    createShareLink(client.id)
      .then((l) => navigator.clipboard.writeText(l.url))
      .then(() => flash('Copied'))
      .catch(() => flash("Couldn't copy the link"))
  const turnOffLink = () =>
    createShareLink(client.id)
      .then((l) => revokeShareLink(l.token))
      .then(() => flash('Link turned off'))
      .catch(() => flash("Couldn't turn off the link"))

  const mine = ideas.filter((i) => i.clientId === client.id)
  const waiting = mine.filter((i) => i.status === 'waiting')
  const decided = mine.filter((i) => i.status === 'approved' || i.status === 'rejected')

  const card = (idea: SavedIdea, actions: boolean) => {
    const v = videoById.get(idea.videoId)
    if (!v) return null
    const f = formatById.get(v.formatId)
    return (
      <li key={idea.id} className="approval">
        <Thumb video={v} />
        <div className="idea-body">
          {!actions && <span className={`status status-${idea.status}`}>{idea.status === 'approved' ? 'Approved' : 'Not approved'}</span>}
          <strong>{f?.name}</strong>
          <span className="small muted">
            Reference: "{v.hook}" · {compact(v.views)} {viewsWord(v)}{hasScore(v) && ` · ${times(outlierScore(v))} usual`}
          </span>
        </div>
        <div className="idea-actions">
          <button className="btn btn-ghost" onClick={() => onPlan(idea.id)}>
            Open plan
          </button>
          {actions && (
            <button className="link-btn" onClick={() => setStatus([idea.id], 'saved')}>
              Withdraw
            </button>
          )}
        </div>
      </li>
    )
  }

  return (
    <section className="approvals">
      <header className="page-head">
        <span className="eyebrow">{client.name} · Approvals</span>
        <h1>{waiting.length ? `${waiting.length} waiting for Annie` : 'Nothing waiting'}</h1>
        <p className="muted">Ideas you've sent to Annie. Annie's answers show up here.</p>
        <div className="share-actions">
          {waiting.length > 0 && (
            <button className="btn btn-primary" onClick={onReview}>
              Review as Annie
            </button>
          )}
          {live && (
            <>
              <button className="btn btn-ghost" onClick={copyLink}>
                {linkNote === 'Copied' ? 'Copied' : 'Copy link for Annie'}
              </button>
              <button className="link-btn" onClick={turnOffLink}>
                Turn off link
              </button>
              <span className="small muted" role="status">
                {linkNote && linkNote !== 'Copied' ? linkNote : ''}
              </span>
            </>
          )}
        </div>
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

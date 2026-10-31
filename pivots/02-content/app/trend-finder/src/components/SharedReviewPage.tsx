import { useCallback, useEffect, useState } from 'react'
import type { Format, Video } from '../types'
import { compact, hasScore, outlierScore, times } from '../lib/metrics'
import { formatDay } from '../lib/dates'
import { AlreadyReviewed, LinkClosed, REJECT_TAGS, loadReview, sendDecision } from '../lib/share'
import type { Review, ReviewItem } from '../lib/share'
import { Thumb } from './Thumb'

// The approver's page, opened from the link the team shares: no sidebar and no sign-in.
export function SharedReviewPage({ token }: { token: string }) {
  // undefined = loading, null = the link is closed.
  const [review, setReview] = useState<Review | null | undefined>(undefined)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [answered, setAnswered] = useState<string[]>([])

  const load = useCallback(() => {
    setLoadError('')
    loadReview(token)
      .then(setReview)
      .catch((e: Error) => setLoadError(e.message))
  }, [token])
  useEffect(load, [load])

  // The answer is saved; the card is replaced by a line saying what was decided.
  const decided = (label: string) => {
    setAnswered((a) => [...a, label])
    setNotice('')
    load()
  }
  const alreadyReviewed = () => {
    setNotice('That plan was already reviewed. Here is what is still waiting.')
    load()
  }
  const closed = () => setReview(null)

  if (loadError && !review) {
    return (
      <main className="shared-review">
        <div className="empty">
          <h2>Something went wrong</h2>
          <p role="alert">{loadError}</p>
          <button className="btn btn-primary" onClick={load}>
            Try again
          </button>
        </div>
      </main>
    )
  }
  if (review === undefined) return <main className="shared-review" aria-busy="true" />
  if (review === null) {
    return (
      <main className="shared-review">
        <div className="empty">
          <h2>This link has been closed</h2>
          <p>Ask the person who sent it for a new link.</p>
        </div>
      </main>
    )
  }

  const n = review.ideas.length
  return (
    <main className="shared-review">
      <section className="review">
        <header className="page-head review-head">
          <span className="eyebrow">{review.client.name}</span>
          <h1>{n ? `${n} to review` : 'Nothing to review'}</h1>
        </header>
        {notice && (
          <p className="review-banner" role="status">
            {notice}
          </p>
        )}
        {loadError && (
          <p className="error" role="alert">
            {loadError}
          </p>
        )}
        {answered.map((a, i) => (
          <p key={i} className="shared-answered small" role="status">
            {a}
          </p>
        ))}
        {n === 0 && (
          <div className="empty">
            <h2>All decided</h2>
            <p>New plans sent for approval will show up here. You can close this page.</p>
          </div>
        )}
        <div className="review-stack">
          {review.ideas.map((item) => (
            <SharedCard
              key={item.idea.id}
              item={item}
              token={token}
              onDecided={decided}
              onAlreadyReviewed={alreadyReviewed}
              onClosed={closed}
            />
          ))}
        </div>
      </section>
    </main>
  )
}

interface CardProps {
  item: ReviewItem
  token: string
  onDecided: (label: string) => void
  onAlreadyReviewed: () => void
  onClosed: () => void
}

function SharedCard({ item, token, onDecided, onAlreadyReviewed, onClosed }: CardProps) {
  const { idea } = item
  const v: Video | undefined = item.video
  const f: Format | undefined = item.format
  const title = f?.name ?? v?.hook ?? 'Plan'
  const shots = idea.shots ?? f?.shotList ?? []
  const lastBack = [...(idea.history ?? [])].reverse().find((h) => h.decision === 'rejected')
  const [back, setBack] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  const send = (approved: boolean) => {
    if (busy) return
    setBusy(true)
    setError('')
    const reason = text.trim()
    sendDecision(token, idea.id, approved, approved ? undefined : reason || undefined, approved ? undefined : tags)
      .then(() => onDecided(`${approved ? 'Approved' : 'Sent back'}: ${title}`))
      .catch((e: Error) => {
        if (e instanceof AlreadyReviewed) return onAlreadyReviewed()
        if (e instanceof LinkClosed) return onClosed()
        setBusy(false)
        setError(`${e.message} Please try again.`)
      })
  }

  return (
    <article className="review-card shared-card" data-idea={idea.id} aria-label={title}>
      <div className="review-ref shared-ref">
        {v && <Thumb video={v} />}
        <div>
          <strong>{title}</strong>
          {v && (
            <span className="small muted">
              Reference: "{v.hook}" · {compact(v.views)} views{hasScore(v) && ` · ${times(outlierScore(v))} usual`}
            </span>
          )}
        </div>
      </div>
      <div className="review-meta">
        <span className="small muted">Due {formatDay(idea.dueDate)}</span>
      </div>
      {lastBack && (
        <div className="review-note">
          <span className="field-label">Sent back last time</span>
          {lastBack.tags && lastBack.tags.length > 0 && <span className="small">{lastBack.tags.join(' · ')}</span>}
          {lastBack.reason && <p className="quote">{lastBack.reason}</p>}
        </div>
      )}
      {idea.noteToApprover && (
        <div className="review-note">
          <span className="field-label">Note from the team</span>
          <p className="quote">{idea.noteToApprover}</p>
        </div>
      )}
      {shots.length > 0 && (
        <ol className="review-shots">
          {shots.map((s, i) => (
            <li key={i}>
              {s.shot}
              {s.text && <span className="shot-text"> Text: "{s.text}"</span>}
            </li>
          ))}
        </ol>
      )}
      {back ? (
        <div className="review-reject">
          <fieldset className="chip-group">
            <legend className="chip-group-title">What didn't work? Pick any that apply.</legend>
            <div className="chip-row">
              {REJECT_TAGS.map((t) => (
                <button key={t} type="button" className="cchip" aria-pressed={tags.includes(t)} onClick={() => toggle(t)}>
                  {t}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span className="field-label">Anything to add?</span>
            <textarea rows={3} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="review-actions">
            <button className="btn btn-ghost" onClick={() => setBack(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => send(false)} disabled={busy || (!tags.length && !text.trim())}>
              Send back
            </button>
          </div>
        </div>
      ) : (
        <div className="review-actions">
          <button className="btn btn-ghost" onClick={() => setBack(true)} disabled={busy}>
            Send back
          </button>
          <button className="btn btn-primary" onClick={() => send(true)} disabled={busy}>
            Approve
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}

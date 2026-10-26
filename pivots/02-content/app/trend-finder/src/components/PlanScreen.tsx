import { useState } from 'react'
import type { Client, Format, IdeaStatus, SavedIdea, Shot, Video } from '../types'
import { clientFit, compact, outlierScore, tierName, tierOf, times } from '../lib/metrics'
import { BestVideo } from './BestVideo'

interface Props {
  idea: SavedIdea
  video: Video
  format: Format
  client: Client
  onChange: (patch: Partial<SavedIdea>) => void
  onBack: () => void
  onFindMore: () => void
  onGoApprovals: () => void
  onPlanAnother: () => void
}

// Name of the person who approves ideas. Kept in one place so it's easy to change for a public demo.
const APPROVER = 'Annie'

const statusLabel: Record<IdeaStatus, string> = {
  saved: 'Not sent yet',
  waiting: `Waiting for ${APPROVER}`,
  approved: 'Approved',
  rejected: 'Not approved',
}

const ago = (ts?: number) => {
  if (!ts) return ''
  const mins = Math.round((Date.now() - ts) / 60_000)
  return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)}h ago`
}

export function PlanScreen({ idea, video, format, client, onChange, onBack, onFindMore, onGoApprovals, onPlanAnother }: Props) {
  // Last removed shot, so an accidental ✕ can be undone.
  const [removed, setRemoved] = useState<{ shot: Shot; index: number } | null>(null)

  const shots = idea.shots ?? format.shotList
  const editable = idea.status === 'saved' || idea.status === 'approved'
  const fit = clientFit(format, client)
  const score = outlierScore(video)
  const tier = tierOf(score)
  const defaultNote = `Fits ${client.audience.toLowerCase()}. ${fit.text}`
  const note = idea.noteToApprover ?? defaultNote

  const send = () => {
    onChange({ status: 'waiting', sentAt: Date.now(), noteToApprover: note, rejectReason: undefined })
    // Bring the confirmation into view.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const sendButton = (
    <button className="btn btn-primary" disabled={shots.length === 0} onClick={send}>
      Send to {APPROVER} for approval
    </button>
  )
  const setShots = (next: Shot[]) => onChange({ shots: next })
  const updateShot = (i: number, patch: Partial<Shot>) => setShots(shots.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  return (
    <section className="plan">
      <button className="link-btn" onClick={onBack}>
        ← Back to search results
      </button>

      <header className="plan-head">
        <div className="plan-head-row">
          <span className="eyebrow">Plan for {client.name}</span>
          {idea.status !== 'approved' && <span className={`status status-${idea.status}`}>{statusLabel[idea.status]}</span>}
        </div>
        <h1>{format.name}</h1>
      </header>

      {idea.status === 'waiting' && (
        <div className="sent-banner" role="status">
          <span className="sent-check" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Sent to {APPROVER} for approval</strong>
            <span>
              Sent {ago(idea.sentAt)}. Her answer will show up in Approvals. Meanwhile, plan the next video for{' '}
              {client.name}.
            </span>
          </div>
        </div>
      )}

      <div className="plan-grid">
        <aside className="plan-ref">
          <BestVideo video={video} />
          <div className="plan-ref-score">
            <span className="cmp-from">{compact(video.medianViews ?? video.followers)}</span>
            <span className="cmp-arrow" aria-hidden="true">
              →
            </span>
            <span className={`cmp-to score-${tier}`}>{compact(video.views)}</span>
          </div>
          <span className={`tier tier-${tier}`}>
            {tierName[tier]} · {times(score)}
          </span>
          <span className="small muted">
            Reference: {video.handle}
            {video.url && (
              <>
                {' · '}
                <a href={video.url} target="_blank" rel="noreferrer">
                  Watch on TikTok ↗
                </a>
              </>
            )}
          </span>
        </aside>

        <div className="plan-main">

          <section className="block">
            <h3>Shot suggestions</h3>
            <p className="small muted">
              {editable
                ? `Based on the reference video. Edit them for ${client.name}: what you'll film and any text on screen.`
                : `Locked while ${APPROVER} reviews it. Withdraw it to make changes.`}
            </p>
            {shots.length === 0 && !editable && <p className="muted small">No shots written yet.</p>}
            <ol className="shot-edit">
              {shots.map((s, i) => (
                <li key={i}>
                  {editable ? (
                    <>
                      <input
                        id={`shot-time-${i}`}
                        className="shot-time-input"
                        aria-label={`Shot ${i + 1} timing`}
                        value={s.time}
                        onChange={(e) => updateShot(i, { time: e.target.value })}
                      />
                      <div className="shot-fields">
                        <input
                          id={`shot-desc-${i}`}
                          aria-label={`Shot ${i + 1}: what we film`}
                          value={s.shot}
                          placeholder="What we film"
                          onChange={(e) => updateShot(i, { shot: e.target.value })}
                        />
                        <input
                          id={`shot-text-${i}`}
                          aria-label={`Shot ${i + 1}: text on screen`}
                          value={s.text ?? ''}
                          placeholder="Text on screen (optional)"
                          onChange={(e) => updateShot(i, { text: e.target.value || undefined })}
                        />
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove shot ${i + 1}`}
                        onClick={() => {
                          setRemoved({ shot: s, index: i })
                          setShots(shots.filter((_, j) => j !== i))
                        }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="shot-time">{s.time}</span>
                      <span>
                        {s.shot}
                        {s.text && <span className="shot-text">Text: "{s.text}"</span>}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ol>
            {editable && (
              <div className="shot-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShots([...shots, { time: '', shot: '' }])}
                >
                  + Add a shot
                </button>
                {removed && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      const next = [...shots]
                      next.splice(Math.min(removed.index, next.length), 0, removed.shot)
                      setShots(next)
                      setRemoved(null)
                    }}
                  >
                    Undo remove
                  </button>
                )}
                {idea.shots && format.shotList.length > 0 && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      onChange({ shots: undefined })
                      setRemoved(null)
                    }}
                  >
                    Reset to suggested shots
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="block">
            <label htmlFor="note-to-approver">
              <h3>Note to {APPROVER}</h3>
            </label>
            <textarea
              id="note-to-approver"
              rows={3}
              value={note}
              placeholder={`Why this would work for ${client.name}`}
              onChange={(e) => onChange({ noteToApprover: e.target.value })}
            />
          </section>

          {idea.status === 'rejected' && (
            <section className="block">
              <h3>{APPROVER}'s feedback</h3>
              <p className="quote">{idea.rejectReason || 'No reason given.'}</p>
            </section>
          )}

        </div>
      </div>

      {/* The next step for this idea, always visible at the bottom of the screen. */}
      <div className="plan-bar">
        {idea.status === 'saved' && (
          <>
            <span className="plan-bar-text">Ready? {APPROVER} will see the video, your shot list and your note.</span>
            <button className="btn btn-ghost" onClick={onBack}>
              Save for later
            </button>
            {sendButton}
          </>
        )}

        {idea.status === 'waiting' && (
          <>
            <span className="plan-bar-text">
              Waiting for {APPROVER}.{' '}
              <button className="link-btn" onClick={() => onChange({ status: 'saved' })}>
                Withdraw
              </button>
            </span>
            <button className="btn btn-ghost" onClick={onGoApprovals}>
              See sent ideas
            </button>
            <button className="btn btn-ghost" onClick={onBack}>
              Back to results
            </button>
            <button className="btn btn-primary" onClick={onPlanAnother}>
              Plan another video
            </button>
          </>
        )}

        {idea.status === 'approved' && (
          <>
            <span className="spacer" />
            {sendButton}
          </>
        )}

        {idea.status === 'rejected' && (
          <>
            <span className="plan-bar-text">{APPROVER} passed on this one. Edit the shots or note, then send it again.</span>
            <button className="btn btn-ghost" onClick={onFindMore}>
              Find another idea
            </button>
            {sendButton}
          </>
        )}
      </div>
    </section>
  )
}

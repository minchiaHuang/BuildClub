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
  // Where Back goes ("search results", "approvals"…), so it returns to the screen she came from.
  backLabel: string
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

export function PlanScreen(p: Props) {
  const { idea, video, format, client, onChange, onBack, onFindMore, onGoApprovals, onPlanAnother } = p
  // Last removed shot, so an accidental ✕ can be undone.
  const [removed, setRemoved] = useState<{ shot: Shot; index: number } | null>(null)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  // Index of a shot just added with "+ Add a shot", so only that row plays its enter animation.
  const [addedAt, setAddedAt] = useState<number | null>(null)

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
  // Everything the editor needs in one paste: reference, shots, props and notes.
  const brief = [
    `${format.name} for ${client.name}`,
    `Due: ${idea.dueDate}`,
    `Reference: ${video.url ?? `${video.handle}, "${video.hook}"`}`,
    '',
    'Shots:',
    ...shots.map((s, i) => `${i + 1}. ${s.time ? `[${s.time}] ` : ''}${s.shot}${s.text ? ` (text on screen: "${s.text}")` : ''}`),
    ...(format.props.length ? ['', `Props: ${format.props.join(', ')}`] : []),
    ...(idea.notes ? ['', `Editor notes: ${idea.notes}`] : []),
  ].join('\n')
  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(brief)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  const setShots = (next: Shot[]) => onChange({ shots: next })
  const updateShot = (i: number, patch: Partial<Shot>) => setShots(shots.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  return (
    <section className="plan">
      <button className="link-btn" onClick={onBack}>
        ← Back to {p.backLabel}
      </button>

      <header className="plan-head">
        <div className="plan-head-row">
          <span className="eyebrow">Plan for {client.name}</span>
          <span className={`status status-${idea.status}`}>{statusLabel[idea.status]}</span>
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
              Sent {ago(idea.sentAt)}. Annie's answer will show up in Approvals. Meanwhile, plan the next video for{' '}
              {client.name}.
            </span>
          </div>
        </div>
      )}

      {idea.status === 'approved' && (
        <div className="sent-banner" role="status">
          <span className="sent-check" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>{APPROVER} approved this</strong>
            <span>Film it by {idea.dueDate}, then copy the brief below for your editor.</span>
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
            <h3>Shots</h3>
            <p className="small muted">
              {editable
                ? `Based on the reference video. Edit them for ${client.name}: what you'll film and any text on screen.`
                : `Locked while ${APPROVER} reviews it. Withdraw it to make changes.`}
            </p>
            {shots.length === 0 && !editable && <p className="muted small">No shots written yet.</p>}
            <ol className="shot-edit">
              {shots.map((s, i) => (
                <li key={i} className={i === addedAt ? 'shot-added' : undefined}>
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
                          setAddedAt(null)
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
                  onClick={() => {
                    setAddedAt(shots.length)
                    setShots([...shots, { time: '', shot: '' }])
                  }}
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

          {idea.status === 'approved' && (
            <section className={`block editor-brief${copied === 'done' ? ' is-copied' : ''}`}>
              <h3>For the editor</h3>
              <label className="field">
                <span className="field-label">Due</span>
                <input id="plan-due" type="date" value={idea.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} />
              </label>
              {format.props.length > 0 && (
                <div className="field">
                  <span className="field-label">Props</span>
                  <ul className="props-list">
                    {format.props.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              <label className="field">
                <span className="field-label">Notes for the editor</span>
                <textarea id="plan-editor-notes" rows={3} value={idea.notes} onChange={(e) => onChange({ notes: e.target.value })} />
              </label>
            </section>
          )}

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
              Back to {p.backLabel}
            </button>
            <button className="btn btn-primary" onClick={onPlanAnother}>
              Plan another video
            </button>
          </>
        )}

        {idea.status === 'approved' && (
          <>
            <span className="plan-bar-text" role="status">
              {copied === 'done'
                ? 'Brief copied. Paste it to your editor with the footage.'
                : copied === 'failed'
                  ? "Couldn't copy. Your browser blocked the clipboard."
                  : `Approved. Due ${idea.dueDate}.`}
            </span>
            <button className="btn btn-ghost" onClick={onPlanAnother}>
              Plan another video
            </button>
            <button
              className={`btn btn-primary copy-btn${copied === 'done' ? ' is-copied' : ''}`}
              onClick={() => void copyBrief()}
            >
              {copied === 'done' ? (
                <>
                  Copied
                  <svg className="copy-icon copy-icon-check" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                </>
              ) : (
                <>
                  <svg className="copy-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M5.5 5.5V3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" />
                    <path d="M3.5 5.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
                  </svg>
                  Copy brief for editor
                </>
              )}
            </button>
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

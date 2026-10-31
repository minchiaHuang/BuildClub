import { useCallback, useEffect, useRef, useState } from 'react'
import type { Client, Format, IdeaStatus, SavedIdea, Shot, Video } from '../types'
import { useManagerName } from '../lib/appContext'
import { clientFit, compact, hasScore, outlierScore, platformName, tierName, tierOf, times, viewsWord } from '../lib/metrics'
import { dueLabel, formatDay } from '../lib/dates'
import { BestVideo } from './BestVideo'
import type { PlayerControl } from './BestVideo'
import { TimedComments } from './TimedComments'
import { tiktokVideoId } from '../lib/tiktokPlayer.ts'
import { lastSentBack } from '../lib/memory'
import { StageSelect } from './StageSelect'
import { ShotChecklist } from './ShotChecklist'
import { CutPanel } from './CutPanel'

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

const statusLabel = (approver: string): Record<IdeaStatus, string> => ({
  saved: 'Not sent yet',
  waiting: `Waiting for ${approver}`,
  approved: 'Approved',
  rejected: 'Not approved',
})

const ago = (ts?: number) => {
  if (!ts) return ''
  const mins = Math.round((Date.now() - ts) / 60_000)
  return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)}h ago`
}

export function PlanScreen(p: Props) {
  const { idea, video, format, client, onChange, onBack, onFindMore, onGoApprovals, onPlanAnother } = p
  // The person who approves plans, from the agency settings.
  const APPROVER = useManagerName()
  // Last removed shot, so an accidental ✕ can be undone.
  const [removed, setRemoved] = useState<{ shot: Shot; index: number } | null>(null)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  // Index of a shot just added with "+ Add a shot", so only that row plays its enter animation.
  const [addedAt, setAddedAt] = useState<number | null>(null)
  // "Edit" on an approved plan asks first, because it sends the plan back for approval.
  const [confirmEdit, setConfirmEdit] = useState(false)
  // Shots with a chosen take, reported by the shot checklist for the video panel.
  const [shotsDone, setShotsDone] = useState(0)
  // Counts every report from the checklist (a take added, removed or re-chosen), for the video panel's stale check.
  const [takesRevision, setTakesRevision] = useState(0)
  useEffect(() => {
    setShotsDone(0)
    setTakesRevision(0)
  }, [idea.id])
  const onTakesProgress = useCallback((done: number) => {
    setShotsDone(done)
    setTakesRevision((r) => r + 1)
  }, [])

  const shots = idea.shots ?? format.shotList
  // Approved plans are locked: the team films what the manager approved. Sent-back plans can be fixed and sent again.
  // An approved plan reopened with "Edit" waits with approvedAt still set, and stays editable while it waits.
  const reopened = idea.status === 'waiting' && !!idea.approvedAt
  const editable = idea.status === 'saved' || idea.status === 'rejected' || reopened
  const comments = idea.shotComments ?? {}
  const playerControl = useRef<PlayerControl | null>(null)
  const shotComment = (i: number) =>
    comments[i] && (
      <span className="shot-comment">
        {APPROVER}: {comments[i]}
      </span>
    )
  const fit = clientFit(format, client)
  const score = outlierScore(video)
  const tier = tierOf(score)
  const defaultNote = `Fits ${client.audience.toLowerCase()}. ${fit.text}`
  const note = idea.noteToApprover ?? defaultNote

  const send = () => {
    onChange({ status: 'waiting', sentAt: Date.now(), noteToApprover: note, rejectReason: undefined, rejectTags: undefined })
    // Bring the confirmation into view.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const reopen = () => {
    setConfirmEdit(false)
    onChange({ status: 'waiting', sentAt: Date.now(), approvedAt: idea.approvedAt ?? Date.now(), stage: undefined, postedAt: undefined })
  }
  const sendButton = (
    <button className="btn btn-primary" disabled={shots.length === 0} onClick={send}>
      Send to {APPROVER} for approval
    </button>
  )
  // Everything the editor needs in one paste: reference, shots, props and notes.
  const brief = [
    `${format.name} for ${client.name}`,
    `Due: ${formatDay(idea.dueDate)}`,
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
          <span className={`status status-${idea.status}`}>{statusLabel(APPROVER)[idea.status]}</span>
        </div>
        <h1>{format.name}</h1>
      </header>

      {idea.status === 'waiting' && (
        <div className="sent-banner" role="status">
          <span className="sent-check" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>{reopened ? `Sent back to ${APPROVER} for approval` : `Sent to ${APPROVER} for approval`}</strong>
            <span>
              {reopened
                ? `Sent ${ago(idea.sentAt)}. Keep editing: ${APPROVER} sees your changes when reviewing it again.`
                : `Sent ${ago(idea.sentAt)}. ${APPROVER}'s answer will show up in the Shortlist. Meanwhile, plan the next video for ${client.name}.`}
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
            <strong>{idea.managerNote ? `${APPROVER} approved this with changes` : `${APPROVER} approved this`}</strong>
            <span>Film it by {formatDay(idea.dueDate)}, then copy the brief below for your editor.</span>
          </div>
        </div>
      )}

      <div className="plan-grid">
        <aside className="plan-ref">
          <BestVideo key={video.id} video={video} control={playerControl} />
          {hasScore(video) ? (
            <>
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
            </>
          ) : (
            <div className="plan-ref-score">
              <span className="cmp-to">{compact(video.views)}</span> <span className="small muted">{viewsWord(video)}</span>
            </div>
          )}
          <span className="small muted">
            Reference: {video.handle}
            {video.url && (
              <>
                {' · '}
                <a className="plan-watch" href={video.url} target="_blank" rel="noreferrer">
                  Watch on {platformName[video.platform]} ↗
                </a>
              </>
            )}
          </span>
          <TimedComments
            key={idea.id}
            ideaId={idea.id}
            videoId={idea.videoId}
            control={playerControl}
            canSeek={!!video.live && video.platform === 'tiktok' && !!tiktokVideoId(video.url)}
          />
        </aside>

        <div className="plan-main">

          <section className="block">
            <h3>Shots</h3>
            <p className="small muted">
              {reopened
                ? `You're changing an approved plan. ${APPROVER} will review it again.`
                : editable
                ? `Based on the reference video. Edit them for ${client.name}: what you'll film and any text on screen.`
                : idea.status === 'approved'
                  ? `Approved by ${APPROVER}. Locked so you film what was approved.`
                  : `Locked while ${APPROVER} reviews it. Withdraw it to make changes.`}
            </p>
            {shots.length === 0 && !editable && <p className="muted small">No shots written yet.</p>}
            {shots.length === 0 && editable && format.shotList.length === 0 && !format.why.first3s.startsWith('Breaking down') && (
              <p className="small muted" role="status">
                The AI breakdown isn't available for this video, so add the shots yourself.
              </p>
            )}
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
                        {shotComment(i)}
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
                        {shotComment(i)}
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

          <ShotChecklist key={idea.id} ideaId={idea.id} status={idea.status} shots={shots} onProgress={onTakesProgress} />
          <CutPanel key={idea.id} ideaId={idea.id} status={idea.status} shotCount={shots.length} shotsDone={shotsDone} takesRevision={takesRevision} />

          {format.lines && format.lines.length > 0 && (
            <section className="block">
              <h3>What each line does</h3>
              <ul className="line-roles">
                {format.lines.map((l, i) => (
                  <li key={i}>
                    <span className="shot-time">{l.time}</span> <span className="ai-tag">{l.role}</span> <span>{l.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="block">
            <label htmlFor="note-to-approver">
              <h3>Note to {APPROVER}</h3>
            </label>
            {editable ? (
              <textarea
                id="note-to-approver"
                rows={3}
                value={note}
                placeholder={`Why this would work for ${client.name}`}
                onChange={(e) => onChange({ noteToApprover: e.target.value })}
              />
            ) : (
              <p className="quote">{note}</p>
            )}
          </section>

          {idea.status === 'approved' && idea.managerNote && (
            <section className="block manager-note">
              <h3>Changes {APPROVER} asked for</h3>
              <p className="quote">{idea.managerNote}</p>
            </section>
          )}

          {idea.status === 'approved' && (
            <section className={`block editor-brief${copied === 'done' ? ' is-copied' : ''}`}>
              <h3>For the editor</h3>
              <div className="field">
                <span className="field-label">Stage</span>
                <StageSelect idea={idea} name={format.name} onChange={onChange} />
              </div>
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
              {idea.rejectTags && idea.rejectTags.length > 0 && <p className="small">{idea.rejectTags.join(' · ')}</p>}
              <p className="quote">{idea.rejectReason || (idea.rejectTags?.length ? 'No written reason.' : 'No reason given.')}</p>
            </section>
          )}
          {idea.status !== 'rejected' && lastSentBack(idea) && (
            <section className="block">
              <h3>Last time {APPROVER} sent it back</h3>
              {(lastSentBack(idea)?.tags?.length ?? 0) > 0 && <p className="small">{lastSentBack(idea)?.tags?.join(' · ')}</p>}
              <p className="quote">{lastSentBack(idea)?.reason || 'No written reason.'}</p>
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

        {idea.status === 'approved' && confirmEdit && (
          <>
            <span className="plan-bar-text">This sends it back to {APPROVER} for approval. Continue?</span>
            <button className="btn btn-ghost" onClick={() => setConfirmEdit(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={reopen}>
              Continue
            </button>
          </>
        )}

        {idea.status === 'approved' && !confirmEdit && (
          <>
            <span className="plan-bar-text" role="status">
              {copied === 'done'
                ? 'Brief copied. Paste it to your editor with the footage.'
                : copied === 'failed'
                  ? "Couldn't copy. Your browser blocked the clipboard."
                  : `Approved. ${dueLabel(idea.dueDate).text}.`}
            </span>
            <button className="btn btn-ghost" onClick={() => setConfirmEdit(true)}>
              Edit
            </button>
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

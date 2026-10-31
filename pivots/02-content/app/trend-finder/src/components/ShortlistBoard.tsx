import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Client, Format, IdeaStatus, SavedIdea, Stage, Video } from '../types'
import { compact, hasScore, outlierScore, plural, times } from '../lib/metrics'
import { dueLabel } from '../lib/dates'
import { useManagerName } from '../lib/appContext'
import { inTwoWeeks } from '../state'
import { lastSentBack } from '../lib/memory'
import { createShareLink, revokeClientLinks } from '../lib/share'
import { postedThisMonth, stageOf } from '../lib/stage'
import { ProgressRing } from './ProgressRing'
import { StageSelect } from './StageSelect'
import { Thumb } from './Thumb'

interface Props {
  client: Client
  // Ideas for every client; the board shows this client's.
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  onChangeIdeas: Dispatch<SetStateAction<SavedIdea[]>>
  onOpenPlan: (ideaId: string) => void
  onFindMore: () => void
  onReview: () => void
}

// Shots the team has written. A shortlisted idea needs its own; one already sent uses the reference's, like the plan does.
const shotsOf = (idea: SavedIdea, f?: Format) => idea.shots ?? (idea.status === 'saved' ? [] : (f?.shotList ?? []))

// One client's pipeline on one page: Shortlisted → Waiting for the manager → Approved (ready to film),
// then an "In production" row (Filming → Editing → Posted this month), plus a small "Sent back" lane.
// Batch actions work on the whole Shortlisted column.
export function ShortlistBoard(p: Props) {
  const manager = useManagerName()
  const [dueDate, setDueDate] = useState(inTwoWeeks)
  const [note, setNote] = useState('')
  // The approver's link for the client being shown: null url = turned off here.
  const [link, setLink] = useState<{ clientId: string; url: string | null } | null>(null)
  const [linkError, setLinkError] = useState('')
  const [copied, setCopied] = useState(false)
  const mine = p.ideas.filter((i) => i.clientId === p.client.id)
  const by = (s: IdeaStatus) => mine.filter((i) => i.status === s)
  const shortlisted = by('saved')
  const waiting = by('waiting').sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0))
  const approved = by('approved').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const inStage = (s: Stage) => approved.filter((i) => stageOf(i) === s)
  const toFilm = inStage('approved')
  const filming = inStage('filming')
  const editing = inStage('editing')
  const postedNow = new Date()
  const posted = inStage('posted')
  const postedCount = postedThisMonth(mine, postedNow)
  const postedRecent = posted
    .filter((i) => postedThisMonth([i], postedNow) === 1)
    .sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0))
  const postedEarlier = posted.length - postedRecent.length
  const sentBack = by('rejected')
  const shownLink = link?.clientId === p.client.id ? link.url : null
  const ready = shortlisted.filter((i) => shotsOf(i).length > 0)
  const needShots = shortlisted.filter((i) => shotsOf(i).length === 0)
  const progress = Math.min(approved.length / p.client.monthlyTarget, 1) * 100

  const update = (ids: Set<string>, patch: (i: SavedIdea) => Partial<SavedIdea>) =>
    p.onChangeIdeas((prev) => prev.map((i) => (ids.has(i.id) ? { ...i, ...patch(i) } : i)))

  // Copy each idea's reference shot list. Live videos have none, so they stay empty and editable in the plan.
  const generate = () =>
    update(new Set(needShots.map((i) => i.id)), (i) => {
      const f = p.formatById.get(p.videoById.get(i.videoId)?.formatId ?? '')
      return { shots: (f?.shotList ?? []).map((s) => ({ ...s })) }
    })

  const send = () => {
    const sentAt = Date.now()
    update(new Set(ready.map((i) => i.id)), (i) => ({
      status: 'waiting',
      sentAt,
      dueDate,
      noteToApprover: note.trim() || i.noteToApprover,
      rejectReason: undefined,
      rejectTags: undefined,
    }))
    setNote('')
    // The approver opens this link, so it is made as soon as there is something for them to review.
    makeLink()
  }

  // Making the link again returns the client's existing one, so this is safe to call more than once.
  const makeLink = () => {
    setLinkError('')
    createShareLink(p.client.id)
      .then((l) => setLink({ clientId: p.client.id, url: l.url }))
      .catch((e: Error) => setLinkError(e.message))
  }
  const turnOff = () => {
    setLinkError('')
    revokeClientLinks(p.client.id)
      .then(() => setLink({ clientId: p.client.id, url: null }))
      .catch((e: Error) => setLinkError(e.message))
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shownLink ?? '')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setLinkError("Couldn't copy. Select the link and copy it by hand.")
    }
  }

  const remove = (id: string) => p.onChangeIdeas((prev) => prev.filter((i) => i.id !== id))

  const card = (idea: SavedIdea) => {
    const v = p.videoById.get(idea.videoId)
    if (!v) return null
    const f = p.formatById.get(v.formatId)
    const shots = shotsOf(idea, f).length
    return (
      <li key={idea.id} className="board-card">
        <Thumb video={v} />
        <div className="board-card-body">
          <strong>{v.live ? v.hook : f?.name}</strong>
          <span className="small muted">
            Reference: {v.live ? v.handle : `"${v.hook}" · ${v.handle}`} · {compact(v.views)} views{hasScore(v) && ` · ${times(outlierScore(v))}`}
          </span>
          <span className="small">
            <span className={dueLabel(idea.dueDate).late ? 'due-soon' : undefined}>{dueLabel(idea.dueDate).text}</span> · {shots ? plural(shots, 'shot') : <span className="muted">No shots yet</span>}
          </span>
          {idea.status === 'rejected' && (
            <span className="board-reason small">
              {manager}: {idea.rejectTags?.length ? `${idea.rejectTags.join(' · ')}. ` : ''}
              {idea.rejectReason || (idea.rejectTags?.length ? '' : 'No reason given.')}
            </span>
          )}
          {idea.status !== 'rejected' && lastSentBack(idea) && (
            <span className="board-reason small">
              Last time {manager} sent it back: {lastSentBack(idea)?.tags?.length ? `${lastSentBack(idea)?.tags?.join(' · ')}. ` : ''}
              {lastSentBack(idea)?.reason ?? ''}
            </span>
          )}
        </div>
        <div className="board-card-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => p.onOpenPlan(idea.id)}>
            Open plan
          </button>
          <StageSelect idea={idea} name={(v.live ? v.hook : f?.name) ?? v.hook} onChange={(patch) => update(new Set([idea.id]), () => patch)} />
          <button className="link-btn" onClick={() => remove(idea.id)} aria-label={`Remove ${f?.name ?? v.hook}`}>
            Remove
          </button>
        </div>
      </li>
    )
  }

  const column = (title: string, list: SavedIdea[], empty: string, tone: string, extra?: React.ReactNode) => (
    <section className={`board-col board-col-${tone}`} aria-label={title}>
      <header className="board-col-head">
        <h2>{title}</h2>
        <span className="board-count">{list.length}</span>
      </header>
      {extra}
      {list.length ? <ul className="board-list">{list.map(card)}</ul> : <p className="board-empty small muted">{empty}</p>}
    </section>
  )

  return (
    <section className="client board">
      <header className="client-head">
        <div>
          <span className="eyebrow">{p.client.name} · Shortlist</span>
          <h1>Shortlist</h1>
          <p className="muted">
            Pick videos, write the shot lists, then send them to {manager} in one go.
          </p>
        </div>
        <div className="target">
          <ProgressRing value={progress} size={56} stroke={6} />
          <div className="target-text">
            <span className="target-num">
              {approved.length} <span className="muted">of {p.client.monthlyTarget}</span>
            </span>
            <span className="small muted">videos approved this month</span>
            <span className="small muted">{postedCount} posted this month</span>
          </div>
        </div>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <h2>Nothing shortlisted yet</h2>
          <p>Add videos to the shortlist from the search results. They show up here, ready for shot lists.</p>
          <button className="btn btn-primary" onClick={p.onFindMore}>
            Find trending videos
          </button>
        </div>
      ) : (
        <>
          <div className="board-cols">
            {column(
              'Shortlisted',
              shortlisted,
              'Add videos from the search results.',
              'saved',
              shortlisted.length > 0 && (
                <div className="board-batch">
                  <div className="board-batch-row">
                    <span className="small muted">
                      {needShots.length
                        ? `${plural(needShots.length, 'video')} without a shot list.`
                        : 'Every video has a shot list.'}
                    </span>
                    <button className="btn btn-ghost btn-sm" disabled={!needShots.length} onClick={generate}>
                      Generate shot lists
                    </button>
                  </div>
                  <label className="field">
                    <span className="field-label">Due date</span>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value || inTwoWeeks())} />
                  </label>
                  <label className="field">
                    <span className="field-label">Note to {manager}</span>
                    <textarea
                      rows={2}
                      value={note}
                      placeholder={`Why these fit ${p.client.name}`}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <button className="btn btn-primary" disabled={!ready.length} onClick={send}>
                    {ready.length ? `Send ${ready.length} to ${manager}` : `Send to ${manager}`}
                  </button>
                  {ready.length > 0 && needShots.length > 0 && (
                    <span className="small muted">Videos without shots stay here.</span>
                  )}
                </div>
              ),
            )}
            {column(
              `Waiting for ${manager}`,
              waiting,
              `Nothing waiting for ${manager}.`,
              'waiting',
              waiting.length > 0 && (
                <div className="board-link">
                  {shownLink ? (
                    <>
                      <label className="field">
                        <span className="field-label">Link for {manager} (no sign-in needed)</span>
                        <input readOnly value={shownLink} onFocus={(e) => e.currentTarget.select()} />
                      </label>
                      <div className="board-link-row">
                        <button className="btn btn-primary btn-sm" onClick={copyLink}>
                          {copied ? 'Copied' : 'Copy link'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={turnOff}>
                          Turn off link
                        </button>
                      </div>
                    </>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={makeLink}>
                      {link?.clientId === p.client.id ? 'Make a new link' : 'Get review link'}
                    </button>
                  )}
                  {linkError && (
                    <p className="error" role="alert">
                      {linkError}
                    </p>
                  )}
                  <button className="link-btn board-review" onClick={p.onReview}>
                    Preview as {manager}
                  </button>
                </div>
              ),
            )}
            {column('Approved, ready to film', toFilm, `Plans ${manager} approves show up here.`, 'approved')}
          </div>

          <h2 className="board-row-title">In production</h2>
          <div className="board-cols board-cols-production">
            {column('Filming', filming, 'Nothing being filmed.', 'filming')}
            {column('Editing', editing, 'Nothing being edited.', 'editing')}
            {column(
              'Posted this month',
              postedRecent,
              'Nothing posted this month.',
              'posted',
              postedEarlier > 0 && <span className="small muted">{plural(postedEarlier, 'video')} posted earlier</span>,
            )}
          </div>

          {sentBack.length > 0 && (
            <section className="board-lane" aria-label="Sent back">
              <header className="board-col-head">
                <h2>Sent back</h2>
                <span className="board-count">{sentBack.length}</span>
              </header>
              <ul className="board-list board-list-lane">{sentBack.map(card)}</ul>
            </section>
          )}
        </>
      )}
    </section>
  )
}

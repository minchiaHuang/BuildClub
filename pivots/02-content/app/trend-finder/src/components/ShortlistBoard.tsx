import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Client, Format, IdeaStatus, SavedIdea, Video } from '../types'
import { compact, hasScore, outlierScore, plural, times } from '../lib/metrics'
import { dueLabel } from '../lib/dates'
import { useManagerName } from '../lib/appContext'
import { inTwoWeeks } from '../state'
import { ProgressRing } from './ProgressRing'
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
// plus a small "Sent back" lane. Batch actions work on the whole Shortlisted column.
export function ShortlistBoard(p: Props) {
  const manager = useManagerName()
  const [dueDate, setDueDate] = useState(inTwoWeeks)
  const [note, setNote] = useState('')
  const mine = p.ideas.filter((i) => i.clientId === p.client.id)
  const by = (s: IdeaStatus) => mine.filter((i) => i.status === s)
  const shortlisted = by('saved')
  const waiting = by('waiting').sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0))
  const approved = by('approved').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const sentBack = by('rejected')
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
    }))
    setNote('')
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
              {manager}: {idea.rejectReason || 'No reason given.'}
            </span>
          )}
        </div>
        <div className="board-card-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => p.onOpenPlan(idea.id)}>
            Open plan
          </button>
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
                <button className="btn btn-primary btn-sm board-review" onClick={p.onReview}>
                  Review as {manager}
                </button>
              ),
            )}
            {column('Approved, ready to film', approved, `Plans ${manager} approves show up here.`, 'approved')}
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

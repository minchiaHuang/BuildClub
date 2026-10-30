import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { Client, Format, SavedIdea, Video } from '../types'
import { compact, hasScore, outlierScore, platformName, times } from '../lib/metrics'
import { Thumb } from './Thumb'
import { REJECT_TAGS } from '../lib/share'

interface Props {
  client: Pick<Client, 'id' | 'name'>
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  onDecide: (ideaId: string, approved: boolean, reason?: string, tags?: string[]) => void
  // Only in Daphne's preview. Annie's own page has nothing to go back to.
  onBack?: () => void
}

// A decision that is animating out. onDecide is called once the card has slid away and its space has closed.
interface Leaving {
  id: string
  approved: boolean
  reason?: string
  tags?: string[]
  collapsing: boolean
}

const SWIPE_AT = 96 // px of horizontal drag that counts as a swipe
const SLOP = 6 // px before a press becomes a drag

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Read a duration token (e.g. "--dur-slow: 300ms") so JS timing matches the CSS.
const tokenMs = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0

// What Annie sees: each waiting plan with its reference, shots and note, and one tap to approve or send back.
// A narrow column so it reads like a phone view. Used for Daphne's preview and for Annie's link page.
export function ReviewScreen({ client, ideas, videoById, formatById, onDecide, onBack }: Props) {
  const [passing, setPassing] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  // What she has answered in this visit, newest last, for the confirmation line and the "All decided" list.
  const [decided, setDecided] = useState<{ id: string; title: string; approved: boolean }[]>([])
  const timers = useRef<number[]>([])
  const pending = useRef<Leaving | null>(null)
  const decideRef = useRef(onDecide)
  useEffect(() => {
    decideRef.current = onDecide
  }, [onDecide])
  const waiting = ideas.filter((i) => i.clientId === client.id && i.status === 'waiting')
  // An answer that didn't save puts its card back, and then it no longer counts as decided.
  const answered = decided.filter((d) => !waiting.some((i) => i.id === d.id))
  const lastAnswer = answered[answered.length - 1]
  const answerText = (d: { title: string; approved: boolean }) => `${d.approved ? 'Approved' : 'Sent back'}: ${d.title}`

  // Keyboard users: after a decision, focus moves to the next card (or the previous one, or the heading when none are left).
  const stackRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLHeadingElement>(null)
  const focusNext = useRef<string | null>(null)
  const focusTarget = (target: string) => {
    const card = stackRef.current?.querySelector<HTMLElement>(`.review-card[data-idea="${CSS.escape(target)}"]`)
    const el = card ?? headRef.current
    el?.focus({ preventScroll: !!card })
    if (card) card.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }
  useEffect(() => {
    const target = focusNext.current
    if (target === null || waiting.some((i) => i.id === leaving?.id)) return
    focusNext.current = null
    focusTarget(target)
  })

  // If Annie leaves mid-animation, still record the decision.
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      const p = pending.current
      if (p) decideRef.current(p.id, p.approved, p.reason, p.tags)
    },
    [],
  )

  const record = (id: string, approved: boolean) => {
    const idea = ideas.find((i) => i.id === id)
    const v = idea && videoById.get(idea.videoId)
    const f = v && formatById.get(v.formatId)
    setDecided((prev) => [...prev, { id, title: f?.name ?? 'this plan', approved }])
  }

  const finish = (d: Leaving) => {
    pending.current = null
    setLeaving(null)
    record(d.id, d.approved)
    onDecide(d.id, d.approved, d.reason, d.tags)
  }

  const decide = (id: string, approved: boolean, why?: string, whyTags?: string[]) => {
    if (leaving) return
    const d: Leaving = { id, approved, reason: why, tags: whyTags, collapsing: false }
    const ids = waiting.map((i) => i.id)
    const at = ids.indexOf(id)
    focusNext.current = ids[at + 1] ?? ids[at - 1] ?? ''
    // Move focus straight away so it isn't lost while the card animates out; the effect re-checks once it's gone.
    if (focusNext.current) focusTarget(focusNext.current)
    setPassing(null)
    setReason('')
    setTags([])
    if (reducedMotion()) {
      record(id, approved)
      onDecide(id, approved, why, whyTags)
      return
    }
    pending.current = d
    setLeaving(d)
    timers.current.push(
      window.setTimeout(() => {
        setLeaving({ ...d, collapsing: true })
        timers.current.push(window.setTimeout(() => finish(d), tokenMs('--dur')))
      }, tokenMs('--dur-slow')),
    )
  }

  const startPass = (id: string) => {
    if (leaving) return
    setPassing(id)
    setReason('')
    setTags([])
  }

  return (
    <section className="review">
      {onBack && (
        <>
          <button className="link-btn review-back" onClick={onBack}>
            ← Back to approvals
          </button>
          <p className="review-banner">Preview of Annie's view. This is what opens when she uses your link.</p>
        </>
      )}

      <header className="page-head review-head">
        <span className="eyebrow">{client.name} · For Annie</span>
        <h1 ref={headRef} tabIndex={-1}>{waiting.length ? `${waiting.length} to review` : 'Nothing to review'}</h1>
        <p className="small review-status" role="status">
          {lastAnswer ? answerText(lastAnswer) : ''}
        </p>
        {waiting.length > 0 && <p className="small muted">Press Approve, or Not this one to send it back.</p>}
      </header>

      {waiting.length === 0 && (
        <div className="empty">
          <h2>All decided</h2>
          <p>New plans sent for approval will show up here.</p>
          {answered.length > 0 && (
            <ul className="review-decided">
              {answered.map((d) => (
                <li key={d.id}>{answerText(d)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="review-stack" ref={stackRef}>
        {waiting.map((idea) => {
          const v = videoById.get(idea.videoId)
          const f = v && formatById.get(v.formatId)
          if (!v || !f) return null
          const out = leaving?.id === idea.id ? leaving : null
          return (
            <ReviewCard
              key={idea.id}
              idea={idea}
              video={v}
              format={f}
              passing={passing === idea.id}
              reason={reason}
              setReason={setReason}
              tags={tags}
              toggleTag={(t) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 5 ? [...prev, t] : prev))}
              leaving={out ? (out.approved ? 'right' : 'left') : null}
              collapsing={!!out?.collapsing}
              busy={!!leaving}
              onApprove={() => decide(idea.id, true)}
              onStartPass={() => startPass(idea.id)}
              onCancelPass={() => setPassing(null)}
              onSendBack={() => decide(idea.id, false, reason.trim() || undefined, tags)}
            />
          )
        })}
      </div>
    </section>
  )
}

interface CardProps {
  idea: SavedIdea
  video: Video
  format: Format
  passing: boolean
  reason: string
  setReason: (r: string) => void
  tags: string[]
  toggleTag: (t: string) => void
  leaving: 'left' | 'right' | null
  collapsing: boolean
  busy: boolean
  onApprove: () => void
  onStartPass: () => void
  onCancelPass: () => void
  onSendBack: () => void
}

// One plan as a swipeable card. Pointer events cover mouse drag and touch; the buttons stay as the accessible path,
// and the focused card also takes ←/→.
function ReviewCard(p: CardProps) {
  const { idea, video: v, format: f } = p
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const shots = idea.shots ?? f.shotList
  const canSwipe = !p.passing && !p.leaving && !p.busy

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!canSwipe || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select, label')) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const moveX = e.clientX - s.x
    if (!dragging) {
      if (Math.abs(moveX) < SLOP) return
      // Mostly vertical: let the page scroll instead.
      if (Math.abs(e.clientY - s.y) > Math.abs(moveX)) {
        start.current = null
        return
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      window.getSelection()?.removeAllRanges()
      setDragging(true)
    }
    setDx(moveX)
  }

  const endDrag = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    start.current = null
    const moved = dx
    setDragging(false)
    setDx(0)
    if (cancelled) return
    if (moved >= SWIPE_AT) p.onApprove()
    else if (moved <= -SWIPE_AT) p.onStartPass()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget || !canSwipe) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      p.onApprove()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      p.onStartPass()
    }
  }

  const progress = Math.min(Math.abs(dx) / SWIPE_AT, 1)
  const style = dragging
    ? { transform: `translateX(${dx}px) rotate(${Math.max(-8, Math.min(8, dx / 24))}deg)` }
    : undefined
  const cls = [
    'review-card',
    dragging && 'is-dragging',
    p.leaving && `is-leaving is-leaving-${p.leaving}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`review-slot ${p.collapsing ? 'is-collapsing' : ''}`}>
      <div className="review-slot-inner">
        <article
          className={cls}
          data-idea={idea.id}
          style={style}
          tabIndex={canSwipe ? 0 : -1}
          aria-keyshortcuts="ArrowRight ArrowLeft"
          aria-label={`${f.name}. Press right arrow to approve, left arrow to send back.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
          onKeyDown={onKeyDown}
        >
          <span
            className="swipe-hint swipe-hint-yes"
            aria-hidden="true"
            style={{ opacity: dx > 0 ? progress : 0 }}
          >
            Approve
          </span>
          <span
            className="swipe-hint swipe-hint-no"
            aria-hidden="true"
            style={{ opacity: dx < 0 ? progress : 0 }}
          >
            Send back
          </span>

          <div className="review-ref">
            {v.url ? (
              // The text link below is the named one; the picture is a second, larger way to the same page.
              <a className="review-ref-thumb" href={v.url} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true">
                <Thumb video={v} />
              </a>
            ) : (
              <Thumb video={v} />
            )}
            <div>
              <strong>{f.name}</strong>
              <span className="small muted">
                Reference: "{v.hook}" · {compact(v.views)} views{hasScore(v) && ` · ${times(outlierScore(v))} usual`}
              </span>
              {v.url && (
                <a className="plan-watch" href={v.url} target="_blank" rel="noreferrer">
                  Watch the video on {platformName[v.platform]} ↗
                </a>
              )}
            </div>
          </div>

          {idea.noteToApprover && <p className="quote">{idea.noteToApprover}</p>}

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

          {p.passing ? (
            <div className="review-reject">
              <div className="chip-row" role="group" aria-label="Why not this one?">
                {REJECT_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`cchip ${p.tags.includes(t) ? 'cchip-on' : ''}`}
                    aria-pressed={p.tags.includes(t)}
                    onClick={() => p.toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label htmlFor={`reason-${idea.id}`} className="field-label">
                What should change? (optional)
              </label>
              <textarea
                id={`reason-${idea.id}`}
                rows={2}
                value={p.reason}
                onChange={(e) => p.setReason(e.target.value)}
                autoFocus
              />
              <div className="review-actions">
                <button className="btn btn-ghost" onClick={p.onCancelPass}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={p.onSendBack} disabled={p.busy}>
                  Send back
                </button>
              </div>
            </div>
          ) : (
            <div className="review-actions">
              <button className="btn btn-ghost" onClick={p.onStartPass} disabled={p.busy}>
                Not this one
              </button>
              <button className="btn btn-primary" onClick={p.onApprove} disabled={p.busy}>
                Approve
              </button>
            </div>
          )}
        </article>
      </div>
    </div>
  )
}

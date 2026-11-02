import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { Client, Format, SavedIdea, Video } from '../types'
import { compact } from '../lib/metrics'
import { Thumb } from './Thumb'
import { useApp, useManagerName } from '../lib/appContext'
import type { Decision } from '../lib/memory'
import { beatUsual } from './find/words'
import { t, tp } from '../lib/i18n'

interface Props {
  client: Client
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  onDecide: (ideaId: string, d: Decision) => void
  // A preview from the team's side: the buttons are off, because a decision here would really be recorded.
  readOnly?: boolean
  // Back returns to where Review was opened from: Plans, Home or All clients.
  onBack: () => void
  backLabel: string
  onOpenPlans: () => void
  // The next client with plans waiting, so approvals can be cleared across clients in one go.
  nextClient: { name: string; waiting: number } | null
  onNextClient: () => void
}

// A decision that is animating out. onDecide is called once the card has slid away and its space has closed.
interface Leaving {
  id: string
  d: Decision
  collapsing: boolean
}

// Which comment box is open on a card: approve with changes, or send back.
type Mode = 'changes' | 'back' | null

const SWIPE_AT = 96 // px of horizontal drag that counts as a swipe
const SLOP = 6 // px before a press becomes a drag

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Read a duration token (e.g. "--dur-slow: 300ms") so JS timing matches the CSS.
const tokenMs = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0

// What the manager sees: each waiting plan with its reference, shots, the team's note and due date, and three choices:
// approve, approve with changes, or send back. A narrow column so it reads like a phone view.
// Team members see the same plans read-only. Demo only: the role is picked at login, nothing is checked.
export function ReviewScreen({ client, ideas, videoById, formatById, onDecide, readOnly, onBack, backLabel, onOpenPlans, nextClient, onNextClient }: Props) {
  const manager = useManagerName()
  const isManager = useApp().role === 'manager' && !readOnly
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  const timers = useRef<number[]>([])
  const pending = useRef<Leaving | null>(null)
  const decideRef = useRef(onDecide)
  useEffect(() => {
    decideRef.current = onDecide
  }, [onDecide])
  const waiting = ideas.filter((i) => i.clientId === client.id && i.status === 'waiting')

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

  // If the manager leaves mid-animation, still record the decision.
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      const p = pending.current
      if (p) decideRef.current(p.id, p.d)
    },
    [],
  )

  const finish = (d: Leaving) => {
    pending.current = null
    setLeaving(null)
    onDecide(d.id, d.d)
  }

  const decide = (id: string, decision: Decision) => {
    if (leaving || !isManager) return
    const d: Leaving = { id, d: decision, collapsing: false }
    const ids = waiting.map((i) => i.id)
    const at = ids.indexOf(id)
    focusNext.current = ids[at + 1] ?? ids[at - 1] ?? ''
    // Move focus straight away so it isn't lost while the card animates out; the effect re-checks once it's gone.
    if (focusNext.current) focusTarget(focusNext.current)
    if (reducedMotion()) {
      onDecide(id, decision)
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

  return (
    <section className="review">
      <button className="link-btn review-back" onClick={onBack}>
        {t('cut.rv.back', { label: backLabel })}
      </button>
      {readOnly ? (
        <p className="review-banner">
          {t('cut.rv.preview', { name: manager })}
        </p>
      ) : (
        !isManager && (
          <p className="review-banner">{t('cut.rv.teamBanner', { name: manager })}</p>
        )
      )}

      <header className="page-head review-head">
        <span className="eyebrow">{t('cut.rv.eyebrow', { client: client.name })}</span>
        <h1 ref={headRef} tabIndex={-1}>
          {!waiting.length ? t('cut.rv.none') : isManager ? t('cut.rv.toReview', { n: waiting.length }) : t('cut.rv.waitingFor', { n: waiting.length, name: manager })}
        </h1>
        {waiting.length > 0 && isManager && <p className="small muted">{t('cut.rv.swipe')}</p>}
      </header>

      {waiting.length === 0 && (
        <div className="empty">
          <h2>{t('cut.rv.allDone')}</h2>
          <p>
            {nextClient
              ? tp('cut.rv.nextHas', nextClient.waiting, { client: nextClient.name })
              : t('cut.rv.nothingElse')}
          </p>
          <div className="form-actions">
            {nextClient && (
              <button className="btn btn-primary" onClick={onNextClient}>
                {t('cut.rv.next', { client: nextClient.name, n: nextClient.waiting })}
              </button>
            )}
            <button className={`btn ${nextClient ? 'btn-ghost' : 'btn-primary'}`} onClick={onOpenPlans}>
              {t('cut.rv.backToPlans')}
            </button>
          </div>
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
              isManager={isManager}
              manager={manager}
              leaving={out ? (out.d.kind === 'sent-back' ? 'left' : 'right') : null}
              collapsing={!!out?.collapsing}
              busy={!!leaving}
              onDecide={(d) => decide(idea.id, d)}
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
  isManager: boolean
  manager: string
  leaving: 'left' | 'right' | null
  collapsing: boolean
  busy: boolean
  onDecide: (d: Decision) => void
}

const due = (date: string) => new Date(`${date}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

// One plan as a swipeable card. Pointer events cover mouse drag and touch; the buttons stay as the accessible path,
// and the focused card also takes ←/→. Swiping left opens "Send back", which needs a reason.
function ReviewCard(p: CardProps) {
  const { idea, video: v, format: f } = p
  const [mode, setMode] = useState<Mode>(null)
  const [comment, setComment] = useState('')
  const [shotComments, setShotComments] = useState<Record<number, string>>({})
  // Shots with their comment box open.
  const [commenting, setCommenting] = useState<number[]>([])
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const shots = idea.shots ?? f.shotList
  const canSwipe = p.isManager && !mode && !p.leaving && !p.busy

  const approve = () => p.onDecide({ kind: 'approved', shotComments })
  const openMode = (m: Mode) => {
    setMode(m)
    setComment('')
  }
  const confirm = () => {
    const text = comment.trim()
    if (!text || !mode) return
    p.onDecide({ kind: mode === 'changes' ? 'approved-with-changes' : 'sent-back', comment: text, shotComments })
  }

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
    if (moved >= SWIPE_AT) approve()
    else if (moved <= -SWIPE_AT) openMode('back')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget || !canSwipe) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      approve()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      openMode('back')
    }
  }

  const progress = Math.min(Math.abs(dx) / SWIPE_AT, 1)
  const style = dragging
    ? { transform: `translateX(${dx}px) rotate(${Math.max(-8, Math.min(8, dx / 24))}deg)` }
    : undefined
  const cls = [
    'review-card',
    dragging && 'is-dragging',
    !p.isManager && 'is-readonly',
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
          aria-keyshortcuts={p.isManager ? 'ArrowRight ArrowLeft' : undefined}
          aria-label={p.isManager ? t('cut.rv.cardAria', { name: f.name }) : f.name}
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
            {t('cut.rv.approve')}
          </span>
          <span
            className="swipe-hint swipe-hint-no"
            aria-hidden="true"
            style={{ opacity: dx < 0 ? progress : 0 }}
          >
            {t('cut.rv.sendBack')}
          </span>

          <div className="review-ref">
            <Thumb video={v} />
            <div>
              <strong>{f.name}</strong>
              <span className="small muted">
                {t('cut.rv.basedOn', { hook: v.hook, views: compact(v.views), beat: beatUsual(v) })}
              </span>
            </div>
          </div>

          <div className="review-meta">
            <span className="small muted">
              {t('cut.rv.due', { date: due(idea.dueDate) })}
              {idea.approvedAt && ` · ${t('cut.rv.changed')}`}
            </span>
            {!p.isManager && <span className="small muted">{t('cut.rv.waitingForName', { name: p.manager })}</span>}
          </div>

          {idea.noteToApprover && (
            <div className="review-note">
              <span className="field-label">{t('cut.rv.teamNote')}</span>
              <p className="quote">{idea.noteToApprover}</p>
            </div>
          )}

          {shots.length > 0 && (
            <ol className="review-shots">
              {shots.map((s, i) => {
                const open = commenting.includes(i) || !!shotComments[i]
                return (
                  <li key={i}>
                    {s.shot}
                    {s.text && <span className="shot-text"> {t('cut.rv.shotText', { text: s.text })}</span>}
                    {p.isManager &&
                      (open ? (
                        <input
                          className="shot-comment-input"
                          aria-label={t('cut.rv.commentAria', { n: i + 1 })}
                          placeholder={t('cut.rv.commentPlaceholder')}
                          value={shotComments[i] ?? ''}
                          autoFocus={!shotComments[i]}
                          onChange={(e) => setShotComments({ ...shotComments, [i]: e.target.value })}
                          onBlur={() => setCommenting(commenting.filter((n) => n !== i))}
                        />
                      ) : (
                        <button
                          type="button"
                          className="link-btn shot-comment-btn"
                          disabled={p.busy}
                          onClick={() => setCommenting([...commenting, i])}
                        >
                          {t('cut.rv.addComment')}
                        </button>
                      ))}
                  </li>
                )
              })}
            </ol>
          )}

          {!p.isManager ? null : mode ? (
            <div className="review-reject">
              <label htmlFor={`comment-${idea.id}`} className="field-label">
                {mode === 'changes' ? t('cut.rv.whatChange') : t('cut.rv.whyBack')}
              </label>
              <textarea
                id={`comment-${idea.id}`}
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                autoFocus
              />
              <div className="review-actions">
                <button className="btn btn-ghost" onClick={() => setMode(null)}>
                  {t('cut.common.cancel')}
                </button>
                <button className="btn btn-primary" onClick={confirm} disabled={p.busy || !comment.trim()}>
                  {mode === 'changes' ? t('cut.rv.approveChanges') : t('cut.rv.sendBack')}
                </button>
              </div>
            </div>
          ) : (
            <div className="review-actions review-actions-3">
              <button className="btn btn-ghost" onClick={() => openMode('back')} disabled={p.busy}>
                {t('cut.rv.sendBack')}
              </button>
              <button className="btn btn-ghost" onClick={() => openMode('changes')} disabled={p.busy}>
                {t('cut.rv.approveChanges')}
              </button>
              <button className="btn btn-primary" onClick={approve} disabled={p.busy}>
                {t('cut.rv.approve')}
              </button>
            </div>
          )}
        </article>
      </div>
    </div>
  )
}

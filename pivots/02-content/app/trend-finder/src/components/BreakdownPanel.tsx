import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Client, Format, Video } from '../types'
import {
  ago,
  clientFit,
  compact,
  hasDate,
  hasScore,
  outlierScore,
  platformName,
  scoreLine,
  shareSaveRate,
  tierName,
  tierOf,
  times,
  viewsPerDay,
  viewsWord,
} from '../lib/metrics'
import { useCountUp } from '../lib/motion'
import { Thumb } from './Thumb'

interface Props {
  video: Video
  format: Format
  formatAccounts: number
  client: Client
  saved: boolean
  onClose: () => void
  onSave: () => void
  onPlan: () => void
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function BreakdownPanel({ video, format, formatAccounts, client, saved, onClose, onSave, onPlan }: Props) {
  // Play the slide-out before App unmounts the panel (skipped under reduced motion).
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => {
    if (reducedMotion()) onClose()
    else setClosing(true)
  }, [onClose])

  // Focus: start on Close, keep Tab inside the dialog, hand focus back to the opener on unmount.
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const trapTab = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return
    const items = [
      ...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.getClientRects().length > 0)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // Safety net in case the close animation never reports back.
  useEffect(() => {
    if (!closing) return
    const t = window.setTimeout(onClose, 400)
    return () => window.clearTimeout(t)
  }, [closing, onClose])

  const score = outlierScore(video)
  // Count up once when the panel opens (final value straight away under reduced motion).
  const shownScore = useCountUp(score)
  const shownViews = useCountUp(video.views)
  const fit = clientFit(format, client)
  const tier = tierOf(score)
  // The numbers are the point of this panel, so they get their own row of cards.
  const stats = [
    {
      label: video.platform === 'reddit' ? 'Upvotes' : 'Views',
      value: compact(shownViews),
      note:
        video.comments !== undefined
          ? `${compact(video.comments)} comments`
          : video.followers
            ? `${compact(video.followers)} followers`
            : 'Follower count not available',
    },
    // Reddit and YouTube search results have no shares or saves to show.
    ...(video.platform === 'reddit' || video.platform === 'youtube'
      ? []
      : [
          {
            label: 'Shares + saves',
            value: `${shareSaveRate(video).toFixed(1)}`,
            unit: 'per 100 views',
            note: video.saves === null ? 'Instagram hides saves' : `${compact(video.shares)} shares · ${compact(video.saves)} saves`,
          },
        ]),
    hasDate(video)
      ? { label: 'Growth', value: compact(viewsPerDay(video)), unit: `${viewsWord(video)} a day`, note: `Posted ${ago(video.daysAgo)}` }
      : { label: 'Growth', value: '–', unit: '', note: 'Posting date unknown' },
    {
      label: 'Format used by',
      value: String(formatAccounts),
      unit: formatAccounts === 1 ? 'account' : 'accounts',
      note: formatAccounts >= 3 ? 'A pattern, not luck' : 'Too few to be sure',
    },
  ]

  return (
    <div
      className={`drawer-wrap${closing ? ' is-closing' : ''}`}
      onClick={close}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onClose()
      }}
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        ref={dialogRef}
        onKeyDown={trapTab}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-head">
          <div>
            <span className="eyebrow">
              {platformName[video.platform]} · {video.handle}
            </span>
            <h2 id="drawer-title">"{video.hook}"</h2>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-video">
            <Thumb video={video} large />
          </div>

          <section className="stats" aria-label="Video analytics">
            {hasScore(video) ? (
              <div className={`stat-card stat-score stat-${tier}`}>
                <span className="stat-label">Score</span>
                <div className="stat-score-row">
                  <span className="stat-big">{times(shownScore)}</span>
                  <span className={`tier tier-${tier}`}>{tierName[tier]}</span>
                </div>
                <span className="stat-note">{scoreLine(video)}</span>
                <span className="stat-compare">
                  {compact(video.medianViews ?? video.followers)} → <strong>{compact(shownViews)}</strong>
                </span>
              </div>
            ) : (
              <div className="stat-card stat-score">
                <span className="stat-label">Score</span>
                <span className="stat-big">–</span>
                <span className="stat-note">{scoreLine(video)}</span>
              </div>
            )}
            {stats.map((m) => (
              <div key={m.label} className="stat-card">
                <span className="stat-label">{m.label}</span>
                <span className="stat-value">
                  {m.value}
                  {m.unit && <span className="stat-unit"> {m.unit}</span>}
                </span>
                <span className="stat-note">{m.note}</span>
              </div>
            ))}
          </section>

          {video.live && (
            <section className="block live-facts">
              {video.url && (
                <a className="btn btn-ghost watch-link" href={video.url} target="_blank" rel="noreferrer">
                  Watch on {platformName[video.platform]} ↗
                </a>
              )}
              {video.caption && <p className="caption">{video.caption}</p>}
              {video.music && <span className="small muted">Sound: {video.music}</span>}
            </section>
          )}

          <section className={`block fit ${fit.ok ? 'fit-ok' : 'fit-no'}`}>
            <h3>Can {client.name} film it?</h3>
            <p>{fit.text}</p>
          </section>

          <section className="block">
            <h3>
              {video.live ? 'What we know' : 'Why it worked'}{' '}
              <span className="ai-tag">{video.live ? `From ${platformName[video.platform]} data` : 'Sample · written by hand'}</span>
            </h3>
            <dl className="why">
              <div>
                <dt>Hook</dt>
                <dd>{format.why.hook}</dd>
              </div>
              <div>
                <dt>First 3 seconds</dt>
                <dd>{format.why.first3s}</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>{format.why.length}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{format.why.format}</dd>
              </div>
              <div>
                <dt>Sound</dt>
                <dd>{format.why.sound}</dd>
              </div>
            </dl>
          </section>

        </div>

        <footer className="drawer-foot">
          <button className="btn btn-ghost" onClick={onSave}>
            {saved ? '★ Saved to client' : `Save to ${client.name}`}
          </button>
          <button className="btn btn-primary" onClick={onPlan}>
            Plan this for {client.name}
          </button>
        </footer>
      </aside>
    </div>
  )
}

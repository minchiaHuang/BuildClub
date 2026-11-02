import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Client, Format, IdeaStatus, Video } from '../types'
import {
  clientFit,
  compact,
  hasDate,
  byFollowers,
  hasScore,
  scoreBase,
  usualMultiple,
  outlierScore,
  scoreLine,
  platformName,
  shareSaveRate,
  viewsPerDay,
} from '../lib/metrics'
import { agoDays, beatUsual, timesNumber, viewsLabel } from './find/words'
import { t } from '../lib/i18n'
import { useCountUp } from '../lib/motion'
import { Thumb } from './Thumb'
import { useManagerName } from '../lib/appContext'
import { EvidenceChip } from './EvidenceChip'
import { fetchedLine, formulaLine, limitLines, sourceLine, type Cohort } from '../lib/evidence'

interface Props {
  video: Video
  format: Format
  // The accounts using this video's pattern in this search; the follow list reads the same rows.
  cohort?: Cohort
  // Sample mode only: videos in this video's hand-written format (the old count).
  formatAccounts: number
  client: Client
  // Where this video stands for the client, if it's been shortlisted or sent.
  status?: IdeaStatus
  onClose: () => void
  // Add to or take off the client's shortlist.
  onSave: () => void
  onPlan: () => void
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function BreakdownPanel({ video, format, cohort, formatAccounts: sampleAccounts, client, status, onClose, onSave, onPlan }: Props) {
  const manager = useManagerName()
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
    const timer = window.setTimeout(onClose, 400)
    return () => window.clearTimeout(timer)
  }, [closing, onClose])

  const score = outlierScore(video)
  // Count up once when the panel opens (final value straight away under reduced motion).
  const shownScore = useCountUp(score)
  const shownViews = useCountUp(video.views)
  const fit = clientFit(format, client)
  const formatAccounts = video.live ? (cohort?.accounts ?? 1) : sampleAccounts
  const source = sourceLine(video)
  const formula = formulaLine(video)
  const fetched = fetchedLine(video)
  // The numbers are the point of this panel, so they get their own row of cards.
  const stats = [
    {
      label: video.platform === 'reddit' ? t('find.bd.upvotes') : t('find.bd.views'),
      value: compact(shownViews),
      note:
        video.comments !== undefined
          ? t('find.tile.comments', { count: compact(video.comments) })
          : video.followers
            ? t('find.bd.followersNote', { count: compact(video.followers) })
            : t('find.bd.noFollowers'),
    },
    // Reddit and YouTube search results have no shares or saves to show.
    ...(video.platform === 'reddit' || video.platform === 'youtube'
      ? []
      : [
          {
            label: t('find.bd.sharesSaves'),
            value: `${shareSaveRate(video).toFixed(1)}`,
            unit: t('find.bd.per100'),
            note: video.saves === null ? t('find.bd.igHides') : t('find.bd.sharesSavesNote', { shares: compact(video.shares), saves: compact(video.saves) }),
          },
        ]),
    hasDate(video)
      ? { label: t('find.bd.growth'), value: compact(viewsPerDay(video)), unit: t('find.bd.aDay', { word: viewsLabel(video) }), note: t('find.bd.posted', { when: agoDays(video.daysAgo) }) }
      : { label: t('find.bd.growth'), value: '–', unit: '', note: t('find.bd.dateUnknown') },
    {
      label: t('find.bd.accounts'),
      value: String(formatAccounts),
      unit: formatAccounts === 1 ? t('find.bd.account') : t('find.bd.accountsUnit'),
      note: formatAccounts >= 3 ? t('find.bd.enough') : t('find.bd.tooFew'),
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
          <button ref={closeRef} className="icon-btn" onClick={close} aria-label={t('find.bd.close')}>
            ✕
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-video">
            <Thumb video={video} large />
          </div>

          <section className="stats" aria-label={t('find.bd.numbers')}>
            {hasScore(video) ? (
              <div className="stat-card stat-score">
                <span className="stat-label">{byFollowers(video) ? t('find.bd.vsFollowers') : t('find.bd.vsUsual')}</span>
                <div className="stat-score-row">
                  <span className="stat-big">{timesNumber(shownScore)}×</span>
                </div>
                <span className="stat-note">{beatUsual(video)}</span>
                <span className="stat-compare">
                  {compact(scoreBase(video))} → <strong>{compact(shownViews)}</strong>
                </span>
                {byFollowers(video) && usualMultiple(video) !== null && (
                  <span className="stat-note small muted">
                    {t('find.bd.usualMultiple', { x: timesNumber(usualMultiple(video) as number) })}
                  </span>
                )}
              </div>
            ) : (
              <div className="stat-card stat-score">
                <span className="stat-label">{t('find.bd.vsUsualShort')}</span>
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
                {video.live && <span className="stat-source">{source}</span>}
              </div>
            ))}
          </section>

          {video.live && (
            <section className="block calc" aria-labelledby="calc-title">
              <h3 id="calc-title">{t('find.bd.howCalc')}</h3>
              <EvidenceChip video={video} cohort={cohort} />
              {formula && <p className="calc-formula">{formula}</p>}
              {fetched && <p className="small muted">{fetched}</p>}
              <ul className="calc-limits">
                {limitLines(video).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <a className="link-btn" href="/method" target="_blank" rel="noreferrer">
                {t('find.bd.howCalcLink')}
              </a>
            </section>
          )}

          {video.live && (
            <section className="block live-facts">
              {video.url && (
                <a className="btn btn-ghost watch-link" href={video.url} target="_blank" rel="noreferrer">
                  {t('find.watchOn', { platform: platformName[video.platform] })} ↗
                </a>
              )}
              {video.caption && <p className="caption">{video.caption}</p>}
              {video.music && <span className="small muted">{t('find.bd.sound', { music: video.music })}</span>}
            </section>
          )}

          <section className={`block fit ${fit.ok ? 'fit-ok' : 'fit-no'}`}>
            <h3>{t('find.bd.canFilm', { client: client.name })}</h3>
            <p>{fit.text}</p>
          </section>

          <section className="block">
            <h3>{video.live ? t('find.bd.whatWeKnow') : t('find.bd.whyWorked')}</h3>
            <p className="small muted">
              {video.live ? t('find.bd.fromPlatform', { platform: platformName[video.platform] }) : t('find.bd.handwritten')}
            </p>
            <dl className="why">
              <div>
                <dt>{t('find.why.start')}</dt>
                <dd>{format.why.hook}</dd>
              </div>
              <div>
                <dt>{t('find.why.first3s')}</dt>
                <dd>{format.why.first3s}</dd>
              </div>
              <div>
                <dt>{t('find.why.length')}</dt>
                <dd>{format.why.length}</dd>
              </div>
              <div>
                <dt>{t('find.why.made')}</dt>
                <dd>{format.why.format}</dd>
              </div>
              <div>
                <dt>{t('find.why.sound')}</dt>
                <dd>{format.why.sound}</dd>
              </div>
            </dl>
          </section>

          {format.lines && format.lines.length > 0 && (
            <section className="block">
              <h3>{t('find.bd.lineRoles')}</h3>
              <ul className="line-roles">
                {format.lines.map((l, i) => (
                  <li key={i}>
                    <span className="shot-time">{l.time}</span> <span className="ai-tag">{t(`shell.role.${l.role}`)}</span> <span>{l.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>

        <footer className="drawer-foot">
          {!status && (
            <button className="btn btn-primary" onClick={onSave}>
              {t('find.saveFor', { client: client.name })}
            </button>
          )}
          {status === 'saved' && (
            <>
              <button className="btn btn-ghost" aria-pressed="true" onClick={onSave}>
                {t('find.savedMark')}
              </button>
              <button className="btn btn-primary" onClick={onPlan}>
                {t('find.openPlan')}
              </button>
            </>
          )}
          {status && status !== 'saved' && (
            <button className="btn btn-primary" onClick={onPlan}>
              {status === 'waiting' ? t('find.planWaiting', { manager }) : status === 'approved' ? t('find.planApproved') : t('find.planSentBack')}
            </button>
          )}
        </footer>
      </aside>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { TopicResults } from './publish/TopicResults'
import { useCountUp } from '../lib/motion'
import { resultsShortcuts, useResultsShortcuts } from '../lib/useShortcuts'
import type { Format, IdeaStatus, Platform, Video } from '../types'
import type { Query, Sort } from '../state'
import type { FormatTrend } from '../lib/metrics'
import type { Interpretation } from '../lib/parseQuery'
import type { Answer } from '../lib/answer'
import { byFollowers, compact, hasDate, scoreBase, groupFailures, hasScore, outlierScore, platformName, tierOf } from '../lib/metrics'
import { beatUsual, daysAgoWords, platformsText, spreadSentence, viewsLabel } from './find/words'
import { t, tp } from '../lib/i18n'
import { VideoTile } from './VideoTile'
import { BestVideo } from './BestVideo'
import { EvidenceChip } from './EvidenceChip'
import { cachedLabel, type Cohort } from '../lib/evidence'
import { PlatformLogo } from './PlatformToggles'
import { ErrorText } from './ErrorText'
import { SearchBox } from './SearchBox'
import type { PulseInfo } from './ClientChips'
import type { ChipGroup } from '../lib/clientChips'
import { useManagerName } from '../lib/appContext'

export type Chip =
  | { kind: 'keyword'; value: string }
  | { kind: 'topic'; formatId: string }
  | { kind: 'audience' }
  | { kind: 'days' }
  | { kind: 'platforms' }
  | { kind: 'length' }
  | { kind: 'source' }

interface Props {
  query: Query
  setQuery: (q: Query) => void
  interp: Interpretation
  answer: Answer | null
  formats: Format[]
  allVideos: Video[]
  onSearch: (text: string) => void
  onImage?: (file: File) => void
  onRemoveChip: (chip: Chip) => void
  likeThis: React.ReactNode
  // Live mode: real TikTok results, with a sounds-and-hashtags strip instead of hand-written formats.
  live: boolean
  // Platforms whose search failed in this live search; the rest still show.
  failed: { platform: Platform; message: string }[]
  // Platforms that answered with no videos.
  empty: Platform[]
  // Live mode: account medians are still being fetched, so scores will update in place.
  scoring: boolean
  patterns: React.ReactNode
  // Same-pattern accounts for each video id (live TikTok only); drives the evidence label.
  cohorts: Map<string, Cohort>
  results: Video[]
  trends: FormatTrend[]
  sort: Sort
  setSort: (s: Sort) => void
  formatFilter: string | null
  setFormatFilter: (id: string | null) => void
  // Status of each video's plan for this client (shortlisted, sent, approved…).
  ideaStatus: Map<string, IdeaStatus>
  onOpen: (id: string) => void
  // Add to or take off the client's shortlist.
  onToggleSave: (id: string) => void
  onGoShortlist: () => void
  // Formats this client can't film (e.g. needs a kitchen), so they never lead the page.
  blockedFormatIds: Set<string>
  clientName: string
  onPlan: (id: string) => void
  // Same search box as the search page, so a new search can start right here.
  clientExamples: string[]
  chipGroups: ChipGroup[]
  pulse: PulseInfo
  onRefreshPulse: () => void
}

export function ResultsScreen(p: Props) {
  const manager = useManagerName()
  const shown = p.formatFilter ? p.results.filter((v) => v.formatId === p.formatFilter) : p.results
  const activeTrend = p.trends.find((tr) => tr.format.id === p.formatFilter)
  const [draft, setDraft] = useState(p.interp.text)
  const [helpOpen, setHelpOpen] = useState(false)
  // Only show "Saved. You'll find it in Plans." right after the Save button is pressed here, not for ideas saved earlier.
  const [justSaved, setJustSaved] = useState<string | null>(null)
  useResultsShortcuts({
    onToggleSave: p.onToggleSave,
    onPlan: p.onPlan,
    onToggleHelp: () => setHelpOpen((o) => !o),
    onCloseHelp: () => setHelpOpen(false),
    searchInputId: 'toolbar-keyword',
  })
  // Best to copy: the top-scoring video whose format several accounts are using (early or rising),
  // that isn't already sent or approved and that this client can film. Falls back to the top score.
  const trendOf = (v: Video) => p.trends.find((tr) => tr.format.id === v.formatId)
  const ranked = [...shown].sort((a, b) => outlierScore(b) - outlierScore(a) || b.views - a.views)
  const open = ranked.filter((v) => {
    const s = p.ideaStatus.get(v.id)
    return s !== 'waiting' && s !== 'approved' && !p.blockedFormatIds.has(v.formatId)
  })
  const proven = open.filter((v) => ['early', 'rising'].includes(trendOf(v)?.stage ?? ''))
  const best = proven[0] ?? open[0] ?? ranked[0]
  const bestTrend = best && trendOf(best)
  const bestStatus = best ? p.ideaStatus.get(best.id) : undefined
  const platformCounts = (['tiktok', 'instagram', 'youtube', 'reddit', 'x'] as Platform[])
    .map((pl) => {
      const vs = shown.filter((v) => v.platform === pl)
      // Each platform has its own search, so its cache state comes from its own videos.
      const cached = p.live ? vs.filter((v) => v.fromCache) : []
      const fetchedAt = cached.length ? Math.max(...cached.map((v) => v.fetchedAt ?? 0)) : 0
      return { pl, n: vs.length, cache: cached.length ? cachedLabel(fetchedAt, Date.now()) : null }
    })
    .filter((x) => x.n > 0)
  const platformNames = platformsText(platformCounts.map((x) => x.pl))
  const shortlisted = [...p.ideaStatus.values()].filter((s) => s === 'saved').length
  const i = p.interp
  const queryLabel = i.source ? '' : i.text.trim()

  // What we understood from the search, as plain removable words (no coloured tags).
  const chips: { chip: Chip; label: string }[] = [
    ...(i.source ? [{ chip: { kind: 'source' } as Chip, label: t('find.res.likeChip', { label: i.source.label }) }] : []),
    ...i.keywords.map((k) => ({ chip: { kind: 'keyword', value: k } as Chip, label: k })),
    ...(i.source ? [] : i.topics).map((tp2) => ({
      chip: { kind: 'topic', formatId: tp2.formatId } as Chip,
      // Show the word she typed ("crispy"), not the internal format name.
      label: tp2.word,
    })),
    ...(i.audience ? [{ chip: { kind: 'audience' } as Chip, label: t('find.res.forAudience', { audience: i.audience }) }] : []),
    ...(i.days ? [{ chip: { kind: 'days' } as Chip, label: t('find.res.lastDays', { days: i.days }) }] : []),
    ...(i.platforms ? [{ chip: { kind: 'platforms' } as Chip, label: i.platforms.map((x) => platformName[x]).join(' + ') }] : []),
    ...(i.maxLength ? [{ chip: { kind: 'length' } as Chip, label: t('find.res.underSeconds', { n: i.maxLength }) }] : []),
  ]

  const filterControls = (
    <>
      <select
        id="toolbar-days"
        aria-label={t('find.res.postedIn')}
        value={p.query.days}
        onChange={(e) => p.setQuery({ ...p.query, days: Number(e.target.value) })}
      >
        <option value={7}>{t('find.res.last7')}</option>
        <option value={30}>{t('find.res.last30')}</option>
        <option value={90}>{t('find.res.last90')}</option>
        <option value={3650}>{t('find.res.anyTime')}</option>
      </select>
      <select
        id="toolbar-length"
        aria-label={t('find.res.videoLength')}
        value={p.query.maxLength}
        onChange={(e) => p.setQuery({ ...p.query, maxLength: Number(e.target.value) })}
      >
        <option value={0}>{t('find.res.anyLength')}</option>
        <option value={15}>{t('find.res.under15')}</option>
        <option value={30}>{t('find.res.under30')}</option>
        <option value={60}>{t('find.res.under60')}</option>
      </select>
      <label className="sort">
        <span>{t('find.res.sortBy')}</span>
        <select id="toolbar-sort" value={p.sort} onChange={(e) => p.setSort(e.target.value as Sort)}>
          <option value="outlier">{t('find.res.sortOutlier')}</option>
          <option value="ratio">{t('find.res.sortRatio')}</option>
          <option value="newest">{t('find.res.sortNewest')}</option>
          <option value="fastest">{t('find.res.sortFastest')}</option>
        </select>
      </label>
    </>
  )

  return (
    <section className="results">
      <SearchBox
        inputId="toolbar-keyword"
        value={draft}
        onValueChange={setDraft}
        onSearch={p.onSearch}
        onImage={p.onImage}
        platforms={p.query.platforms}
        onPlatformsChange={(platforms) => p.setQuery({ ...p.query, platforms })}
        live={p.live}
        clientName={p.clientName}
        clientExamples={p.clientExamples}
        chipGroups={p.chipGroups}
        pulse={p.pulse}
        onRefreshPulse={p.onRefreshPulse}
        hideChips
      />

      <div className="understood">
        <span className="field-label">{t('find.res.searchingFor')}</span>
        {chips.length === 0 && <span className="muted small">{t('find.res.nothingYet')}</span>}
        {chips.map(({ chip, label }) => (
          <span key={label} className="q-chip">
            {label}
            <button
              type="button"
              className="q-chip-x"
              aria-label={t('find.res.remove', { label })}
              onClick={() => p.onRemoveChip(chip)}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      {groupFailures(p.failed).map((g) => (
        <p key={g.platforms.join()} className="error" role="alert">
          {platformsText(g.platforms)}: <ErrorText text={g.message} onSearch={p.onSearch} />
        </p>
      ))}

      {p.scoring && (
        <p className="small muted" role="status">
          {t('find.res.scoring')}
        </p>
      )}

      {p.empty.map((pl) => (
        <p key={pl} className="error" role="alert">
          {t('find.res.noVideos', { platform: platformName[pl] })}
        </p>
      ))}

      {p.likeThis}

      {p.answer && (
        <div className="answer" role="note">
          <div className="answer-head">
            <strong>{i.text.trim()}</strong>
          </div>
          {p.answer.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <span className="small muted">
            {t('find.res.sampleAnswer', { basis: p.answer.basis })}
          </span>
        </div>
      )}

      {p.results.length === 0 ? (
        <>
          <div className="filters">{filterControls}</div>
          <div className="empty">
            <h2>{t('find.res.emptyTitle')}</h2>
            <p>
              {p.live
                ? t('find.res.emptyLive')
                : t('find.res.emptyDemo')}
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="summary">
            {t('find.res.foundPre')}
            <strong>{shown.length}</strong>
            {tp('find.res.foundPost', shown.length, { platforms: platformNames })}
            {queryLabel && <>{t('find.res.forQuery', { q: queryLabel })}</>}
            {t('find.res.endStop')}
            {platformCounts.length > 1 &&
              platformCounts.map(({ pl, n }) => (
                <span key={pl} className="summary-platform" title={platformName[pl]}>
                  <PlatformLogo platform={pl} size={16} />
                  {n}
                </span>
              ))}
            {platformCounts.map(({ pl, cache }) =>
              cache ? (
                <span key={`cache-${pl}`} className="summary-cached">
                  {platformName[pl]} · {cache}
                </span>
              ) : null,
            )}
          </p>
          <TopicResults text={queryLabel ?? ''} />

          {best && (
            <div className="best-head">
              <h1 className="best-title">{t('find.res.bestTitle', { client: p.clientName })}</h1>
              <p className="best-why">
                {bestTrend && ['early', 'rising'].includes(bestTrend.stage)
                  ? t('find.res.bestWhyTrend')
                  : t('find.res.bestWhyTop')}
              </p>
            </div>
          )}
          {best && (
            <div className="best">
              <BestVideo key={best.id} video={best} onOpen={() => p.onOpen(best.id)} />
              <div className="best-body">
                {bestTrend && <p className="best-trend">{spreadSentence(bestTrend)}.</p>}
                <strong className="best-hook">"{best.hook}"</strong>
                <EvidenceChip video={best} cohort={p.cohorts.get(best.id)} />
                <span className="small muted">
                  {hasScore(best) && best.platform !== 'reddit'
                    ? t('find.res.viewsFromFollowers', { views: compact(best.views), followers: compact(best.followers) })
                    : t('find.res.viewsWord', { views: compact(best.views), word: viewsLabel(best) })}
                  {best.comments !== undefined && t('find.res.commentsSentence', { count: compact(best.comments) })}
                  {t('find.res.postedBy', { handle: best.handle, when: hasDate(best) ? t('find.res.postedWhen', { when: daysAgoWords(best.daysAgo) }) : '' })}
                </span>
                {/* Usual → this video, so the jump reads without decoding the × score. Keyed so it animates once per pick. */}
                {hasScore(best) && <BestCompare key={best.id} video={best} />}
                <div className="best-actions">
                  {bestStatus === 'saved' ? (
                    <button className="btn btn-primary" aria-pressed="true" onClick={() => { setJustSaved(null); p.onToggleSave(best.id) }}>
                      {t('find.res.savedFor', { client: p.clientName })}
                    </button>
                  ) : bestStatus ? (
                    <button className="btn btn-primary" onClick={() => p.onPlan(best.id)}>
                      {bestStatus === 'waiting' ? t('find.planWaiting', { manager }) : bestStatus === 'approved' ? t('find.planApproved') : t('find.planSentBack')}
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => { setJustSaved(best.id); p.onToggleSave(best.id) }}>
                      {t('find.saveFor', { client: p.clientName })}
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={() => p.onOpen(best.id)}>
                    {t('find.seeWhy')}
                  </button>
                </div>
                {bestStatus === 'saved' && justSaved === best.id && (
                  <p className="saved-where small" role="status">
                    <span>
                      {t('find.res.savedWhere1')}
                      <strong>{t('find.res.savedWhere2')}</strong>
                      {t('find.res.savedWhere3')}
                    </span>
                    <button className="link-btn" onClick={p.onGoShortlist}>
                      {t('find.res.goPlans')}
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid-head">
            <div className="grid-title">
              <h2>
                {p.live ? t('find.res.allVideos') : activeTrend ? activeTrend.format.name : t('find.res.allVideos')}{' '}
                <span className="muted">· {shown.length}</span>
              </h2>
              <p className="section-sub">
                {p.live
                  ? t('find.res.gridSubLive')
                  : t('find.res.gridSubDemo')}
              </p>
            </div>
            <div className="filters">
              {filterControls}
              <ShortcutsHint open={helpOpen} setOpen={setHelpOpen} />
            </div>
          </div>

          <div className="grid">
            {shown.map((v) => (
              <VideoTile
                key={v.id}
                video={v}
                onOpen={() => p.onOpen(v.id)}
                onToggleSave={() => p.onToggleSave(v.id)}
                status={p.ideaStatus.get(v.id)}
                cohort={p.cohorts.get(v.id)}
              />
            ))}
          </div>
        </>
      )}

      {shortlisted > 0 && (
        <div className="shortlist-tray" role="status">
          <span>
            <strong>{shortlisted}</strong> {tp('find.res.trayLead', shortlisted, { client: p.clientName })}
          </span>
          <button className="btn btn-primary btn-sm" onClick={p.onGoShortlist}>
            {t('find.res.planShots')}
          </button>
        </div>
      )}
    </section>
  )
}

// Small "?" button by the toolbar with a popover listing the keyboard shortcuts (also opens with ?).
function ShortcutsHint({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, setOpen])
  return (
    <div className="kbd-hint" ref={wrap}>
      <button
        type="button"
        className="kbd-hint-btn"
        aria-label={t('find.res.kbdLabel')}
        title={t('find.res.kbdTitle')}
        aria-expanded={open}
        aria-controls="kbd-hint-pop"
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open && (
        <div className="kbd-hint-pop" id="kbd-hint-pop" role="note" aria-label={t('find.res.kbdLabel')}>
          <strong className="kbd-hint-title">{t('find.res.kbdLabel')}</strong>
          <dl>
            {resultsShortcuts().map((s) => (
              <div key={s.keys}>
                <dt>
                  {s.keys.split(' / ').map((k, i) => (
                    <span key={k}>
                      {i > 0 && ' / '}
                      <kbd>{k}</kbd>
                    </span>
                  ))}
                </dt>
                <dd>{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

// Usual → this video for the Best to copy card. The big number counts up and the bar grows in
// when the card first appears (or a new video takes the spot), not on every render.
function BestCompare({ video }: { video: Video }) {
  const usual = scoreBase(video)
  const tier = tierOf(outlierScore(video))
  const followers = byFollowers(video)
  const shownViews = useCountUp(video.views)
  // How big the usual is next to this video, as a share of the bar (kept visible even when tiny).
  const usualShare = Math.min(Math.max(usual / Math.max(video.views, 1), 0.02), 1)
  return (
    <div className="best-compare" aria-label={beatUsual(video)}>
      <span className="cmp-num cmp-from">{compact(usual)}</span>
      <span className="cmp-arrow" aria-hidden="true">→</span>
      <span className="cmp-num cmp-to">{compact(shownViews)}</span>
      <span className="cmp-cap">{followers ? t('find.res.cmpFollowers') : t('find.res.cmpUsual')}</span>
      <span />
      <span className="cmp-cap">{t('find.res.cmpThis')}</span>
      <span className="cmp-bar" aria-hidden="true" style={{ '--usual': usualShare } as React.CSSProperties}>
        <span className={`cmp-bar-this score-${tier}`} />
        <span className="cmp-bar-usual" />
      </span>
      <span className="cmp-say">{beatUsual(video)}</span>
    </div>
  )
}

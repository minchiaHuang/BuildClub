import { useEffect, useRef, useState } from 'react'
import { useCountUp } from '../lib/motion'
import { resultsShortcuts, useResultsShortcuts } from '../lib/useShortcuts'
import type { Format, IdeaStatus, Platform, Video } from '../types'
import type { Query, Sort } from '../state'
import type { FormatTrend } from '../lib/metrics'
import type { Interpretation } from '../lib/parseQuery'
import type { Answer } from '../lib/answer'
import { agoShort, compact, hasDate, groupFailures, hasScore, outlierScore, platformList, platformName, plural, scoreLine, stageText, tierName, tierOf, times, viewsWord } from '../lib/metrics'
import { VideoTile } from './VideoTile'
import { BestVideo } from './BestVideo'
import { EvidenceChip } from './EvidenceChip'
import { cachedLabel, type Cohort } from '../lib/evidence'
import { PlatformLogo } from './PlatformToggles'
import { ErrorText } from './ErrorText'
import { SearchBox } from './SearchBox'
import type { PulseInfo } from './ClientChips'
import type { ChipGroup } from '../lib/clientChips'

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
  patterns: React.ReactNode
  // Same-pattern accounts for each video id (live TikTok only); drives the evidence label.
  cohorts: Map<string, Cohort>
  results: Video[]
  trends: FormatTrend[]
  sort: Sort
  setSort: (s: Sort) => void
  formatFilter: string | null
  setFormatFilter: (id: string | null) => void
  savedVideoIds: Set<string>
  // Status of each video's plan for this client (saved, sent, approved…).
  ideaStatus: Map<string, IdeaStatus>
  onOpen: (id: string) => void
  onToggleSave: (id: string) => void
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

const stageLabel = {
  early: 'Early',
  rising: 'Rising',
  everywhere: 'Peaked',
  'one-off': 'One-off',
}

export function ResultsScreen(p: Props) {
  const shown = p.formatFilter ? p.results.filter((v) => v.formatId === p.formatFilter) : p.results
  const activeTrend = p.trends.find((t) => t.format.id === p.formatFilter)
  const [draft, setDraft] = useState(p.interp.text)
  const [helpOpen, setHelpOpen] = useState(false)
  useResultsShortcuts({
    onToggleSave: p.onToggleSave,
    onPlan: p.onPlan,
    onToggleHelp: () => setHelpOpen((o) => !o),
    onCloseHelp: () => setHelpOpen(false),
    searchInputId: 'toolbar-keyword',
  })
  // Best to copy: the top-scoring video whose format several accounts are using (early or rising),
  // that isn't already sent or approved and that this client can film. Falls back to the top score.
  const trendOf = (v: Video) => p.trends.find((t) => t.format.id === v.formatId)
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
  const i = p.interp
  const queryLabel = i.source ? '' : i.text.trim()

  const chips: { chip: Chip; label: string; tone?: string }[] = [
    ...(i.source ? [{ chip: { kind: 'source' } as Chip, label: `like: ${i.source.label}`, tone: 'topic' }] : []),
    ...i.keywords.map((k) => ({ chip: { kind: 'keyword', value: k } as Chip, label: k })),
    ...(i.source ? [] : i.topics).map((t) => ({
      chip: { kind: 'topic', formatId: t.formatId } as Chip,
      // Show the word she typed ("crispy"), not the internal format name.
      label: t.word,
    })),
    ...(i.audience ? [{ chip: { kind: 'audience' } as Chip, label: `audience: ${i.audience}`, tone: 'audience' }] : []),
    ...(i.days ? [{ chip: { kind: 'days' } as Chip, label: `last ${i.days} days` }] : []),
    ...(i.platforms ? [{ chip: { kind: 'platforms' } as Chip, label: i.platforms.map((x) => platformName[x]).join(' + ') }] : []),
    ...(i.maxLength ? [{ chip: { kind: 'length' } as Chip, label: `under ${i.maxLength} sec` }] : []),
  ]

  const filterControls = (
    <>
      <select
        id="toolbar-days"
        aria-label="Posted in"
        value={p.query.days}
        onChange={(e) => p.setQuery({ ...p.query, days: Number(e.target.value) })}
      >
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
        <option value={3650}>Any time</option>
      </select>
      <select
        id="toolbar-length"
        aria-label="Video length"
        value={p.query.maxLength}
        onChange={(e) => p.setQuery({ ...p.query, maxLength: Number(e.target.value) })}
      >
        <option value={0}>Any length</option>
        <option value={15}>Under 15 sec</option>
        <option value={30}>Under 30 sec</option>
        <option value={60}>Under 60 sec</option>
      </select>
      <label className="sort">
        <span>Sort by</span>
        <select id="toolbar-sort" value={p.sort} onChange={(e) => p.setSort(e.target.value as Sort)}>
          <option value="outlier">Outlier score</option>
          <option value="ratio">Views ÷ followers</option>
          <option value="newest">Newest</option>
          <option value="fastest">Fastest growing</option>
        </select>
      </label>
      <span
        className="info"
        tabIndex={0}
        title={
          p.live
            ? 'The score compares views with the account’s followers. 77× means 77 times more views than followers, so the idea travelled far beyond the account’s own audience. Breakout = 100× or more, Strong = 10× or more, Normal = under 10×.'
            : 'The score compares views with what the account usually gets. 77× means 77 times its usual views, so the idea did the work, not the account’s size. Breakout = 100× or more, Strong = 10× or more, Normal = under 10×.'
        }
      >
        ⓘ What the × score means
      </span>
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
      />

      <div className="understood">
        <span className="field-label">Searching for</span>
        {chips.length === 0 && <span className="muted small">Nothing yet. Type a niche like "tofu".</span>}
        {chips.map(({ chip, label, tone }) => (
          <span key={label} className={`q-chip ${tone ? `q-chip-${tone}` : ''}`}>
            {label}
            <button
              type="button"
              className="q-chip-x"
              aria-label={`Remove ${label}`}
              onClick={() => p.onRemoveChip(chip)}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      {groupFailures(p.failed).map((g) => (
        <p key={g.platforms.join()} className="error" role="alert">
          {platformList(g.platforms)}: <ErrorText text={g.message} onSearch={p.onSearch} />
        </p>
      ))}

      {p.empty.map((pl) => (
        <p key={pl} className="error" role="alert">
          {platformName[pl]}: No videos found.
        </p>
      ))}

      {p.likeThis}

      {p.answer && (
        <div className="answer" role="note">
          <div className="answer-head">
            <strong>{i.text.trim()}</strong>
            <span className="ai-tag">{p.live ? 'Answer · from these results' : 'Answer · sample'}</span>
          </div>
          {p.answer.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <span className="small muted">{p.answer.basis}</span>
        </div>
      )}

      {p.results.length === 0 ? (
        <>
          <div className="filters">{filterControls}</div>
          <div className="empty">
            <h2>No videos match all of that</h2>
            <p>
              {p.live
                ? 'Try a broader search, or widen the date and length filters. TikTok search often returns older videos.'
                : 'Try removing a chip above, or widen the date and length filters. The sample data only covers tofu for now.'}
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="summary">
            <strong>{plural(shown.length, 'video')}</strong>
            {queryLabel && <> for "{queryLabel}"</>}
            {platformCounts.map(({ pl, n }) => (
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

          {best && <h1 className="best-title">Best to copy</h1>}
          {best && (
            <div className="best">
              <BestVideo key={best.id} video={best} onOpen={() => p.onOpen(best.id)} />
              <div className="best-body">
                {bestTrend && (
                  <span className="best-trend">
                    <span className={`stage-pill stage-pill-${bestTrend.stage}`}>{stageLabel[bestTrend.stage]}</span>
                    {stageText(bestTrend)}
                  </span>
                )}
                <strong className="best-hook">"{best.hook}"</strong>
                <EvidenceChip video={best} cohort={p.cohorts.get(best.id)} />
                <span className="small muted">
                  {hasScore(best) && best.platform !== 'reddit'
                    ? `${compact(best.views)} views from an account with ${compact(best.followers)} followers`
                    : `${compact(best.views)} ${viewsWord(best)}`}
                  {best.comments !== undefined && ` · ${compact(best.comments)} comments`}{' '}
                  ·{' '}
                  {best.handle}
                  {hasDate(best) && ` · ${agoShort(best.daysAgo)} ago`}
                </span>
                {/* Usual → this video, so the jump reads without decoding the × score. Keyed so it animates once per pick. */}
                {hasScore(best) && <BestCompare key={best.id} video={best} />}
                <div className="best-actions">
                  <button className="btn btn-primary" onClick={() => p.onPlan(best.id)}>
                    {bestStatus && bestStatus !== 'saved'
                      ? `Open plan · ${bestStatus === 'waiting' ? 'Waiting for Annie' : bestStatus === 'approved' ? 'Approved' : 'Not approved'}`
                      : bestStatus === 'saved'
                        ? 'Continue plan'
                        : `Plan this for ${p.clientName}`}
                  </button>
                  <button className="btn btn-ghost" onClick={() => p.onOpen(best.id)}>
                    See why it worked
                  </button>
                </div>
              </div>
            </div>
          )}

          {p.patterns ??
            (p.trends.length > 1 && (
              <div className="format-filter" role="group" aria-label="Filter by format">
                <span className="field-label">Formats in these results</span>
                <div className="chip-row">
                  {p.trends.map((t) => {
                    const active = p.formatFilter === t.format.id
                    return (
                      <button
                        key={t.format.id}
                        type="button"
                        className={`fchip ${active ? 'fchip-on' : ''}`}
                        aria-pressed={active}
                        title={stageText(t)}
                        onClick={() => p.setFormatFilter(active ? null : t.format.id)}
                      >
                        <span className={`stage-pill stage-pill-${t.stage}`}>{stageLabel[t.stage]}</span>
                        {t.format.name}
                        <span className="fchip-count">{plural(t.accounts, 'account')}</span>
                      </button>
                    )
                  })}
                  {p.formatFilter && (
                    <button type="button" className="link-btn" onClick={() => p.setFormatFilter(null)}>
                      Show all
                    </button>
                  )}
                </div>
              </div>
            ))}

          <div className="grid-head">
            <h2>
              {p.live ? 'All videos' : activeTrend ? activeTrend.format.name : 'All videos'}{' '}
              <span className="muted">· {shown.length}</span>
            </h2>
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
                saved={p.savedVideoIds.has(v.id)}
                onOpen={() => p.onOpen(v.id)}
                onToggleSave={() => p.onToggleSave(v.id)}
                status={p.ideaStatus.get(v.id)}
                cohort={p.cohorts.get(v.id)}
              />
            ))}
          </div>
        </>
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
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        aria-expanded={open}
        aria-controls="kbd-hint-pop"
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open && (
        <div className="kbd-hint-pop" id="kbd-hint-pop" role="note" aria-label="Keyboard shortcuts">
          <strong className="kbd-hint-title">Keyboard shortcuts</strong>
          <dl>
            {resultsShortcuts.map((s) => (
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
  const usual = video.medianViews ?? video.followers
  const tier = tierOf(outlierScore(video))
  const shownViews = useCountUp(video.views)
  // How big the usual is next to this video, as a share of the bar (kept visible even when tiny).
  const usualShare = Math.min(Math.max(usual / Math.max(video.views, 1), 0.02), 1)
  return (
    <div className="best-compare" aria-label={scoreLine(video)}>
      <span className="cmp-num cmp-from">{compact(usual)}</span>
      <span className="cmp-arrow" aria-hidden="true">→</span>
      <span className={`cmp-num cmp-to score-${tier}`}>{compact(shownViews)}</span>
      <span className="cmp-cap">{video.medianViews === null ? 'followers' : 'usual views'}</span>
      <span />
      <span className="cmp-cap">this video</span>
      <span className="cmp-bar" aria-hidden="true" style={{ '--usual': usualShare } as React.CSSProperties}>
        <span className={`cmp-bar-this score-${tier}`} />
        <span className="cmp-bar-usual" />
      </span>
      <span className={`tier tier-${tier} cmp-tier`}>
        {tierName[tier]} · {times(outlierScore(video))}
      </span>
    </div>
  )
}

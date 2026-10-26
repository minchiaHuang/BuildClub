import { useState } from 'react'
import type { Format, Platform, Video } from '../types'
import type { Query, Sort } from '../state'
import type { FormatTrend } from '../lib/metrics'
import type { Interpretation } from '../lib/parseQuery'
import type { Answer } from '../lib/answer'
import { agoShort, compact, outlierScore, platformName, plural, stageText, tierOf, times } from '../lib/metrics'
import { VideoTile } from './VideoTile'
import { Thumb } from './Thumb'
import { PlatformLogo, PlatformToggles } from './PlatformToggles'
import { Suggestions } from './Suggestions'
import { focusFirstSuggestion } from '../lib/suggest'

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
  onRemoveChip: (chip: Chip) => void
  likeThis: React.ReactNode
  // Live mode: real TikTok results, with a sounds-and-hashtags strip instead of hand-written formats.
  live: boolean
  patterns: React.ReactNode
  results: Video[]
  trends: FormatTrend[]
  sort: Sort
  setSort: (s: Sort) => void
  formatFilter: string | null
  setFormatFilter: (id: string | null) => void
  savedVideoIds: Set<string>
  onOpen: (id: string) => void
  onToggleSave: (id: string) => void
  clientName: string
  onPlan: (id: string) => void
  // The sound, hashtag or format that's spreading most, for the summary line.
  spreading: string | null
}

const stageLabel = {
  early: 'Early',
  rising: 'Rising',
  everywhere: 'Everywhere',
  'one-off': 'One-off',
}

export function ResultsScreen(p: Props) {
  const shown = p.formatFilter ? p.results.filter((v) => v.formatId === p.formatFilter) : p.results
  const activeTrend = p.trends.find((t) => t.format.id === p.formatFilter)
  const [draft, setDraft] = useState(p.interp.text)
  const best = shown.length ? [...shown].sort((a, b) => outlierScore(b) - outlierScore(a))[0] : undefined
  const platformCounts = (['tiktok', 'instagram'] as Platform[])
    .map((pl) => ({ pl, n: shown.filter((v) => v.platform === pl).length }))
    .filter((x) => x.n > 0)
  const i = p.interp
  const queryLabel = i.source ? '' : i.keywords.join(' ')

  const chips: { chip: Chip; label: string; tone?: string }[] = [
    ...(i.source ? [{ chip: { kind: 'source' } as Chip, label: `like: ${i.source.label}`, tone: 'topic' }] : []),
    ...i.keywords.map((k) => ({ chip: { kind: 'keyword', value: k } as Chip, label: k })),
    ...(i.source ? [] : i.topics).map((t) => ({
      chip: { kind: 'topic', formatId: t.formatId } as Chip,
      label: `format: ${p.formats.find((f) => f.id === t.formatId)?.name ?? t.word}`,
      tone: 'topic',
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
            ? "Score = views ÷ the account's followers. Small accounts with big views rank first. Breakout = 100× or more, Strong = 10× or more."
            : "Outlier score = views ÷ the account's usual views. Breakout = 100× or more, Strong = 10× or more."
        }
      >
        ⓘ How scores work
      </span>
    </>
  )

  return (
    <section className="results">
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          p.onSearch(draft)
        }}
      >
        <PlatformToggles
          selected={p.query.platforms}
          onChange={(platforms) => p.setQuery({ ...p.query, platforms })}
          live={p.live}
        />
        <div className="toolbar-row">
          <input
            id="toolbar-keyword"
            className="toolbar-search"
            aria-label="Search a niche, or ask a question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={focusFirstSuggestion}
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </div>
      </form>

      {draft !== i.text && !p.live && (
        <Suggestions
          text={draft}
          formats={p.formats}
          videos={p.allVideos}
          inputId="toolbar-keyword"
          onRefine={setDraft}
          onAsk={(q) => {
            setDraft(q)
            p.onSearch(q)
          }}
        />
      )}

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

      {p.likeThis}

      {p.answer && (
        <div className="answer" role="note">
          <div className="answer-head">
            <strong>{i.text.trim()}</strong>
            <span className="ai-tag">Answer · sample</span>
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
            {best && (
              <>
                {' '}· best one beat its account <strong>{times(outlierScore(best))}</strong>
              </>
            )}
            {p.spreading && (
              <>
                {' '}· <strong>{p.spreading}</strong> is spreading
              </>
            )}
          </p>

          {best && (
            <div className="best">
              <button className="best-cover" onClick={() => p.onOpen(best.id)} aria-label={`Open breakdown: ${best.hook}`}>
                <Thumb video={best} />
              </button>
              <div className="best-body">
                <span className="eyebrow">Best to copy</span>
                <strong className="best-hook">"{best.hook}"</strong>
                <span className="small muted">
                  {compact(best.views)} views from an account with {compact(best.followers)} followers ·{' '}
                  {best.handle} · {agoShort(best.daysAgo)} ago
                </span>
                <div className="best-actions">
                  <button className="btn btn-primary" onClick={() => p.onPlan(best.id)}>
                    Plan a version for {p.clientName}
                  </button>
                  <button className="btn btn-ghost" onClick={() => p.onOpen(best.id)}>
                    See why it worked
                  </button>
                </div>
              </div>
              <span className={`score score-${tierOf(outlierScore(best))} best-score`}>{times(outlierScore(best))}</span>
            </div>
          )}

          {p.patterns ?? (
            <div className="trends">
              <div className="section-head">
                <h2>What's spreading</h2>
                {p.formatFilter && (
                  <button className="btn btn-ghost btn-sm" onClick={() => p.setFormatFilter(null)}>
                    Show all formats
                  </button>
                )}
              </div>
              <div className="trend-row">
                {p.trends.map((t) => {
                  const active = p.formatFilter === t.format.id
                  return (
                    <button
                      key={t.format.id}
                      className={`trend-card stage-${t.stage} ${active ? 'trend-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => p.setFormatFilter(active ? null : t.format.id)}
                    >
                      <span className={`stage-pill stage-pill-${t.stage}`}>{stageLabel[t.stage]}</span>
                      <strong>{t.format.name}</strong>
                      <span className="trend-text">{stageText(t)}</span>
                      <span className="trend-counts">
                        <PlatformLogo platform="tiktok" size={12} /> {t.counts.tiktok}
                        <PlatformLogo platform="instagram" size={12} /> {t.counts.instagram}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid-head">
            <h2>
              {p.live ? 'All videos' : activeTrend ? activeTrend.format.name : 'All videos'}{' '}
              <span className="muted">· {shown.length}</span>
            </h2>
            <div className="filters">{filterControls}</div>
          </div>

          <div className="grid">
            {shown.map((v) => (
              <VideoTile
                key={v.id}
                video={v}
                saved={p.savedVideoIds.has(v.id)}
                onOpen={() => p.onOpen(v.id)}
                onToggleSave={() => p.onToggleSave(v.id)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

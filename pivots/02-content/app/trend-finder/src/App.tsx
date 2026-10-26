import { useCallback, useEffect, useMemo, useState } from 'react'
import type { IdeaStatus, SavedIdea } from './types'
import { clients, formats, videos } from './data/sample'
import { formatTrend, outlierScore, stageOrder, viewsPerDay, viewsPerFollower } from './lib/metrics'
import { defaultQuery, inTwoWeeks, useSavedIdeas } from './state'
import type { Query, Sort } from './state'
import { SearchScreen } from './components/SearchScreen'
import { ResultsScreen } from './components/ResultsScreen'
import type { Chip } from './components/ResultsScreen'
import { interpretMedia, matchesKeyword, parseQuery } from './lib/parseQuery'
import type { Interpretation, MediaSource } from './lib/parseQuery'
import type { Attachment } from './components/SearchScreen'
import { LikeThisCard } from './components/LikeThisCard'
import { ReadingOverlay } from './components/ReadingOverlay'
import { buildAnswer } from './lib/answer'
import { BreakdownPanel } from './components/BreakdownPanel'
import { ClientScreen } from './components/ClientScreen'
import { PlanScreen } from './components/PlanScreen'

type View = 'search' | 'results' | 'client' | 'plan'

const sorters: Record<Sort, (a: (typeof videos)[number], b: (typeof videos)[number]) => number> = {
  outlier: (a, b) => outlierScore(b) - outlierScore(a),
  ratio: (a, b) => viewsPerFollower(b) - viewsPerFollower(a),
  newest: (a, b) => a.daysAgo - b.daysAgo,
  fastest: (a, b) => viewsPerDay(b) - viewsPerDay(a),
}

export default function App() {
  const [view, setView] = useState<View>('search')
  const [query, setQuery] = useState<Query>(defaultQuery)
  const [sort, setSort] = useState<Sort>('outlier')
  const [formatFilter, setFormatFilter] = useState<string | null>(null)
  const [openVideoId, setOpenVideoId] = useState<string | null>(null)
  const [planIdeaId, setPlanIdeaId] = useState<string | null>(null)
  const [ideas, setIdeas] = useSavedIdeas()

  // Each screen starts at the top, like a new page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  const client = clients.find((c) => c.id === query.clientId) ?? clients[0]
  const videoById = useMemo(() => new Map(videos.map((v) => [v.id, v])), [])

  const [interp, setInterp] = useState<Interpretation>(() => parseQuery('tofu', formats))
  const formatById = useMemo(() => new Map(formats.map((f) => [f.id, f])), [])

  // Turn the search box text into filters. Anything the text mentions (time, platform, length)
  // overrides the dropdowns; everything else keeps its current value.
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [reading, setReading] = useState<MediaSource | null>(null)

  const runSearch = (text: string) => {
    const media = interpretMedia(text, attachment, formats)
    const next = media ?? parseQuery(text, formats)
    setInterp(next)
    if (media) {
      // Pretend to read the video first; the overlay switches to results when it's done.
      setQuery((q) => ({ ...q, keyword: next.text, platforms: defaultQuery.platforms, days: 90, maxLength: 0 }))
      setFormatFilter(null)
      setReading(media.source)
      setAttachment(null)
      return
    }
    setQuery((q) => ({
      ...q,
      keyword: text,
      days: next.days ?? q.days,
      platforms: next.platforms ?? q.platforms,
      maxLength: next.maxLength ?? q.maxLength,
    }))
    setFormatFilter(null)
    setView('results')
  }

  const finishReading = useCallback(() => {
    setReading(null)
    setView('results')
  }, [])

  const removeChip = (chip: Chip) => {
    if (chip.kind === 'source') {
      setInterp((x) => ({ ...x, source: null, topics: [], keywords: ['tofu'] }))
      setAttachment(null)
    }
    if (chip.kind === 'keyword') setInterp((x) => ({ ...x, keywords: x.keywords.filter((k) => k !== chip.value) }))
    if (chip.kind === 'topic') setInterp((x) => ({ ...x, topics: x.topics.filter((t) => t.formatId !== chip.formatId) }))
    if (chip.kind === 'audience') setInterp((x) => ({ ...x, audience: null }))
    if (chip.kind === 'days') {
      setInterp((x) => ({ ...x, days: null }))
      setQuery((q) => ({ ...q, days: defaultQuery.days }))
    }
    if (chip.kind === 'platforms') {
      setInterp((x) => ({ ...x, platforms: null }))
      setQuery((q) => ({ ...q, platforms: defaultQuery.platforms }))
    }
    if (chip.kind === 'length') {
      setInterp((x) => ({ ...x, maxLength: null }))
      setQuery((q) => ({ ...q, maxLength: 0 }))
    }
  }

  // Everything matching the words, before platform/date/length filters.
  // Format labels use this pool so a filter can't make a trend look "early".
  const keywordPool = useMemo(() => {
    if (interp.keywords.length === 0) return interp.topics.length || interp.audience ? videos : []
    return videos.filter((v) => interp.keywords.some((k) => matchesKeyword(v, formatById.get(v.formatId), k)))
  }, [interp, formatById])

  const results = useMemo(
    () =>
      keywordPool
        .filter((v) => query.platforms.includes(v.platform))
        .filter((v) => v.daysAgo <= query.days)
        .filter((v) => !query.maxLength || v.lengthSec <= query.maxLength)
        .filter((v) => !interp.topics.length || interp.topics.some((t) => t.formatId === v.formatId))
        .filter((v) => !interp.audience || formatById.get(v.formatId)!.audiences.includes(interp.audience))
        .sort(sorters[sort]),
    [keywordPool, query, sort, interp, formatById],
  )

  const trends = useMemo(
    () =>
      formats
        .filter((f) => results.some((v) => v.formatId === f.id))
        .map((f) => formatTrend(f, keywordPool))
        .sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage]),
    [results, keywordPool],
  )

  const answer = useMemo(() => buildAnswer(interp, results, trends), [interp, results, trends])

  const savedForClient = new Set(ideas.filter((i) => i.clientId === client.id).map((i) => i.videoId))

  const saveIdea = (videoId: string): SavedIdea => {
    const existing = ideas.find((i) => i.videoId === videoId && i.clientId === client.id)
    if (existing) return existing
    const v = videoById.get(videoId)!
    const f = formats.find((x) => x.id === v.formatId)!
    const idea: SavedIdea = {
      id: `${client.id}-${videoId}`,
      videoId,
      clientId: client.id,
      status: 'saved',
      dueDate: inTwoWeeks(),
      notes: f.editorNotes,
    }
    setIdeas((prev) => [...prev, idea])
    return idea
  }

  const toggleSave = (videoId: string) => {
    if (savedForClient.has(videoId)) {
      setIdeas((prev) => prev.filter((i) => !(i.videoId === videoId && i.clientId === client.id)))
    } else {
      saveIdea(videoId)
    }
  }

  const planFromVideo = (videoId: string) => {
    const idea = saveIdea(videoId)
    setPlanIdeaId(idea.id)
    setOpenVideoId(null)
    setView('plan')
  }

  const likeFormat = interp.source ? formatById.get(interp.topics[0]?.formatId ?? '') : undefined

  const setStatus = (ids: string[], status: IdeaStatus) =>
    setIdeas((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, status } : i)))

  const openVideo = openVideoId ? videoById.get(openVideoId) : undefined
  const openFormat = openVideo && formats.find((f) => f.id === openVideo.formatId)
  const planIdea = ideas.find((i) => i.id === planIdeaId)
  const planVideo = planIdea && videoById.get(planIdea.videoId)
  const planFormat = planVideo && formats.find((f) => f.id === planVideo.formatId)
  const planClient = planIdea && clients.find((c) => c.id === planIdea.clientId)
  const clientIdeaCount = ideas.filter((i) => i.clientId === client.id).length

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView('search')}>
          <span className="brand-mark" aria-hidden="true">
            ↗
          </span>
          Trend Finder
        </button>
        <nav className="nav">
          <button className={`nav-btn ${view === 'search' ? 'nav-on' : ''}`} onClick={() => setView('search')}>
            Search
          </button>
          <button className={`nav-btn ${view === 'results' ? 'nav-on' : ''}`} onClick={() => setView('results')}>
            Results
          </button>
          <button
            className={`nav-btn ${view === 'client' || view === 'plan' ? 'nav-on' : ''}`}
            onClick={() => setView('client')}
          >
            {client.name}
            {clientIdeaCount > 0 && <span className="count">{clientIdeaCount}</span>}
          </button>
        </nav>
        <span className="sample-pill" title="All accounts and numbers are made up for this demo">
          Sample data
        </span>
      </header>

      <main className="main">
        {view === 'search' && (
          <SearchScreen
            query={query}
            setQuery={setQuery}
            onSearch={runSearch}
            attachment={attachment}
            setAttachment={setAttachment}
          />
        )}

        {view === 'results' && (
          <ResultsScreen
            query={query}
            setQuery={setQuery}
            interp={interp}
            answer={answer}
            formats={formats}
            allVideos={videos}
            onSearch={runSearch}
            onRemoveChip={removeChip}
            likeThis={
              interp.source && likeFormat ? (
                <LikeThisCard
                  source={interp.source}
                  format={likeFormat}
                  trend={trends.find((t) => t.format.id === likeFormat.id)}
                  matches={results}
                  clientName={client.name}
                  onPlan={planFromVideo}
                />
              ) : null
            }
            results={results}
            trends={trends}
            sort={sort}
            setSort={setSort}
            formatFilter={formatFilter}
            setFormatFilter={setFormatFilter}
            savedVideoIds={savedForClient}
            onOpen={setOpenVideoId}
            onToggleSave={toggleSave}
          />
        )}

        {view === 'client' && (
          <ClientScreen
            clients={clients}
            clientId={client.id}
            setClientId={(id) => setQuery({ ...query, clientId: id })}
            ideas={ideas}
            videoById={videoById}
            setStatus={setStatus}
            onRemove={(id) => setIdeas((prev) => prev.filter((i) => i.id !== id))}
            onPlan={(id) => {
              setPlanIdeaId(id)
              setView('plan')
            }}
            onFindMore={() => setView('search')}
          />
        )}

        {view === 'plan' && planIdea && planVideo && planFormat && planClient && (
          <PlanScreen
            idea={planIdea}
            video={planVideo}
            format={planFormat}
            client={planClient}
            onChange={(patch) => setIdeas((prev) => prev.map((i) => (i.id === planIdea.id ? { ...i, ...patch } : i)))}
            onBack={() => setView('client')}
          />
        )}
      </main>

      {openVideo && openFormat && (
        <BreakdownPanel
          video={openVideo}
          format={openFormat}
          formatAccounts={keywordPool.filter((v) => v.formatId === openFormat.id).length}
          client={client}
          saved={savedForClient.has(openVideo.id)}
          onClose={() => setOpenVideoId(null)}
          onSave={() => toggleSave(openVideo.id)}
          onPlan={() => planFromVideo(openVideo.id)}
        />
      )}

      {reading && <ReadingOverlay source={reading} onDone={finishReading} />}
    </div>
  )
}

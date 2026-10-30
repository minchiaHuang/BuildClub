import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgencySettings, ClientEvent, Role, SavedIdea } from './types'
import { clients as sampleClients, formats, videos } from './data/sample'
import { formatTrend, outlierScore, stageOrder, viewsPerDay, viewsPerFollower } from './lib/metrics'
import { defaultAgency, defaultQuery, inTwoWeeks, useSavedIdeas, useStored } from './state'
import type { Query, Sort, Workspace } from './state'
import { SearchScreen } from './components/SearchScreen'
import { ResultsScreen } from './components/ResultsScreen'
import type { Chip } from './components/ResultsScreen'
import { interpretMedia, matchesKeyword, parseQuery } from './lib/parseQuery'
import type { Interpretation, MediaSource } from './lib/parseQuery'
import { LikeThisCard } from './components/LikeThisCard'
import { ReadingOverlay } from './components/ReadingOverlay'
import { buildAnswer } from './lib/answer'
import { BreakdownPanel } from './components/BreakdownPanel'
import { PlanScreen } from './components/PlanScreen'
import { Sidebar } from './components/Sidebar'
import type { View } from './components/Sidebar'
import { OverviewScreen } from './components/OverviewScreen'
import { ReviewScreen } from './components/ReviewScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { LoginScreen } from './components/LoginScreen'
import type { Client, Format, Video } from './types'
import { checkLive, findPatterns, searchLive } from './lib/live'
import { buildChipGroups, clientTopic, pulseFrom } from './lib/clientChips'
import type { Pulse } from './lib/clientChips'
import { PatternStrip } from './components/PatternStrip'
import { LiveLoading } from './components/LiveLoading'
import { withScreenTransition } from './lib/motion'
import { AppContext } from './lib/appContext'
import type { AppContextValue } from './lib/appContext'
import { ShortlistBoard } from './components/ShortlistBoard'
import { AddClientScreen } from './components/AddClientScreen'

const sorters: Record<Sort, (a: (typeof videos)[number], b: (typeof videos)[number]) => number> = {
  outlier: (a, b) => outlierScore(b) - outlierScore(a),
  ratio: (a, b) => viewsPerFollower(b) - viewsPerFollower(a),
  newest: (a, b) => a.daysAgo - b.daysAgo,
  fastest: (a, b) => viewsPerDay(b) - viewsPerDay(a),
}

export default function App() {
  const [signedIn, setSignedIn] = useStored('trend-finder.signed-in', false)
  const [clients, setClients] = useStored<Client[]>('trend-finder.clients.v3', sampleClients)
  const [agency, setAgencyRaw] = useStored<AgencySettings>('remake.agency.v1', defaultAgency)
  const [role, setRole] = useStored<Role>('remake.role.v1', 'member')
  const [workspace, setWorkspaceRaw] = useStored<Workspace>('trend-finder.workspace.v2', sampleClients[0].id)
  const [view, setViewRaw] = useState<View>(() => (workspace === 'all' ? 'overview' : 'search'))
  // Every screen change goes through here, so it cross-fades (View Transitions) where supported.
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  const setView = useCallback((next: View) => {
    if (next === viewRef.current) return setViewRaw(next)
    withScreenTransition(() => setViewRaw(next))
  }, [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState<Query>(defaultQuery)
  const [sort, setSort] = useState<Sort>('outlier')
  const [formatFilter, setFormatFilter] = useState<string | null>(null)
  const [openVideoId, setOpenVideoId] = useState<string | null>(null)
  const [planIdeaId, setPlanIdeaId] = useState<string | null>(null)
  // The screen a plan was opened from, so Back returns there.
  const [planFrom, setPlanFrom] = useState<View>('results')
  // The last search that produced results, so the search page can offer a way back to it.
  const [lastSearch, setLastSearch] = useState<string | null>(null)
  const [ideas, setIdeas] = useSavedIdeas()

  // Live mode: real TikTok search through the local API (npm run api). Without it, the app uses sample data.
  const [live, setLive] = useState(false)
  const [liveStore, setLiveStore] = useStored<{ videos: Video[]; formats: Format[] }>('trend-finder.live-store.v1', {
    videos: [],
    formats: [],
  })
  const [liveResults, setLiveResults] = useState<Video[]>([])
  const [liveQuery, setLiveQuery] = useState('')
  const [searching, setSearching] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [patternFilter, setPatternFilter] = useState<string | null>(null)

  // Daily live trend check per client, which powers the "Trending now" chips on the search page.
  const [pulses, setPulses] = useStored<Record<string, Pulse>>('trend-finder.pulse.v1', {})
  const [pulseLoading, setPulseLoading] = useState<string | null>(null)
  const [pulseError, setPulseError] = useState<string | null>(null)
  const pulseTried = useRef(new Set<string>())

  useEffect(() => {
    checkLive().then((ok) => {
      setLive(ok)
      // TikTok's top results are often older, so live search starts with no date limit.
      if (ok) setQuery((q) => ({ ...q, days: 3650 }))
    })
  }, [])

  // Each screen starts at the top, like a new page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  // Inside a client, everything (saving, fit checks, plans) is for that client.
  const client = clients.find((c) => c.id === workspace) ?? clients[0]

  const setWorkspace = (w: Workspace) => {
    setWorkspaceRaw(w)
    setOpenVideoId(null)
    // Picking a client from the switcher always starts on Search.
    setView(w === 'all' ? 'overview' : 'search')
  }

  const updateClient = (patch: Partial<Client>) =>
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...patch } : c)))
  const videoById = useMemo(
    () => new Map([...videos, ...liveStore.videos].map((v) => [v.id, v])),
    [liveStore.videos],
  )

  const [interp, setInterp] = useState<Interpretation>(() => parseQuery('tofu', formats))
  const formatById = useMemo(
    () => new Map([...formats, ...liveStore.formats].map((f) => [f.id, f])),
    [liveStore.formats],
  )

  // Turn the search box text into filters. Anything the text mentions (time, platform, length)
  // overrides the dropdowns; everything else keeps its current value.
  const [reading, setReading] = useState<MediaSource | null>(null)

  const runLiveSearch = async (text: string) => {
    if (/https?:\/\//.test(text)) {
      setSearchError("Link search isn't live yet. Type what the video is about instead.")
      return
    }
    const parsed = parseQuery(text, formats)
    // Send TikTok the meaningful words; time and length words become filters instead.
    const q = ([...parsed.keywords, ...parsed.topics.map((t) => t.word)].join(' ') || text).trim()
    if (!q) return
    setSearchError(null)
    setSearching(q)
    try {
      const res = await searchLive(q)
      setLiveStore((prev) => {
        const keep = (list: { id: string }[], add: { id: string }[]) => {
          const ids = new Set(add.map((x) => x.id))
          return [...add, ...list.filter((x) => !ids.has(x.id))].slice(0, 600)
        }
        return { videos: keep(prev.videos, res.videos) as Video[], formats: keep(prev.formats, res.formats) as Format[] }
      })
      setLiveResults(res.videos)
      setLiveQuery(q)
      setInterp({ ...parsed, text, keywords: [q], topics: [], audience: null, isQuestion: false, source: null })
      setQuery((qq) => ({ ...qq, keyword: text, days: parsed.days ?? qq.days, maxLength: parsed.maxLength ?? qq.maxLength }))
      setPatternFilter(null)
      setFormatFilter(null)
      setLastSearch(text)
      setView('results')
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setSearching(null)
    }
  }

  const runSearch = (text: string) => {
    if (live) {
      void runLiveSearch(text)
      return
    }
    // Screenshot attachments are switched off for now; pasted video links still work in sample mode.
    const media = interpretMedia(text, null, formats)
    const next = media ?? parseQuery(text, formats)
    setInterp(next)
    if (media) {
      // Pretend to read the video first; the overlay switches to results when it's done.
      setQuery((q) => ({ ...q, keyword: next.text, platforms: defaultQuery.platforms, days: 90, maxLength: 0 }))
      setFormatFilter(null)
      setReading(media.source)
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
    setLastSearch(text)
    setView('results')
  }

  // Start the next video from a clean search page (new idea), keeping the last results one click away.
  const planAnother = () => {
    setQuery((q) => ({ ...q, keyword: '' }))
    setView('search')
  }

  const refreshPulse = useCallback(
    async (c: Client, fresh: boolean) => {
      const topic = clientTopic(c)
      setPulseLoading(c.id)
      setPulseError(null)
      try {
        const res = await searchLive(topic, fresh)
        setPulses((prev) => ({ ...prev, [c.id]: pulseFrom(topic, res.videos, findPatterns(res.videos, topic)) }))
      } catch (e) {
        setPulseError(e instanceof Error ? e.message : 'Trend check failed.')
      } finally {
        setPulseLoading(null)
      }
    },
    [setPulses],
  )

  // Check once a day per client, when its search page opens. Each attempt runs once per session, even if it fails.
  useEffect(() => {
    if (!live || workspace === 'all' || view !== 'search' || pulseLoading) return
    const topic = clientTopic(client)
    const p = pulses[client.id]
    const stale = !p || p.topic !== topic || Date.now() - p.fetchedAt > 24 * 3_600_000
    const key = `${client.id}|${topic}`
    if (stale && !pulseTried.current.has(key)) {
      pulseTried.current.add(key)
      void refreshPulse(client, false)
    }
  }, [live, workspace, view, client, pulses, pulseLoading, refreshPulse])

  const finishReading = useCallback(() => {
    setReading(null)
    setView('results')
  }, [setView])

  const removeChip = (chip: Chip) => {
    if (chip.kind === 'source') {
      setInterp((x) => ({ ...x, source: null, topics: [], keywords: ['tofu'] }))
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
    if (live) return liveResults
    if (interp.keywords.length === 0) return interp.topics.length || interp.audience ? videos : []
    return videos.filter((v) => interp.keywords.some((k) => matchesKeyword(v, formatById.get(v.formatId), k)))
  }, [interp, formatById, live, liveResults])

  const patterns = useMemo(() => (live ? findPatterns(liveResults, liveQuery) : []), [live, liveResults, liveQuery])

  const results = useMemo(() => {
    const pattern = patterns.find((x) => x.label === patternFilter)
    return keywordPool
      .filter((v) => live || query.platforms.includes(v.platform))
      .filter((v) => v.daysAgo <= query.days)
      .filter((v) => !query.maxLength || v.lengthSec <= query.maxLength)
      .filter((v) => live || !interp.topics.length || interp.topics.some((t) => t.formatId === v.formatId))
      .filter((v) => live || !interp.audience || formatById.get(v.formatId)!.audiences.includes(interp.audience))
      .filter((v) => !pattern || pattern.videoIds.includes(v.id))
      .sort(sorters[sort])
  }, [keywordPool, query, sort, interp, formatById, live, patterns, patternFilter])

  const trends = useMemo(
    () =>
      (live ? [] : formats)
        .filter((f) => results.some((v) => v.formatId === f.id))
        .map((f) => formatTrend(f, keywordPool))
        .sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage]),
    [results, keywordPool, live],
  )

  const answer = useMemo(() => (live ? null : buildAnswer(interp, results, trends)), [interp, results, trends, live])

  // Live mode shows only ideas saved from real videos; sample mode only sample ones.
  const shownIdeas = ideas.filter((i) => Boolean(videoById.get(i.videoId)?.live) === live)

  const chipGroups = buildChipGroups({
    client,
    live,
    pulse: pulses[client.id],
    ideas: shownIdeas,
    videoById,
    formatById,
    sampleFormats: formats,
    sampleVideos: videos,
  })

  const savedForClient = new Set(shownIdeas.filter((i) => i.clientId === client.id).map((i) => i.videoId))

  const saveIdea = (videoId: string): SavedIdea => {
    const existing = ideas.find((i) => i.videoId === videoId && i.clientId === client.id)
    if (existing) return existing
    const v = videoById.get(videoId)!
    const f = formatById.get(v.formatId)!
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

  // stream B: toggles the shortlist. Only a shortlisted idea comes off; one already sent stays put.
  const toggleSave = (videoId: string) => {
    const existing = ideas.find((i) => i.videoId === videoId && i.clientId === client.id)
    if (!existing) saveIdea(videoId)
    else if (existing.status === 'saved') setIdeas((prev) => prev.filter((i) => i.id !== existing.id))
  }

  const openPlan = (ideaId: string) => {
    setPlanFrom(view)
    setPlanIdeaId(ideaId)
    setView('plan')
  }

  // stream B: a video not on the shortlist yet is only added to it (the tray shows it); a shortlisted one opens its plan.
  const planFromVideo = (videoId: string) => {
    const idea = saveIdea(videoId)
    if (!savedForClient.has(videoId)) return
    setOpenVideoId(null)
    openPlan(idea.id)
  }

  const likeFormat = interp.source ? formatById.get(interp.topics[0]?.formatId ?? '') : undefined

  const recordEvent = (clientId: string, event: ClientEvent) =>
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, memory: [...(c.memory ?? []), event] } : c)))

  // The manager's answer on a plan they were sent. Every decision is also remembered on the client.
  const decide = (ideaId: string, approved: boolean, reason?: string) => {
    const idea = ideas.find((i) => i.id === ideaId)
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === ideaId
          ? {
              ...i,
              status: approved ? 'approved' : 'rejected',
              rejectReason: approved ? undefined : reason,
              approvedAt: approved ? Date.now() : undefined,
            }
          : i,
      ),
    )
    if (idea) recordEvent(idea.clientId, { ideaId, kind: approved ? 'approved' : 'sent-back', reason, at: Date.now() })
  }

  const appContext: AppContextValue = {
    agency,
    setAgency: (patch) => setAgencyRaw((a) => ({ ...a, ...patch })),
    role,
    setRole,
    addClient: (c) => setClients((prev) => [...prev, c]),
    recordEvent,
  }

  const openVideo = openVideoId ? videoById.get(openVideoId) : undefined
  const openFormat = openVideo && formatById.get(openVideo.formatId)
  const planIdea = ideas.find((i) => i.id === planIdeaId)
  const planVideo = planIdea && videoById.get(planIdea.videoId)
  const planFormat = planVideo && formatById.get(planVideo.formatId)
  const planClient = planIdea && clients.find((c) => c.id === planIdea.clientId)
  const mine = shownIdeas.filter((i) => i.clientId === client.id)
  const blockedFormatIds = new Set(
    [...formatById.values()].filter((f) => f.needs.some((n) => client.cannot.includes(n))).map((f) => f.id),
  )
  const backLabel: Record<View, string> = {
    overview: 'overview',
    search: 'search',
    results: 'search results',
    saved: 'saved ideas',
    approvals: 'approvals',
    review: `${agency.managerName}'s review`,
    plans: 'plans',
    plan: 'search results',
    settings: 'settings',
    shortlist: 'shortlist',
    'add-client': 'add client',
  }
  const counts = { shortlist: mine.length }

  if (!signedIn)
    return (
      <AppContext.Provider value={appContext}>
        <LoginScreen onSignIn={() => setSignedIn(true)} />
      </AppContext.Provider>
    )

  const inClient = workspace !== 'all'

  return (
    <AppContext.Provider value={appContext}>
    <div className="shell">
      <Sidebar
        clients={clients}
        workspace={workspace}
        setWorkspace={setWorkspace}
        view={view}
        setView={setView}
        counts={counts}
        onSignOut={() => setSignedIn(false)}
        onAddClient={() => setView('add-client')}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        live={live}
      />

      <div className="shell-main">
        <header className="mobile-bar">
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <strong>{inClient ? client.name : 'All clients'}</strong>
        </header>

        <main className="main">
          {view === 'add-client' && (
            <AddClientScreen
              onCreated={(id) => setWorkspace(id)}
              onCancel={() => setView(inClient ? 'search' : 'overview')}
            />
          )}

          {((!inClient && view !== 'add-client') || view === 'overview') && (
            <OverviewScreen
              clients={clients}
              ideas={shownIdeas}
              onOpen={(id, v) => {
                setWorkspaceRaw(id)
                // stream B: saved ideas and approvals now live on the shortlist board.
                setView(v === 'search' ? 'search' : 'shortlist')
              }}
            />
          )}

          {inClient && view === 'search' && (
            <SearchScreen
              query={query}
              setQuery={setQuery}
              onSearch={runSearch}
              clientName={client.name}
              live={live}
              clientExamples={client.examples}
              error={searchError}
              chipGroups={chipGroups}
              pulse={{
                live,
                loading: pulseLoading === client.id,
                fetchedAt: pulses[client.id]?.fetchedAt,
                topic: clientTopic(client),
                error: pulseError,
              }}
              onRefreshPulse={() => void refreshPulse(client, true)}
              planned={shownIdeas.filter((i) => i.clientId === client.id && (i.status === 'waiting' || i.status === 'approved')).length}
              target={client.monthlyTarget}
              lastSearch={lastSearch}
              onBackToResults={() => setView('results')}
            />
          )}

          {inClient && view === 'results' && (
            <ResultsScreen
              query={query}
              setQuery={setQuery}
              interp={interp}
              answer={answer}
              formats={formats}
              allVideos={videos}
              onSearch={runSearch}
              onRemoveChip={removeChip}
              clientName={client.name}
              onPlan={planFromVideo}
              clientExamples={client.examples}
              chipGroups={chipGroups}
              pulse={{
                live,
                loading: pulseLoading === client.id,
                fetchedAt: pulses[client.id]?.fetchedAt,
                topic: clientTopic(client),
                error: pulseError,
              }}
              onRefreshPulse={() => void refreshPulse(client, true)}
              live={live}
              patterns={
                live ? (
                  <PatternStrip patterns={patterns} active={patternFilter} onPick={setPatternFilter} />
                ) : null
              }
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
              ideaStatus={new Map(shownIdeas.filter((i) => i.clientId === client.id).map((i) => [i.videoId, i.status]))}
              onOpen={setOpenVideoId}
              onToggleSave={toggleSave}
              onGoShortlist={() => setView('shortlist')} // stream B: shortlist tray
              blockedFormatIds={blockedFormatIds}
            />
          )}

          {inClient && view === 'shortlist' && (
            <ShortlistBoard
              client={client}
              ideas={shownIdeas}
              videoById={videoById}
              formatById={formatById}
              onChangeIdeas={setIdeas}
              onOpenPlan={openPlan}
              onFindMore={() => setView('search')}
              onReview={() => setView('review')}
            />
          )}

          {inClient && view === 'review' && (
            <ReviewScreen
              client={client}
              ideas={shownIdeas}
              formatById={formatById}
              videoById={videoById}
              onDecide={decide}
              onBack={() => setView('shortlist')}
            />
          )}

          {inClient && view === 'settings' && <SettingsScreen client={client} onChange={updateClient} />}

          {inClient && view === 'plan' && planIdea && planVideo && planFormat && planClient && (
            <PlanScreen
              idea={planIdea}
              video={planVideo}
              format={planFormat}
              client={planClient}
              onChange={(patch) => setIdeas((prev) => prev.map((i) => (i.id === planIdea.id ? { ...i, ...patch } : i)))}
              onBack={() => setView(planFrom)}
              backLabel={backLabel[planFrom]}
              onFindMore={planAnother}
              onPlanAnother={planAnother}
              onGoApprovals={() => setView('shortlist')} // stream B: the board replaces Approvals
            />
          )}
        </main>
      </div>

      {openVideo && openFormat && (
        <BreakdownPanel
          video={openVideo}
          format={openFormat}
          formatAccounts={keywordPool.filter((v) => v.formatId === openFormat.id).length}
          client={client}
          status={shownIdeas.find((i) => i.clientId === client.id && i.videoId === openVideo.id)?.status} // stream B
          onClose={() => setOpenVideoId(null)}
          onSave={() => toggleSave(openVideo.id)}
          onPlan={() => planFromVideo(openVideo.id)}
        />
      )}

      {reading && <ReadingOverlay source={reading} onDone={finishReading} />}
      {searching && <LiveLoading query={searching} />}
    </div>
    </AppContext.Provider>
  )
}

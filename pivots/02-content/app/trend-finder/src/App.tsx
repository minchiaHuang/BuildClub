import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgencySettings, ClientEvent, IdeaStatus, Role, SavedIdea } from './types'
import { clients as sampleClients, formats, sampleIdeas, videos } from './data/sample'
import { formatTrend, groupFailures, hasDate, outlierScore, platformList, platformName, stageOrder, viewsPerDay, viewsPerFollower } from './lib/metrics'
import { defaultAgency, defaultQuery, inTwoWeeks, useSavedIdeas, useStored } from './state'
import type { Query, Sort, Workspace } from './state'
import { SearchScreen } from './components/SearchScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { PatternStrip } from './components/PatternStrip'
import type { Chip } from './components/ResultsScreen'
import { interpretMedia, matchesKeyword, parseQuery } from './lib/parseQuery'
import type { Interpretation, MediaSource } from './lib/parseQuery'
import { LikeThisCard } from './components/LikeThisCard'
import { ReadingOverlay } from './components/ReadingOverlay'
import { buildAnswer } from './lib/answer'
import type { Answer } from './lib/answer'
import { BreakdownPanel } from './components/BreakdownPanel'
import { COHORT_PLATFORMS, cohortsByPattern, cohortsByVideo, fillBaseline } from './lib/evidence'
import { PlanScreen } from './components/PlanScreen'
import { Sidebar } from './components/Sidebar'
import type { View } from './components/Sidebar'
import { OverviewScreen } from './components/OverviewScreen'
import { ReviewScreen } from './components/ReviewScreen'
// stream C: decisions and client memory
import { applyDecision, type Decision } from './lib/memory'
import { SettingsScreen } from './components/SettingsScreen'
import { PreferencesScreen } from './components/PreferencesScreen'
import { ChannelScreen } from './components/ChannelScreen'
import { LoginScreen } from './components/LoginScreen'
import type { Client, Format, Platform, Video } from './types'
import {
  analyzeVideo,
  applyBreakdown,
  askAnswer,
  checkDemo,
  checkLive,
  checkNeeds,
  findPatterns,
  likeImage,
  likeVideo,
  loadIdeas,
  loadLibrary,
  loadList,
  IdeasConflict,
  SaveError,
  saveIdeas,
  saveLibrary,
  saveList,
  searchAll,
  searchLive,
} from './lib/live'
import { buildChipGroups, clientTopic, pulseFrom } from './lib/clientChips'
import type { Pulse } from './lib/clientChips'
import { LiveLoading } from './components/LiveLoading'
import { withScreenTransition } from './lib/motion'
import { htmlLang, readLang, setActiveLang, t, writeLang } from './lib/i18n'
import type { Key, Lang, Vars } from './lib/i18n'
import { AppContext } from './lib/appContext'
import type { AppContextValue } from './lib/appContext'
import { ShortlistBoard } from './components/ShortlistBoard'
import { AddClientScreen } from './components/AddClientScreen'
import { logout, me, type Account } from './lib/auth'
import { nextView, onUnauthorized } from './lib/authGate'
import { markMigrated, pickInitialIdeas, wasMigrated } from './lib/migrateLocal'
import { applyDraft, keepUnsavedDraft, rebaseIdeas, sameIdeaList, withoutSamples } from './lib/ideasSync'

// Where the user was when the session ended, so signing back in returns there (also after a reload).
const RETURN_KEY = 'remake.return-to.v1'
// Edits not yet on the server when the session ended, kept so a reload before signing back in doesn't lose them.
const DRAFT_KEY = 'remake.draft-ideas.v1'
interface ReturnTo {
  view: View
  workspace: Workspace
  planIdeaId: string | null
}
import { ClientHome } from './components/ClientHome'

const sorters: Record<Sort, (a: (typeof videos)[number], b: (typeof videos)[number]) => number> = {
  outlier: (a, b) => outlierScore(b) - outlierScore(a),
  ratio: (a, b) => viewsPerFollower(b) - viewsPerFollower(a),
  newest: (a, b) => a.daysAgo - b.daysAgo,
  fastest: (a, b) => viewsPerDay(b) - viewsPerDay(a),
}

// Stands in for the selected client while there are none (a real-mode account that hasn't added one yet).
const NO_CLIENT: Client = { id: '', name: '', niche: '', audience: '', monthlyTarget: 0, examples: [], cannot: [] }
const VIEW_KEY = 'remake.view.v1'

// The tab to open on a refresh: the one saved for this browser tab, if it still makes sense.
// Results, a plan and Review need state that isn't saved, so they fall back to Find ideas or Plans.
function restoreTab(workspace: Workspace): View {
  let saved: string | null = null
  try {
    saved = sessionStorage.getItem(VIEW_KEY)
  } catch {
    // Storage blocked: use the default.
  }
  if (workspace === 'all') return 'overview'
  if (saved === 'results') return 'search'
  if (saved === 'plan' || saved === 'review') return 'shortlist'
  if (saved === 'home' || saved === 'search' || saved === 'shortlist' || saved === 'settings') return saved
  return 'search'
}

export default function App() {
  const [signedIn, setSignedIn] = useStored('trend-finder.signed-in', false)
  const [clients, setClients] = useStored<Client[]>('trend-finder.clients.v3', sampleClients)
  const [agency, setAgencyRaw] = useStored<AgencySettings>('remake.agency.v1', defaultAgency)
  const [role, setRole] = useStored<Role>('remake.role.v2', 'manager')
  const [lang, setLangState] = useState<Lang>(() => readLang())
  const setLang = useCallback((l: Lang) => {
    writeLang(l)
    setLangState(l)
  }, [])
  const [workspace, setWorkspaceRaw] = useStored<Workspace>('trend-finder.workspace.v2', sampleClients[0].id)
  // The last client worked on. Log-in reopens it; empty means a first-ever log-in. Visiting All clients keeps it.
  const [lastClient, setLastClient] = useStored<string | null>('remake.last-client.v1', null)
  // A refresh keeps the same tab (this browser tab only). Screens that need state that isn't saved fall back.
  const [view, setViewRaw] = useState<View>(() => restoreTab(workspace))
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
  // The stage a Home pipeline chip asked Plans to scroll to.
  const [boardFocus, setBoardFocus] = useState<IdeaStatus | null>(null)
  const clearBoardFocus = useCallback(() => setBoardFocus(null), [])
  // The last search per client that produced results, so Find ideas can offer a way back to it.
  const [lastSearches, setLastSearches] = useState<Record<string, string>>({})
  // Where Review and Add client were opened from, so Back and Cancel return there.
  const [reviewFrom, setReviewFrom] = useState<View>('shortlist')
  const [addFrom, setAddFrom] = useState<View>('overview')
  // After signing out, the log-in form opens straight away instead of the landing page.
  const [signedOut, setSignedOut] = useState(false)
  // Which client and search the results screen currently shows, so "Back to results" knows if it must search again.
  const [shownSearch, setShownSearch] = useState<string | null>(null)
  const [ideas, setIdeas] = useSavedIdeas()

  // 'open' = the API has no accounts (demo sign-in above); otherwise the API's session decides.
  const [auth, setAuth] = useState<'checking' | 'open' | 'signed-out' | 'signed-in'>('checking')
  const [account, setAccount] = useState<Account | null>(null)
  const returnTo = useRef<ReturnTo | null>(null)
  const keepDraft = useRef<() => void>(() => {})
  const restoreView = useCallback(() => {
    let back = returnTo.current
    if (!back) {
      try {
        const raw = sessionStorage.getItem(RETURN_KEY)
        back = raw ? (JSON.parse(raw) as ReturnTo) : null
      } catch {
        back = null
      }
    }
    returnTo.current = null
    try {
      sessionStorage.removeItem(RETURN_KEY)
    } catch {
      // Nothing stored to clear.
    }
    if (!back) return false
    setWorkspaceRaw(back.workspace)
    setViewRaw(back.view)
    setPlanIdeaId(back.planIdeaId)
    return true
  }, [setWorkspaceRaw])
  useEffect(() => {
    me().then((a) => {
      setAuth(a.kind)
      setAccount(a.kind === 'signed-in' ? a.account : null)
      if (a.kind === 'signed-in') restoreView()
    })
  }, [restoreView])
  // Any API call answered 401 means the session ended: remember the screen and go to the sign-in page.
  const here = useRef({ view, workspace, planIdeaId })
  useEffect(() => {
    here.current = { view, workspace, planIdeaId }
  }, [view, workspace, planIdeaId])
  const authNow = useRef(auth)
  useEffect(() => {
    authNow.current = auth
  }, [auth])
  useEffect(() => {
    onUnauthorized(() => {
      // Only a signed-in session can end; a 401 on the sign-in page (e.g. the landing page's example search) is normal.
      if (authNow.current !== 'signed-in') return
      returnTo.current = here.current
      keepDraft.current()
      try {
        sessionStorage.setItem(RETURN_KEY, JSON.stringify(here.current))
      } catch {
        // Without storage the screen is still kept while this tab stays open.
      }
      setAuth((a) => (a === 'signed-in' ? 'signed-out' : a))
    })
  }, [])

  // Live mode: real TikTok, Instagram, YouTube, Reddit or X search through the local API (npm run api). Without it, the app uses sample data.
  const [live, setLive] = useState(false)
  const [liveStore, setLiveStore] = useStored<{ videos: Video[]; formats: Format[] }>('trend-finder.live-store.v1', {
    videos: [],
    formats: [],
  })
  const [liveResults, setLiveResults] = useState<Video[]>([])
  const [liveQuery, setLiveQuery] = useState('')
  // The written answer to the latest live search; null while it is being written or if that failed.
  const [liveAnswer, setLiveAnswer] = useState<Answer | null>(null)
  const [searching, setSearching] = useState<{ q: string; platforms: Platform[]; step?: string } | null>(null)
  const searchSeq = useRef(0)
  // A search whose account medians (each account's usual views) are still being fetched.
  const [scoring, setScoring] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  // Platforms that failed or returned nothing in the last search, shown above the results.
  const [searchEmpty, setSearchEmpty] = useState<Platform[]>([])
  const [searchFailed, setSearchFailed] = useState<{ platform: Platform; message: string }[]>([])
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

  // The API keeps clients, saved ideas and the videos behind them. Its copy wins on load; after that every
  // change is saved back. Only the first load can move this browser's older ideas up (see migrateLocal).
  const access = auth === 'open' || auth === 'signed-in'
  const [synced, setSynced] = useState(false)
  const [syncProblem, setSyncProblem] = useState<{ key: Key; vars?: Vars } | null>(null)
  // Bumped by Retry and after signing back in, so every save effect looks again for changes the API doesn't hold.
  const [retryTick, setRetryTick] = useState(0)
  const saveFailed = useCallback((what: 'clients' | 'ideas' | 'videos', e: unknown) => {
    // A 401 sends the user to the sign-in page; the save is tried again after that.
    if (e instanceof SaveError && e.status === 401) return
    setSyncProblem({ key: `shell.sync.save.${what}` })
  }, [])
  const saved = useCallback(() => setSyncProblem(null), [])
  // The ideas list is saved one request at a time, each with the revision the last one returned.
  const ideasRev = useRef<string | null>(null)
  const ideasQueue = useRef<Promise<unknown>>(Promise.resolve())
  const ideasGen = useRef(0)
  // What the API already holds, so the copy just loaded from it isn't written straight back.
  const onServer = useRef<{ clients: Client[] | null; ideas: SavedIdea[] | null; library: string | null }>({
    clients: null,
    ideas: null,
    library: null,
  })
  const clientsNow = useRef(clients)
  useEffect(() => {
    clientsNow.current = clients
  }, [clients])
  const ideasNow = useRef(ideas)
  useEffect(() => {
    ideasNow.current = ideas
  }, [ideas])
  // The list the API last acknowledged. onServer.ideas is set before a save is sent, so it can't tell what a
  // 401 on that save leaves unsaved.
  const confirmedIdeas = useRef<SavedIdea[] | null>(null)
  useEffect(() => {
    keepDraft.current = () => keepUnsavedDraft(confirmedIdeas.current, ideasNow.current, DRAFT_KEY, sessionStorage)
  }, [])
  useEffect(() => {
    if (!live || !access || synced) return
    Promise.all([loadList<Client>('clients'), loadIdeas(), loadLibrary().catch(() => null), checkDemo()])
      .then(async ([savedClients, loadedIdeas, library, demo]) => {
        if (library) {
          // Add the saved videos this browser hasn't seen; its own copies stay as they are.
          setLiveStore((prev) => {
            const add = <T extends { id: string }>(mine: T[], theirs: T[]) => {
              const ids = new Set(mine.map((x) => x.id))
              return [...mine, ...theirs.filter((x) => !ids.has(x.id))]
            }
            return { videos: add(prev.videos, library.videos), formats: add(prev.formats, library.formats) }
          })
          onServer.current.library = libraryKey(library)
        }
        if (savedClients?.length) {
          setClients(savedClients)
          onServer.current.clients = savedClients
        } else if (!demo) {
          // Nothing saved yet: keep this browser's own clients, but never the built-in samples (they would be
          // saved to the API as if they were real). The effect below saves what is left.
          setClients((prev) => withoutSamples(prev, sampleClients))
          if (withoutSamples(clientsNow.current, sampleClients).length === 0) {
            setWorkspaceRaw('all')
            setViewRaw('overview')
          }
        }
        const sampleIds = new Set(sampleIdeas.map((i) => i.id))
        const local = ideasNow.current.filter((i) => !sampleIds.has(i.id))
        const pick = pickInitialIdeas(loadedIdeas.items, local, wasMigrated())
        let rev = loadedIdeas.rev
        let held = loadedIdeas.items ?? []
        if (pick.upload) {
          const res = await saveIdeas(pick.ideas, rev)
          rev = res.rev
          held = res.items
        }
        let draft: SavedIdea[] | null = null
        try {
          const raw = sessionStorage.getItem(DRAFT_KEY)
          draft = raw ? (JSON.parse(raw) as SavedIdea[]) : null
          sessionStorage.removeItem(DRAFT_KEY)
        } catch {
          draft = null
        }
        const shown = draft?.length ? applyDraft(held, draft) : held
        // When the shown list is the held one, keep the very same object so nothing is saved back.
        onServer.current.ideas = held
        confirmedIdeas.current = held
        setIdeas(shown)
        ideasRev.current = rev
        markMigrated()
        setSynced(true)
      })
      .catch((e) => {
        if (!(e instanceof SaveError && e.status === 401))
          setSyncProblem({ key: 'shell.sync.load' })
      })
  }, [live, access, synced, setClients, setIdeas, setLiveStore, setWorkspaceRaw])
  useEffect(() => {
    if (!synced || clients === onServer.current.clients) return
    const prev = onServer.current.clients
    onServer.current.clients = clients
    saveList('clients', clients)
      .then(saved)
      .catch((e) => {
        if (onServer.current.clients === clients) onServer.current.clients = prev // so Retry sends it again
        saveFailed('clients', e)
      })
  }, [synced, clients, retryTick, saved, saveFailed])
  useEffect(() => {
    if (!synced || ideas === onServer.current.ideas) return
    const prev = onServer.current.ideas
    onServer.current.ideas = ideas
    const gen = ideasGen.current
    ideasQueue.current = ideasQueue.current
      .then(async () => {
        if (gen !== ideasGen.current) return // a newer list arrived from the API since this edit
        let attempt = ideas
        let base = prev ?? []
        for (let tries = 0; ; tries++) {
          try {
            const res = await saveIdeas(attempt, ideasRev.current)
            ideasRev.current = res.rev
            confirmedIdeas.current = res.items
            // The API may have kept a newer answer from the approver than the one sent.
            if (!sameIdeaList(res.items, attempt)) {
              attempt = res.items
              onServer.current.ideas = res.items
            }
            break
          } catch (e) {
            if (!(e instanceof IdeasConflict) || tries >= 3) throw e
            // Another tab saved first: take its list, put this edit on top, and save again.
            ideasGen.current += 1
            ideasRev.current = e.rev
            confirmedIdeas.current = e.items
            const merged = rebaseIdeas(base, attempt, e.items)
            base = e.items
            attempt = merged
            onServer.current.ideas = merged
            setSyncProblem({ key: 'shell.sync.conflict' })
          }
        }
        if (attempt !== ideas) {
          // Show the merged list, keeping anything edited since; the effect saves that remainder.
          const final = attempt
          setIdeas((cur) => (cur === ideas ? final : rebaseIdeas(ideas, cur, final)))
        } else saved()
      })
      .catch((e) => {
        if (onServer.current.ideas === ideas) onServer.current.ideas = prev // so Retry sends it again
        saveFailed('ideas', e)
      })
  }, [synced, ideas, retryTick, setIdeas, saved, saveFailed])
  // The approver answers on their own page, so coming back to this tab picks up their decisions. Only when
  // everything here is already saved: an unsaved edit is never replaced.
  useEffect(() => {
    if (!synced) return
    const refresh = () => {
      if (document.visibilityState !== 'visible' || ideas !== onServer.current.ideas) return
      loadIdeas()
        .then((fresh) => {
          if (!fresh.items || fresh.rev === ideasRev.current || ideasNow.current !== onServer.current.ideas) return
          ideasGen.current += 1
          ideasRev.current = fresh.rev
          onServer.current.ideas = fresh.items
          confirmedIdeas.current = fresh.items
          setIdeas(fresh.items)
        })
        .catch(() => {
          // The next visit tries again.
        })
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [synced, ideas, setIdeas])
  // The videos and breakdowns behind saved ideas, kept on the API like the ideas themselves.
  const library = useMemo(() => {
    const ids = new Set(ideas.map((i) => i.videoId))
    const savedVideos = liveStore.videos.filter((v) => ids.has(v.id))
    const formatIds = new Set(savedVideos.map((v) => v.formatId))
    return { videos: savedVideos, formats: liveStore.formats.filter((f) => formatIds.has(f.id)) }
  }, [ideas, liveStore])
  useEffect(() => {
    if (!synced) return
    const key = libraryKey(library)
    if (key === onServer.current.library) return
    const prev = onServer.current.library
    onServer.current.library = key
    saveLibrary(library)
      .then(saved)
      .catch((e) => {
        if (onServer.current.library === key) onServer.current.library = prev
        saveFailed('videos', e)
      })
  }, [synced, library, retryTick, saved, saveFailed])

  // Each screen starts at the top, like a new page. The tab is remembered for a refresh.
  useEffect(() => {
    window.scrollTo(0, 0)
    try {
      sessionStorage.setItem(VIEW_KEY, view)
    } catch {
      // Storage blocked: a refresh just opens the default tab.
    }
  }, [view])

  // Inside a client, everything (saving, fit checks, plans) is for that client.
  const client = clients.find((c) => c.id === workspace) ?? clients[0] ?? NO_CLIENT

  const lastSearch = workspace === 'all' ? null : (lastSearches[workspace] ?? null)

  // Opens a client's workspace. Picking a client starts on Find ideas; Home is one click away.
  const enterClient = (id: string, to: View = 'search') => {
    setWorkspaceRaw(id)
    setLastClient(id)
    setOpenVideoId(null)
    // The search box shows this client's own last search, not the previous client's.
    setQuery((q) => ({ ...q, keyword: lastSearches[id] ?? '' }))
    setView(to)
  }

  const setWorkspace = (w: Workspace) => {
    if (w !== 'all') return enterClient(w)
    setWorkspaceRaw('all')
    setOpenVideoId(null)
    setView('overview')
  }

  // A remembered client that no longer exists: go to All clients instead of showing a different client.
  const clientMissing = workspace !== 'all' && !clients.some((c) => c.id === workspace)
  useEffect(() => {
    if (!clientMissing) return
    setWorkspaceRaw('all')
    setViewRaw('overview')
  }, [clientMissing, setWorkspaceRaw])

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

  // A pasted link: read the real video, then search for its first keyword.
  const runLinkSearch = async (text: string) => {
    const url = text.match(/https?:\/\/\S+/)?.[0] ?? text
    const source = interpretMedia(url, null, formats)?.source ?? null
    const seq = ++searchSeq.current
    setSearchError(null)
    setSearching({ q: url, platforms: [], step: t('shell.search.readingVideo') })
    let like
    try {
      like = await likeVideo(url, (step) => {
        if (seq === searchSeq.current) setSearching((s) => (s ? { ...s, step: step || s.step } : s))
      })
    } catch (e) {
      if (seq !== searchSeq.current) return
      setSearching(null)
      setSearchError(e instanceof Error ? e.message : t('shell.search.linkFailed'))
      return
    }
    if (seq !== searchSeq.current) return
    const format = applyBreakdown(
      { id: `like-${url}`, name: like.formatName, short: like.formatName, tags: [], audiences: [], summary: '', why: like.breakdown.why,
        shotList: [], props: [], needs: [], effort: 'medium', editorNotes: '' },
      like.breakdown,
    )
    setLiveStore((prev) => ({ ...prev, formats: [format, ...prev.formats.filter((f) => f.id !== format.id)] }))
    setSearching(null)
    await runLiveSearch(like.keywords[0], source ? { source, formatId: format.id } : undefined)
  }

  // An uploaded screenshot: the AI says what it shows, then we search for its first keyword.
  const runImageSearch = async (file: File) => {
    const seq = ++searchSeq.current
    const previewUrl = URL.createObjectURL(file)
    setSearchError(null)
    setSearching({ q: file.name, platforms: [], step: t('shell.search.readingImage') })
    let like
    try {
      like = await likeImage(file)
    } catch (e) {
      if (seq !== searchSeq.current) return
      setSearching(null)
      setSearchError(e instanceof Error ? e.message : t('shell.search.imageFailed'))
      return
    }
    if (seq !== searchSeq.current) return
    const source = interpretMedia('', { name: file.name, url: previewUrl }, formats)?.source ?? null
    const format: Format = {
      id: `like-image-${file.name}`, name: like.formatName, short: like.formatName, tags: [], audiences: [],
      summary: like.description,
      why: { hook: '', first3s: '', length: '', format: like.formatName, sound: '' },
      shotList: [], props: [], needs: [], effort: 'medium', editorNotes: '',
    }
    setLiveStore((prev) => ({ ...prev, formats: [format, ...prev.formats.filter((f) => f.id !== format.id)] }))
    setSearching(null)
    await runLiveSearch(like.keywords[0], source ? { source, formatId: format.id } : undefined)
  }

  const runLiveSearch = async (text: string, like?: { source: MediaSource; formatId: string }) => {
    if (!like && /https?:\/\//.test(text)) {
      void runLinkSearch(text)
      return
    }
    const parsed = parseQuery(text, formats)
    // Send the platform the meaningful words; time, platform and length words become filters instead.
    const q = ([...parsed.keywords, ...parsed.topics.map((t) => t.word)].join(' ') || text).trim()
    // Platforms named in the text ("on instagram") win over the toggles.
    const platforms = parsed.platforms?.length ? parsed.platforms : query.platforms
    if (!q) return
    const seq = ++searchSeq.current
    setSearchError(null)
    setSearching({ q, platforms })
    try {
      const res = await searchAll(q, platforms)
      // A newer search has started since; its results win.
      if (seq !== searchSeq.current) return
      // Every platform failed: nothing to show, so it is an error.
      if (res.failed.length === platforms.length) {
        throw new Error(groupFailures(res.failed).map((g) => `${platformList(g.platforms)}: ${g.message}`).join(' '))
      }
      setSearchFailed(res.failed)
      setSearchEmpty(res.empty)
      setLiveStore((prev) => {
        const keep = (list: { id: string }[], add: { id: string }[]) => {
          const ids = new Set(add.map((x) => x.id))
          return [...add, ...list.filter((x) => !ids.has(x.id))].slice(0, 600)
        }
        // A repeat search brings placeholder formats; keep the AI breakdown of any video already broken down.
        const broken = new Map(prev.formats.filter((f) => f.shotList.length).map((f) => [f.id, f]))
        const formats = res.formats.map((f) => broken.get(f.id) ?? f)
        return { videos: keep(prev.videos, res.videos) as Video[], formats: keep(prev.formats, formats) as Format[] }
      })
      setLiveResults(res.videos)
      setLiveQuery(q)
      // One answer per search, from the videos it found. A failure just means no answer block.
      setLiveAnswer(null)
      if (res.videos.length) {
        askAnswer(text, res.videos)
          .then((a) => {
            if (seq === searchSeq.current) setLiveAnswer(a)
          })
          .catch(() => {})
      }
      setInterp({
        ...parsed, text, keywords: [q], topics: like ? [{ formatId: like.formatId, word: 'this video' }] : [],
        audience: null, isQuestion: false, source: like?.source ?? null,
      })
      setQuery((qq) => ({ ...qq, keyword: text, platforms, days: parsed.days ?? qq.days, maxLength: parsed.maxLength ?? qq.maxLength }))
      setPatternFilter(null)
      setFormatFilter(null)
      setLastSearches((prev) => ({ ...prev, [client.id]: text }))
      setShownSearch(`${client.id}|${text}`)
      if (res.pending.length) void fillScores(q, res.pending)
      setView('results')
    } catch (e) {
      if (seq !== searchSeq.current) return
      setSearchError(e instanceof Error ? e.message : t('shell.search.failed'))
    } finally {
      if (seq === searchSeq.current) setSearching(null)
    }
  }

  // Poll each platform's saved (free) search until its account medians are in, then update the scores in place.
  const fillScores = async (q: string, platforms: Platform[]) => {
    setScoring(q)
    const poll = async (platform: Platform) => {
      for (let i = 0; i < 36; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const res = await searchLive(q, false, platform, true)
        if (res.mediansPending) continue
        const freshById = new Map(res.videos.map((v) => [v.id, v]))
        const fill = (v: Video) => {
          const fresh = freshById.get(v.id)
          return fresh ? fillBaseline(v, fresh) : v
        }
        setLiveStore((prev) => ({ ...prev, videos: prev.videos.map(fill) }))
        setLiveResults((prev) => prev.map(fill))
        return
      }
    }
    // The results are still usable if a poll fails; they just keep the views ÷ followers score.
    await Promise.allSettled(platforms.map(poll))
    setScoring((s) => (s === q ? null : s))
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
    setLastSearches((prev) => ({ ...prev, [client.id]: text }))
    setShownSearch(`${client.id}|${text}`)
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
        // The automatic check only reads the cache; only the refresh button may start a paid search.
        const res = await searchLive(topic, fresh, 'tiktok', !fresh)
        setPulses((prev) => ({ ...prev, [c.id]: pulseFrom(topic, res.videos, findPatterns(res.videos, topic)) }))
      } catch (e) {
        // No saved result for an automatic check is normal (404): show no pulse, no banner.
        if (fresh) setPulseError(e instanceof Error ? e.message : t('shell.search.trendFailed'))
      } finally {
        setPulseLoading(null)
      }
    },
    [setPulses],
  )

  // Check once a day per client, when its Home or search page opens. Each attempt runs once per session, even if it fails.
  useEffect(() => {
    if (!live || workspace === 'all' || client === NO_CLIENT || (view !== 'search' && view !== 'home') || pulseLoading) return
    const topic = clientTopic(client)
    if (!topic) return // nothing to look up yet: the search would be refused
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

  // Patterns count TikTok accounts only, matching the Accounts list (COHORT_PLATFORMS).
  const patterns = useMemo(
    () => (live ? findPatterns(liveResults.filter((v) => COHORT_PLATFORMS.includes(v.platform)), liveQuery) : []),
    [live, liveResults, liveQuery],
  )
  const cohorts = useMemo(() => cohortsByVideo(liveResults, patterns), [liveResults, patterns])
  const patternCohorts = useMemo(() => cohortsByPattern(liveResults, patterns), [liveResults, patterns])

  const results = useMemo(() => {
    const pattern = patterns.find((x) => x.label === patternFilter)
    return keywordPool
      .filter((v) => live || query.platforms.includes(v.platform))
      // Videos with no posting date (YouTube search) can't be judged by age, so the day filter keeps them.
      .filter((v) => !hasDate(v) || v.daysAgo <= query.days)
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

  const answer = useMemo(() => (live ? liveAnswer : buildAnswer(interp, results, trends)), [interp, results, trends, live, liveAnswer])

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

  // Saving or planning a real video asks the API for its AI breakdown (about a minute the first time).
  // It replaces the placeholder shot list and "why it works".
  const analyzing = useRef(new Set<string>())
  const breakDown = (videoId: string) => {
    const v = videoById.get(videoId)
    const f = v && formatById.get(v.formatId)
    if (!v?.live || !v.url || !f || f.shotList.length || analyzing.current.has(videoId)) return
    analyzing.current.add(videoId)
    const patchFormat = (update: (x: Format) => Format) =>
      setLiveStore((prev) => ({ ...prev, formats: prev.formats.map((x) => (x.id === f.id ? update(x) : x)) }))
    const say = (text: string) => patchFormat((x) => ({ ...x, why: { ...x.why, first3s: text } }))
    analyzeVideo(v.url, (step) => say(t('shell.breakdown.progress', { step: step || t('shell.breakdown.waiting') })))
      .then((b) => {
        patchFormat((x) => applyBreakdown(x, b))
        // Ideas saved before the breakdown still carry the placeholder editor notes.
        setIdeas((prev) => prev.map((i) => (i.videoId === videoId && i.notes === f.editorNotes ? { ...i, notes: b.editorNotes } : i)))
      })
      .catch((e) => say(`${t('shell.breakdown.failed')} ${e instanceof Error ? e.message : ''}`.trim()))
      .finally(() => analyzing.current.delete(videoId))
  }

  const saveIdea = (videoId: string): SavedIdea => {
    breakDown(videoId)
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

  // A saved video can lack its breakdown (saved before one existed); fetch it when opened.
  const openVideoDrawer = (videoId: string) => {
    setOpenVideoId(videoId)
    if (savedForClient.has(videoId)) breakDown(videoId)
    fillNeeds(videoId)
  }

  // A real video that has a breakdown but no judged needs (an older one) gets them from the API, once per session.
  const needsAsked = useRef(new Set<string>())
  const fillNeeds = (videoId: string) => {
    const v = videoById.get(videoId)
    const f = v && formatById.get(v.formatId)
    if (!v?.live || !v.url || !f || !f.shotList.length || f.needsKnown || needsAsked.current.has(videoId)) return
    needsAsked.current.add(videoId)
    checkNeeds(v.url, [...new Set(formats.flatMap((x) => x.needs))])
      .then((needs) =>
        setLiveStore((prev) => ({ ...prev, formats: prev.formats.map((x) => (x.id === f.id ? { ...x, needs, needsKnown: true } : x)) })),
      )
      .catch(() => needsAsked.current.delete(videoId))
  }

  const openPlan = (ideaId: string) => {
    const idea = ideas.find((i) => i.id === ideaId)
    if (idea) breakDown(idea.videoId)
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
  // stream C: three decision kinds, with the manager's comment and per-shot comments
  const decide = (ideaId: string, d: Decision) => {
    const idea = ideas.find((i) => i.id === ideaId)
    const at = Date.now()
    setIdeas((prev) => prev.map((i) => (i.id === ideaId ? applyDecision(i, d, at) : i)))
    if (idea) recordEvent(idea.clientId, { ideaId, kind: d.kind, reason: d.comment, at })
  }

  const appContext: AppContextValue = {
    // A signed-in account's agency name wins over the per-browser setting; without accounts the setting is used.
    agency: account?.agency ? { ...agency, agencyName: account.agency } : agency,
    account,
    setAgency: (patch) => setAgencyRaw((a) => ({ ...a, ...patch })),
    role,
    setRole,
    addClient: (c) => setClients((prev) => [...prev, c]),
    lang,
    setLang,
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
    overview: t('shell.back.overview'),
    home: t('shell.back.home'),
    search: t('shell.back.search'),
    results: t('shell.back.results'),
    review: t('shell.back.review'),
    plan: t('shell.back.plan'),
    settings: t('shell.back.settings'),
    preferences: t('shell.back.preferences'),
    channel: t('shell.back.channel'),
    shortlist: t('shell.back.shortlist'),
    'add-client': t('shell.back.addClient'),
  }
  // Sidebar badge: what needs action (waiting for approval + sent back), not the whole shortlist.
  const counts = { plans: mine.filter((i) => i.status === 'waiting' || i.status === 'rejected').length }
  const openPlans = (stage?: IdeaStatus) => {
    setBoardFocus(stage ?? null)
    setView('shortlist')
  }

  const openReview = (from: View) => {
    setReviewFrom(from)
    setView('review')
  }
  // Review's Back: to where it was opened from. From All clients, that means leaving the client.
  const reviewBack = () => (reviewFrom === 'overview' ? setWorkspace('all') : setView(reviewFrom))
  const reviewBackLabel = reviewFrom === 'overview' ? t('shell.side.allClients') : reviewFrom === 'home' ? t('shell.side.home') : t('shell.side.plans')
  // The next client (in list order, after this one) with plans waiting, for clearing approvals across clients.
  const nextWaiting = (() => {
    const at = clients.findIndex((c) => c.id === client.id)
    const order = [...clients.slice(at + 1), ...clients.slice(0, Math.max(at, 0))]
    const next = order
      .map((c) => ({ c, n: shownIdeas.filter((i) => i.clientId === c.id && i.status === 'waiting').length }))
      .find((x) => x.n > 0)
    return next ? { id: next.c.id, name: next.c.name, waiting: next.n } : null
  })()

  const openAddClient = () => {
    setAddFrom(view)
    setView('add-client')
  }

  // Find ideas' "Back to results": rerun this client's last search if the results on screen are another one.
  const backToResults = () => {
    if (!lastSearch) return
    if (shownSearch === `${client.id}|${lastSearch}`) setView('results')
    else runSearch(lastSearch)
  }

  // Sidebar "Find ideas": come back to this client's last results if they're still on screen, not an empty search page.
  const navTo = (v: View) => {
    if (v === 'search' && lastSearch && shownSearch === `${client.id}|${lastSearch}`) return setView('results')
    setView(v)
  }

  // A plan view without its plan (e.g. after switching sample/live data) would be blank: show Plans instead.
  const planMissing = view === 'plan' && !(planIdea && planVideo && planFormat && planClient)
  useEffect(() => {
    if (planMissing) setViewRaw('shortlist')
  }, [planMissing])

  if (auth === 'checking') return null
  // Client accounts aren't live yet (see ClientPortal), so a saved client login goes back to the login screen.
  const gate = auth === 'signed-out' ? { kind: 'signed-out' as const } : { signedIn: auth === 'signed-in' || signedIn }
  if (nextView(gate, 'app') === 'login' || role === 'client') {
    // Landing and sign-in stay in English whatever the setting is.
    setActiveLang('en')
    document.documentElement.lang = 'en'
    return (
      <AppContext.Provider value={appContext}>
        {/* stream A: after login, staff land on the all-clients overview */}
        <LoginScreen
          real={auth === 'signed-out'}
          startAtLogin={auth === 'signed-out' && returnTo.current !== null}
          startOn={signedOut ? 'login' : 'landing'}
          onSignIn={() => {
            setSignedOut(false)
            if (auth === 'signed-out') {
              setAuth('signed-in')
              void me().then((m) => setAccount(m.kind === 'signed-in' ? m.account : null))
              setRetryTick((n) => n + 1)
              // Back from an ended session: return to where the user was, not the overview.
              if (restoreView()) return
            } else setSignedIn(true)
            // Returning: reopen the last client on Find ideas. First log-in, or that client is gone: All clients Home.
            if (lastClient && clients.some((c) => c.id === lastClient)) enterClient(lastClient)
            else setWorkspace('all')
          }}
        />
      </AppContext.Provider>
    )
  }
  setActiveLang(lang)
  document.documentElement.lang = htmlLang(lang)

  const signOut = () => {
    if (auth !== 'signed-in') return setSignedIn(false)
    try {
      sessionStorage.removeItem(RETURN_KEY)
    } catch {
      // Nothing stored to clear.
    }
    returnTo.current = null
    void logout().then(() => {
      setSynced(false)
      setAccount(null)
      setAuth('signed-out')
    })
  }


  const inClient = workspace !== 'all' && client !== NO_CLIENT

  return (
    <AppContext.Provider value={appContext}>
    {/* Keyed by language so every screen redraws in the new one (the switch happens on Settings, which holds no work in progress). */}
    <div className="shell" key={lang}>
      <Sidebar
        clients={clients}
        workspace={workspace}
        setWorkspace={setWorkspace}
        view={view}
        setView={navTo}
        counts={counts}
        onSignOut={() => {
          setSignedOut(true)
          signOut()
        }}
        onAddClient={openAddClient}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        live={live}
      />

      <div className="shell-main">
        <header className="mobile-bar">
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label={t('shell.openMenu')}>
            ☰
          </button>
          <strong>{inClient ? client.name : t('shell.side.allClients')}</strong>
        </header>

        {syncProblem && (
          <div className="sync-note" role="status">
            <span>{t(syncProblem.key, syncProblem.vars)}</span>
            <button type="button" className="link-btn" onClick={() => { setSyncProblem(null); setRetryTick((n) => n + 1) }}>
              {t('shell.sync.retry')}
            </button>
          </div>
        )}
        <main className="main">
          {view === 'add-client' && (
            <AddClientScreen
              takenIds={clients.map((c) => c.id)} // stream A: keeps new client ids unique
              onCreated={(id) => enterClient(id)}
              onCancel={() => setView(addFrom)}
            />
          )}

          {((!inClient && view !== 'add-client' && view !== 'channel' && view !== 'preferences') || view === 'overview') && (
            <OverviewScreen
              clients={clients}
              ideas={shownIdeas}
              videoById={videoById}
              formatById={formatById}
              onOpen={(id, v) => {
                // The client name opens Find ideas, the row button its Home, "N waiting" its Review.
                if (v === 'review') {
                  setReviewFrom('overview')
                  enterClient(id, 'review')
                } else enterClient(id, v)
              }}
              onAddClient={openAddClient}
            />
          )}

          {inClient && view === 'home' && (
            <ClientHome
              client={client}
              ideas={shownIdeas}
              allIdeas={ideas}
              videoById={videoById}
              formatById={formatById}
              live={live}
              pulse={pulses[client.id]}
              pulseLoading={pulseLoading === client.id}
              pulseError={pulseError}
              onRefreshPulse={() => void refreshPulse(client, true)}
              onFindIdeas={() => setView('search')}
              onSave={(videoId) => void saveIdea(videoId)}
              onUndoSave={toggleSave}
              onPlanShots={planFromVideo}
              onOpenPlan={openPlan}
              onOpenPlans={openPlans}
              // A signed-in manager approves right here, with the same handler as Review; team members don't.
              onApprove={role === 'manager' ? (id) => decide(id, { kind: 'approved' }) : undefined}
              onReview={() => openReview('home')}
              onEditBrief={() => setView('settings')}
            />
          )}

          {view === 'channel' && <ChannelScreen />}

          {view === 'preferences' && <PreferencesScreen />}

          {inClient && view === 'search' && (
            <SearchScreen
              query={query}
              setQuery={setQuery}
              onSearch={runSearch}
              onImage={live ? runImageSearch : undefined}
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
              planned={shownIdeas.filter((i) => i.clientId === client.id && i.status === 'approved').length}
              target={client.monthlyTarget}
              lastSearch={lastSearch}
              onBackToResults={backToResults}
            />
          )}

          {inClient && view === 'results' && (
            <ResultsScreen
              failed={live ? searchFailed : []}
              empty={live ? searchEmpty : []}
              scoring={live && scoring === liveQuery}
              query={query}
              setQuery={setQuery}
              interp={interp}
              answer={answer}
              formats={formats}
              allVideos={videos}
              onSearch={runSearch}
              onImage={live ? runImageSearch : undefined}
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
              cohorts={cohorts}
              patterns={
                live ? (
                  <PatternStrip patterns={patterns} cohorts={patternCohorts} active={patternFilter} onPick={setPatternFilter} />
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
                    real={live}
                    onPlan={planFromVideo}
                    savedIds={savedForClient}
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
              onOpen={openVideoDrawer}
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
              onDecide={decide}
              onOpenPlan={openPlan}
              onFindMore={() => setView('search')}
              onReview={() => openReview('shortlist')}
              focus={boardFocus}
              onFocusDone={clearBoardFocus}
            />
          )}

          {inClient && view === 'review' && (
            <ReviewScreen
              client={client}
              ideas={shownIdeas}
              formatById={formatById}
              videoById={videoById}
              onDecide={decide}
              readOnly={role !== 'manager'}
              onBack={reviewBack}
              backLabel={reviewBackLabel}
              onOpenPlans={() => setView('shortlist')}
              nextClient={nextWaiting}
              onNextClient={() => nextWaiting && enterClient(nextWaiting.id, 'review')}
            />
          )}

          {/* stream C: ideas and lookups so client memory can name each plan */}
          {inClient && view === 'settings' && (
            <SettingsScreen client={client} onChange={updateClient} ideas={ideas} videoById={videoById} formatById={formatById} />
          )}

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
              onDecide={(d) => decide(planIdea.id, d)}
            />
          )}
        </main>
      </div>

      {openVideo && openFormat && (
        <BreakdownPanel
          video={openVideo}
          format={openFormat}
          cohort={cohorts.get(openVideo.id)}
          formatAccounts={keywordPool.filter((v) => v.formatId === openFormat.id).length}
          client={client}
          status={shownIdeas.find((i) => i.clientId === client.id && i.videoId === openVideo.id)?.status} // stream B
          onClose={() => setOpenVideoId(null)}
          onSave={() => toggleSave(openVideo.id)}
          onPlan={() => planFromVideo(openVideo.id)}
        />
      )}

      {reading && <ReadingOverlay source={reading} onDone={finishReading} />}
      {searching && (
        <LiveLoading
          query={searching.q}
          title={
            searching.step
              ? `${searching.step}…`
              : t('shell.search.searching', { platforms: searching.platforms.map((p) => platformName[p]).join(', '), q: searching.q })
          }
        />
      )}
    </div>
    </AppContext.Provider>
  )
}

// Order doesn't matter when comparing what's saved, so compare by id.
function libraryKey(library: { videos: { id: string }[]; formats: { id: string }[] }) {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
  return JSON.stringify([[...library.videos].sort(byId), [...library.formats].sort(byId)])
}

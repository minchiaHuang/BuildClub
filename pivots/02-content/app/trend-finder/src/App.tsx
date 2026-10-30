import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IdeaStage, IdeaStatus, SavedIdea } from './types'
import { clients as sampleClients, formats, sampleIdeas, videos } from './data/sample'
import { formatTrend, groupFailures, hasDate, outlierScore, platformList, platformName, stageOrder, viewsPerDay, viewsPerFollower } from './lib/metrics'
import { AGENCY_NAME, defaultQuery, inTwoWeeks, useSavedIdeas, useStored } from './state'
import type { Query, Sort, Workspace } from './state'
import { SearchScreen } from './components/SearchScreen'
import { ResultsScreen } from './components/ResultsScreen'
import type { Chip } from './components/ResultsScreen'
import { interpretMedia, matchesKeyword, parseQuery } from './lib/parseQuery'
import type { Interpretation, MediaSource } from './lib/parseQuery'
import { LikeThisCard } from './components/LikeThisCard'
import { ReadingOverlay } from './components/ReadingOverlay'
import { buildAnswer } from './lib/answer'
import type { Answer } from './lib/answer'
import { BreakdownPanel } from './components/BreakdownPanel'
import { cohortsByVideo, fillBaseline } from './lib/evidence'
import { ClientScreen } from './components/ClientScreen'
import { PlanScreen } from './components/PlanScreen'
import { Sidebar } from './components/Sidebar'
import type { View } from './components/Sidebar'
import { OverviewScreen } from './components/OverviewScreen'
import { ApprovalsScreen } from './components/ApprovalsScreen'
import { ReviewScreen } from './components/ReviewScreen'
import { PlansScreen } from './components/PlansScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { NewClientForm } from './components/NewClientForm'
import { LoginScreen } from './components/LoginScreen'
import { logout, me, type Account } from './lib/auth'
import { ChannelScreen } from './components/ChannelScreen'
import type { Client, Format, Platform, Video } from './types'
import {
  analyzeVideo,
  checkNeeds,
  applyBreakdown,
  checkLive,
  findPatterns,
  IdeasConflict,
  SaveError,
  loadIdeas,
  loadLibrary,
  loadList,
  loadPulses,
  saveIdeas,
  saveLibrary,
  saveList,
  savePulses,
  askAnswer,
  likeImage,
  likeVideo,
  searchAll,
  searchLive,
} from './lib/live'
import { buildChipGroups, clientTopic, pulseFrom } from './lib/clientChips'
import type { Pulse } from './lib/clientChips'
import { PatternStrip } from './components/PatternStrip'
import { withScreenTransition } from './lib/motion'

// Stands in for the current client while a live API has none yet.
const noClient: Client = { id: '', name: '', niche: '', audience: '', monthlyTarget: 8, examples: [], topics: [], cannot: [] }

const sorters: Record<Sort, (a: (typeof videos)[number], b: (typeof videos)[number]) => number> = {
  outlier: (a, b) => outlierScore(b) - outlierScore(a),
  ratio: (a, b) => viewsPerFollower(b) - viewsPerFollower(a),
  newest: (a, b) => a.daysAgo - b.daysAgo,
  fastest: (a, b) => viewsPerDay(b) - viewsPerDay(a),
}

// Reload keeps the screen (and the plan being edited) for this tab. Results aren't kept, so they reopen as Search.
const NAV_KEY = 'trend-finder.nav.v1'
const restorable: View[] = ['overview', 'search', 'saved', 'approvals', 'review', 'plans', 'plan', 'settings', 'channel']
interface Nav {
  view: View
  planIdeaId: string | null
  planFrom: View
}
function readNav(): Nav | null {
  try {
    const n = JSON.parse(sessionStorage.getItem(NAV_KEY) ?? 'null') as Nav | null
    return n && restorable.includes(n.view) ? n : null
  } catch {
    return null
  }
}

export default function App() {
  // Demo entry for when the API has no accounts (or isn't there); real sign-in uses the API's session.
  const [signedIn, setSignedIn] = useStored('trend-finder.signed-in', false)
  const [auth, setAuth] = useState<'checking' | 'open' | 'signed-out' | 'signed-in'>('checking')
  const [account, setAccount] = useState<Account | null>(null)
  useEffect(() => {
    me().then((a) => {
      setAuth(a.kind === 'signed-in' ? 'signed-in' : a.kind)
      if (a.kind === 'signed-in') setAccount(a.account)
    })
  }, [])
  // Nothing but the sign-in page may ask the API for anything until the app is let in.
  const access = auth === 'open' || auth === 'signed-in'
  const [clients, setClients] = useStored<Client[]>('trend-finder.clients.v3', sampleClients)
  const [workspace, setWorkspaceRaw] = useStored<Workspace>('trend-finder.workspace.v2', sampleClients[0].id)
  const [savedNav] = useState(readNav)
  const [view, setViewRaw] = useState<View>(() => {
    const v = savedNav?.view
    if (!v) return workspace === 'all' ? 'overview' : 'search'
    return workspace === 'all' && v !== 'overview' && v !== 'channel' ? 'overview' : v
  })
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
  const [planIdeaId, setPlanIdeaId] = useState<string | null>(savedNav?.planIdeaId ?? null)
  // The screen a plan was opened from, so Back returns there.
  const [planFrom, setPlanFrom] = useState<View>(savedNav?.planFrom ?? 'results')
  useEffect(() => {
    try {
      sessionStorage.setItem(NAV_KEY, JSON.stringify({ view, planIdeaId, planFrom }))
    } catch {
      // Storage blocked: a reload just starts on the default screen.
    }
  }, [view, planIdeaId, planFrom])
  // The last search that produced results, so the search page can offer a way back to it.
  const [lastSearch, setLastSearch] = useState<string | null>(null)
  const [ideas, setIdeas] = useSavedIdeas()

  // Live mode: real TikTok, Instagram, YouTube or X search through the local API (npm run api). Live mode keeps clients, saved ideas and videos on the API; without the API the app falls back to sample data stored in this browser.
  const [live, setLive] = useState(false)
  const [liveChecked, setLiveChecked] = useState(false)
  const [liveStore, setLiveStore] = useStored<{ videos: Video[]; formats: Format[] }>('trend-finder.live-store.v1', {
    videos: [],
    formats: [],
  })
  const [liveResults, setLiveResults] = useState<Video[]>([])
  const [liveQuery, setLiveQuery] = useState('')
  // The written answer to the latest live search; null while it is being written or if that failed.
  const [liveAnswer, setLiveAnswer] = useState<Answer | null>(null)
  // Live searches run in the background, so the rest of the app stays usable meanwhile.
  const [searching, setSearching] = useState<{ q: string; platforms: Platform[]; step?: string } | null>(null)
  // A search that finished after the user moved to another screen, waiting to be opened.
  const [searchDone, setSearchDone] = useState<{ text: string; clientId: string; error?: string } | null>(null)
  const searchSeq = useRef(0)
  // A search whose TikTok, YouTube or X scores (each account's usual views) are still being fetched.
  const [scoring, setScoring] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  // Platforms that returned nothing in the last search (daily cap, upstream error), shown above the results.
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
      setLiveChecked(true)
      // TikTok's top results are often older, so live search starts with no date limit.
      if (ok) setQuery((q) => ({ ...q, days: 3650 }))
    })
  }, [])

  // In live mode the API keeps clients and saved ideas too. Its copy wins on load; after that,
  // every change is saved back. If the API can't load them, this browser's copy is used.
  const [synced, setSynced] = useState(false)
  // Something the user must know about syncing: the data didn't load, a save failed, or another tab changed the ideas.
  const [syncProblem, setSyncProblem] = useState<{ kind: 'load' | 'auth' | 'failed' | 'conflict'; text: string } | null>(null)
  // Bumped by Retry so every save effect looks again for changes the API doesn't hold.
  const [retryTick, setRetryTick] = useState(0)
  const saveFailed = useCallback((what: string, e: unknown) => {
    setSyncProblem(
      e instanceof SaveError && e.status === 401
        ? { kind: 'auth', text: `Your session ended, so ${what} aren't saved yet. Sign in again in a new tab, then press Retry.` }
        : { kind: 'failed', text: `Couldn't save ${what}. Your changes are still here; check your connection, then press Retry.` },
    )
  }, [])
  const saved = useCallback(() => setSyncProblem((p) => (p?.kind === 'failed' || p?.kind === 'auth' ? null : p)), [])
  // The ideas list is saved one request at a time, each with the revision the last one returned.
  const ideasRev = useRef<string | null>(null)
  const ideasQueue = useRef<Promise<unknown>>(Promise.resolve())
  const ideasGen = useRef(0)
  // Counts saves started and finished, so a read that overlapped one can be thrown away.
  const writes = useRef(0)
  // What the API already holds, so the copy just loaded from it isn't written straight back.
  const onServer = useRef<{
    clients: Client[] | null
    ideas: SavedIdea[] | null
    library: string | null
    pulses: Record<string, Pulse> | null
  }>({
    clients: null,
    ideas: null,
    library: null,
    pulses: null,
  })
  useEffect(() => {
    if (!live || !access) return
    Promise.all([
      loadList<Client>('clients'),
      loadIdeas(),
      loadLibrary().catch(() => null),
      loadPulses<Pulse>().catch(() => null),
    ])
      .then(([savedClients, loadedIdeas, library, savedPulses]) => {
        const savedIdeas = loadedIdeas.items
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
        } else {
          // Nothing saved on the API yet: keep only clients made in this browser, not the sample ones.
          const sampleIds = new Set(sampleClients.map((c) => c.id))
          setClients((prev) => prev.filter((c) => !sampleIds.has(c.id)))
        }
        if (savedIdeas) {
          setIdeas(savedIdeas)
          onServer.current.ideas = savedIdeas
        } else {
          // Nothing saved on the API yet: start empty, not from the sample ideas this browser began with.
          const sampleIds = new Set(sampleIdeas.map((i) => i.id))
          setIdeas((prev) => prev.filter((i) => !sampleIds.has(i.id)))
        }
        // The API's copy wins; when it has none, this browser's copy is saved up by the effect below.
        if (savedPulses) {
          setPulses(savedPulses)
          onServer.current.pulses = savedPulses
        }
        ideasRev.current = loadedIdeas.rev
        setSynced(true)
      })
      .catch(() => setSyncProblem({ kind: 'load', text: "Couldn't load your data. Reload the page to try again; nothing will be saved until it loads." }))
  }, [live, access, setClients, setIdeas, setLiveStore, setPulses])
  useEffect(() => {
    if (!synced || clients === onServer.current.clients) return
    const prev = onServer.current.clients
    onServer.current.clients = clients
    saveList('clients', clients)
      .then(saved)
      .catch((e) => {
        if (onServer.current.clients === clients) onServer.current.clients = prev // so Retry sends it again
        saveFailed('your clients', e)
      })
  }, [synced, clients, retryTick, saved, saveFailed])
  useEffect(() => {
    if (!synced || ideas === onServer.current.ideas) return
    const prev = onServer.current.ideas
    onServer.current.ideas = ideas
    writes.current += 1
    const gen = ideasGen.current
    ideasQueue.current = ideasQueue.current
      .then(async () => {
        if (gen !== ideasGen.current) return // a newer list arrived from the API since this edit
        ideasRev.current = await saveIdeas(ideas, ideasRev.current)
        saved()
      })
      .catch((e) => {
        if (e instanceof IdeasConflict) {
          // Another tab saved first: take its list, drop edits queued behind this one.
          ideasGen.current += 1
          ideasRev.current = e.rev
          onServer.current.ideas = e.items
          setIdeas(e.items)
          setSyncProblem({ kind: 'conflict', text: 'This list was changed in another tab, so we loaded the latest. Check your last edit.' })
          return
        }
        if (onServer.current.ideas === ideas) onServer.current.ideas = prev // so Retry sends it again
        saveFailed('your ideas', e)
      })
      .finally(() => {
        writes.current += 1
      })
  }, [synced, ideas, retryTick, setIdeas, saved, saveFailed])

  // Annie answers on her own link, so the API's ideas are re-read every 20 s and when this window gets
  // focus, but only on the screens that show her answers. Skipped while this tab has changes of its own
  // that the API hasn't taken yet, or when a save finished while the read was in flight.
  const ideasNow = useRef(ideas)
  useEffect(() => {
    ideasNow.current = ideas
  }, [ideas])
  const watchingAnswers = view === 'approvals' || view === 'overview' || view === 'plans' || workspace === 'all'
  useEffect(() => {
    if (!live || !synced || !watchingAnswers) return
    let stopped = false
    const refresh = () => {
      const before = writes.current
      if (before % 2) return // a save is on its way
      loadIdeas()
        .then(({ items: fresh, rev }) => {
          if (stopped || !fresh || writes.current !== before) return
          if (ideasNow.current !== onServer.current.ideas) return
          ideasRev.current = rev
          if (JSON.stringify(fresh) === JSON.stringify(ideasNow.current)) return
          onServer.current.ideas = fresh
          setIdeas(fresh)
        })
        .catch(() => {})
    }
    const timer = window.setInterval(refresh, 20_000)
    window.addEventListener('focus', refresh)
    return () => {
      stopped = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [live, synced, watchingAnswers, setIdeas])

  useEffect(() => {
    if (!synced || pulses === onServer.current.pulses) return
    const prev = onServer.current.pulses
    onServer.current.pulses = pulses
    savePulses(pulses)
      .then(saved)
      .catch((e) => {
        if (onServer.current.pulses === pulses) onServer.current.pulses = prev
        saveFailed('your trending checks', e)
      })
  }, [synced, pulses, retryTick, saved, saveFailed])

  // The videos and breakdowns behind saved ideas, kept on the API like the ideas themselves.
  const library = useMemo(() => {
    const ids = new Set(ideas.map((i) => i.videoId))
    const saved = liveStore.videos.filter((v) => ids.has(v.id))
    const formatIds = new Set(saved.map((v) => v.formatId))
    return { videos: saved, formats: liveStore.formats.filter((f) => formatIds.has(f.id)) }
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
        saveFailed('your saved videos', e)
      })
  }, [synced, library, retryTick, saved, saveFailed])

  // Where the user is now, read when a background search finishes.
  const here = useRef({ view, workspace })
  useEffect(() => {
    here.current = { view, workspace }
  }, [view, workspace])

  // Each screen starts at the top, like a new page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  // Inside a client, everything (saving, fit checks, plans) is for that client.
  // A live API with no clients yet has an empty list until the first one is added (see below).
  const client = clients.find((c) => c.id === workspace) ?? clients[0] ?? noClient
  // A remembered client that no longer exists (the API's list replaced this browser's): settle on the one shown.
  useEffect(() => {
    if (clients.length && workspace !== 'all' && workspace !== client.id) setWorkspaceRaw(client.id)
  }, [clients.length, workspace, client.id, setWorkspaceRaw])

  const setWorkspace = (w: Workspace) => {
    setWorkspaceRaw(w)
    setOpenVideoId(null)
    // Picking a client from the switcher always starts on Search.
    setView(w === 'all' ? 'overview' : 'search')
  }

  const [addingClient, setAddingClient] = useState(false)
  const onAddClient = (c: Client) => {
    setClients([...clients, c])
    setAddingClient(false)
    setWorkspaceRaw(c.id)
    setOpenVideoId(null)
    setView('settings')
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

  // A pasted link: read the real video, then search for its first keyword.
  const runLinkSearch = async (text: string) => {
    const url = text.match(/https?:\/\/\S+/)?.[0] ?? text
    const source = interpretMedia(url, null, formats)?.source ?? null
    const seq = ++searchSeq.current
    const clientId = workspace
    setSearchError(null)
    setSearchDone(null)
    setSearching({ q: url, platforms: [], step: 'Reading the video' })
    let like
    try {
      like = await likeVideo(url, (step) => {
        if (seq === searchSeq.current) setSearching((s) => (s ? { ...s, step: step || s.step } : s))
      })
    } catch (e) {
      if (seq !== searchSeq.current) return
      const message = e instanceof Error ? e.message : 'Could not read that link.'
      setSearching(null)
      setSearchError(message)
      if (here.current.view !== 'search' || here.current.workspace !== clientId) setSearchDone({ text, clientId, error: message })
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
    const clientId = workspace
    const previewUrl = URL.createObjectURL(file)
    setSearchError(null)
    setSearchDone(null)
    setSearching({ q: file.name, platforms: [], step: 'Looking at your screenshot' })
    let like
    try {
      like = await likeImage(file)
    } catch (e) {
      if (seq !== searchSeq.current) return
      const message = e instanceof Error ? e.message : 'Could not read that image.'
      setSearching(null)
      setSearchError(message)
      if (here.current.view !== 'search' || here.current.workspace !== clientId) setSearchDone({ text: file.name, clientId, error: message })
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
    if (!q || (q === searching?.q && platforms.join() === searching.platforms.join())) return
    const seq = ++searchSeq.current
    const clientId = workspace
    setSearchError(null)
    setSearchDone(null)
    setSearching({ q, platforms })
    try {
      const res = await searchAll(q, platforms)
      // A newer search has started since; its results win.
      if (seq !== searchSeq.current) return
      // Every platform failed: nothing to show, so it is an error like before.
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
      // One answer per search, from the videos as they arrive. A failure just means no answer block.
      setLiveAnswer(null)
      if (res.videos.length) {
        askAnswer(text, res.videos)
          .then((a) => { if (seq === searchSeq.current) setLiveAnswer(a) })
          .catch(() => {})
      }
      setInterp({
        ...parsed, text, keywords: [q], topics: like ? [{ formatId: like.formatId, word: 'this video' }] : [],
        audience: null, isQuestion: false, source: like?.source ?? null,
      })
      setQuery((qq) => ({ ...qq, keyword: text, platforms, days: parsed.days ?? qq.days, maxLength: parsed.maxLength ?? qq.maxLength }))
      setPatternFilter(null)
      setFormatFilter(null)
      setLastSearch(text)
      if (res.pending.length) void fillScores(q, res.pending)
      // Only jump to the results if the user is still waiting on this client's search page.
      if (here.current.view === 'search' && here.current.workspace === clientId) setView('results')
      else setSearchDone({ text, clientId })
    } catch (e) {
      if (seq !== searchSeq.current) return
      const message = e instanceof Error ? e.message : 'Search failed.'
      setSearchError(message)
      if (here.current.view !== 'search' || here.current.workspace !== clientId) setSearchDone({ text, clientId, error: message })
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
    setLastSearch(text)
    setView('results')
  }

  // Start the next video: back to the results she was picking from; with none (e.g. after a reload), a clean search page.
  const planAnother = () => {
    if (lastSearch) {
      setView('results')
      return
    }
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
        if (fresh) setPulseError(e instanceof Error ? e.message : 'Trend check failed.')
      } finally {
        setPulseLoading(null)
      }
    },
    [setPulses],
  )

  // Check once a day per client, when its search page opens. Each attempt runs once per session, even if it fails.
  useEffect(() => {
    if (!live || !access || !clients.length || workspace === 'all' || view !== 'search' || pulseLoading) return
    const topic = clientTopic(client)
    if (!topic) return // nothing to look up yet: the search would be refused
    const p = pulses[client.id]
    const stale = !p || p.topic !== topic || Date.now() - p.fetchedAt > 24 * 3_600_000
    const key = `${client.id}|${topic}`
    if (stale && !pulseTried.current.has(key)) {
      pulseTried.current.add(key)
      void refreshPulse(client, false)
    }
  }, [live, access, clients.length, workspace, view, client, pulses, pulseLoading, refreshPulse])

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
  const cohorts = useMemo(() => cohortsByVideo(liveResults, patterns), [liveResults, patterns])

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

  // Saving or planning a real video asks the API for its AI breakdown (about a minute and
  // US$0.08 the first time). It replaces the placeholder shot list and "why it works".
  const analyzing = useRef(new Set<string>())
  const breakDown = (videoId: string) => {
    const v = videoById.get(videoId)
    const f = v && formatById.get(v.formatId)
    if (!v?.live || !v.url || !f || f.shotList.length || analyzing.current.has(videoId)) return
    analyzing.current.add(videoId)
    const patchFormat = (update: (x: Format) => Format) =>
      setLiveStore((prev) => ({ ...prev, formats: prev.formats.map((x) => (x.id === f.id ? update(x) : x)) }))
    const say = (text: string) => patchFormat((x) => ({ ...x, why: { ...x.why, first3s: text } }))
    analyzeVideo(v.url, (step) => say(`Breaking down the video: ${step || 'waiting'}…`))
      .then((b) => {
        patchFormat((x) => applyBreakdown(x, b))
        // Ideas saved before the breakdown still carry the placeholder editor notes.
        setIdeas((prev) => prev.map((i) => (i.videoId === videoId && i.notes === f.editorNotes ? { ...i, notes: b.editorNotes } : i)))
      })
      .catch((e) => say(`Couldn't break down this video. ${e instanceof Error ? e.message : ''}`.trim()))
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

  const toggleSave = (videoId: string) => {
    if (savedForClient.has(videoId)) {
      setIdeas((prev) => prev.filter((i) => !(i.videoId === videoId && i.clientId === client.id)))
    } else {
      saveIdea(videoId)
    }
  }

  // A saved video can lack its breakdown (saved before one existed, or overwritten); fetch it when opened.
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

  const planFromVideo = (videoId: string) => {
    const idea = saveIdea(videoId)
    setOpenVideoId(null)
    openPlan(idea.id)
  }

  const likeFormat = interp.source ? formatById.get(interp.topics[0]?.formatId ?? '') : undefined

  const setStatus = (ids: string[], status: IdeaStatus) =>
    setIdeas((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, status } : i)))

  // Daphne moves an approved idea along the board. Posting stamps the date; moving back clears it.
  const moveStage = (ideaId: string, stage: IdeaStage) =>
    setIdeas((prev) =>
      prev.map((i) => (i.id === ideaId ? { ...i, stage, postedAt: stage === 'posted' ? Date.now() : undefined } : i)),
    )

  // Annie's answer on a plan she was sent.
  const decide = (ideaId: string, approved: boolean, reason?: string) =>
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === ideaId
          ? { ...i, status: approved ? 'approved' : 'rejected', rejectReason: approved ? undefined : reason, decidedAt: Date.now() }
          : i,
      ),
    )

  const openVideo = openVideoId ? videoById.get(openVideoId) : undefined
  const openFormat = openVideo && formatById.get(openVideo.formatId)
  const planIdea = ideas.find((i) => i.id === planIdeaId)
  const planVideo = planIdea && videoById.get(planIdea.videoId)
  const planFormat = planVideo && formatById.get(planVideo.formatId)
  const planClient = planIdea && clients.find((c) => c.id === planIdea.clientId)
  // After a reload the plan that was open may be gone (deleted, or another account's); don't leave a blank page.
  const planMissing = !(planIdea && planVideo && planFormat && planClient)
  useEffect(() => {
    if (view === 'plan' && planMissing && liveChecked && (!live || synced)) setViewRaw('saved')
  }, [view, planMissing, liveChecked, live, synced])
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
    review: "Annie's review",
    plans: 'plans',
    plan: 'search results',
    settings: 'settings',
    channel: 'channel',
  }
  const counts = {
    saved: mine.length,
    waiting: mine.filter((i) => i.status === 'waiting').length,
    plans: mine.filter((i) => i.status === 'approved' && i.stage !== 'posted').length,
  }

  if (auth === 'checking') return null
  if (auth === 'signed-out' || (auth === 'open' && !signedIn)) {
    return (
      <LoginScreen
        real={auth === 'signed-out'}
        onSignIn={(a) => {
          if (a) {
            setAccount(a)
            setAuth('signed-in')
          } else setSignedIn(true)
        }}
      />
    )
  }
  const signOut = () => {
    if (auth === 'open') return setSignedIn(false)
    try {
      sessionStorage.removeItem(NAV_KEY)
    } catch {
      // Nothing stored to clear.
    }
    void logout().then(() => {
      setAccount(null)
      setAuth('signed-out')
    })
  }

  // First run on a live API: the agency adds its own first client before anything else.
  if (!clients.length) return <NewClientForm first existingIds={[]} onAdd={onAddClient} />

  const inClient = workspace !== 'all'

  return (
    <div className="shell">
      <Sidebar
        clients={clients}
        workspace={workspace}
        setWorkspace={setWorkspace}
        view={view}
        setView={setView}
        counts={counts}
        onSignOut={signOut}
        account={account}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        live={live}
        onAddClient={() => setAddingClient(true)}
      />
      {addingClient && (
        <NewClientForm existingIds={clients.map((c) => c.id)} onAdd={onAddClient} onCancel={() => setAddingClient(false)} />
      )}

      <div className="shell-main">
        <header className="mobile-bar">
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <strong>{inClient ? client.name : 'All clients'}</strong>
        </header>

        {syncProblem && (
          <div className="sync-problem" role="alert">
            <span>{syncProblem.text}</span>
            {syncProblem.kind === 'load' ? (
              <button className="btn btn-sm" onClick={() => window.location.reload()}>
                Reload
              </button>
            ) : syncProblem.kind === 'conflict' ? (
              <button className="btn btn-sm" onClick={() => setSyncProblem(null)}>
                OK
              </button>
            ) : (
              <button
                className="btn btn-sm"
                onClick={() => {
                  setSyncProblem(null)
                  setRetryTick((t) => t + 1)
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        <main className="main">
          {view !== 'channel' && (!inClient || view === 'overview') && (
            <OverviewScreen
              agency={account?.agency || AGENCY_NAME}
              clients={clients}
              ideas={shownIdeas}
              onOpen={(id, v) => {
                setWorkspaceRaw(id)
                setView(v)
              }}
            />
          )}

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
              planned={shownIdeas.filter((i) => i.clientId === client.id && (i.status === 'waiting' || i.status === 'approved')).length}
              target={client.monthlyTarget}
              lastSearch={lastSearch}
              onBackToResults={() => setView('results')}
            />
          )}

          {inClient && view === 'results' && (
            <ResultsScreen
              failed={live ? searchFailed : []}
              empty={live ? searchEmpty : []}
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
                    real={live}
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
              ideaStatus={new Map(shownIdeas.filter((i) => i.clientId === client.id).map((i) => [i.videoId, i.status]))}
              onOpen={openVideoDrawer}
              onToggleSave={toggleSave}
              blockedFormatIds={blockedFormatIds}
            />
          )}

          {inClient && view === 'saved' && (
            <ClientScreen
              client={client}
              ideas={shownIdeas}
              formatById={formatById}
              videoById={videoById}
              setStatus={setStatus}
              onRemove={(id) => setIdeas((prev) => prev.filter((i) => i.id !== id))}
              onPlan={openPlan}
              onFindMore={() => setView('search')}
            />
          )}

          {inClient && view === 'approvals' && (
            <ApprovalsScreen
              client={client}
              ideas={shownIdeas}
              formatById={formatById}
              videoById={videoById}
              setStatus={setStatus}
              onGoSaved={() => setView('saved')}
              onPlan={openPlan}
              onReview={() => setView('review')}
              live={live}
            />
          )}

          {inClient && view === 'review' && (
            <ReviewScreen
              client={client}
              ideas={shownIdeas}
              formatById={formatById}
              videoById={videoById}
              onDecide={decide}
              onBack={() => setView('approvals')}
            />
          )}

          {inClient && view === 'plans' && (
            <PlansScreen
              client={client}
              ideas={shownIdeas}
              formatById={formatById}
              videoById={videoById}
              onOpen={openPlan}
              onMove={moveStage}
              onGoApprovals={() => setView('approvals')}
            />
          )}

          {view === 'channel' && <ChannelScreen />}

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
              onGoApprovals={() => setView('approvals')}
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
          saved={savedForClient.has(openVideo.id)}
          onClose={() => setOpenVideoId(null)}
          onSave={() => toggleSave(openVideo.id)}
          onPlan={() => planFromVideo(openVideo.id)}
        />
      )}

      {reading && <ReadingOverlay source={reading} onDone={finishReading} />}
      {(searching || searchDone || scoring) && (
        <SearchStatus
          searching={searching}
          done={searchDone}
          scoring={scoring}
          onView={() => {
            if (!searchDone) return
            setWorkspaceRaw(searchDone.clientId)
            setView(searchDone.error ? 'search' : 'results')
            setSearchDone(null)
          }}
          onDismiss={() => setSearchDone(null)}
        />
      )}
    </div>
  )
}

// Order doesn't matter when comparing what's saved, so compare by id.
function libraryKey(library: { videos: { id: string }[]; formats: { id: string }[] }) {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
  return JSON.stringify([[...library.videos].sort(byId), [...library.formats].sort(byId)])
}

// A small corner notice for the background search, so the rest of the app stays usable.
function SearchStatus({
  searching,
  done,
  scoring,
  onView,
  onDismiss,
}: {
  searching: { q: string; platforms: Platform[]; step?: string } | null
  done: { text: string; error?: string } | null
  scoring: string | null
  onView: () => void
  onDismiss: () => void
}) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!searching) return
    setSeconds(0)
    const id = setInterval(() => setSeconds((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [searching])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 40,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        boxShadow: 'var(--shadow)',
      }}
    >
      {searching ? (
        <span className="small">
          {searching.step ? (
            <>
              {searching.step}… <span className="muted">{seconds}s · keep browsing, a new link takes about a minute</span>
            </>
          ) : (
            <>
              Searching {searching.platforms.map((p) => platformName[p]).join(', ')} for "{searching.q}"…{' '}
              <span className="muted">{seconds}s · keep browsing, new searches take 20–60s</span>
            </>
          )}
        </span>
      ) : done?.error ? (
        <>
          <span className="small">Search for "{done.text}" failed: {done.error}</span>
          <button className="link-btn small" onClick={onView}>
            Back to search
          </button>
          <button className="link-btn small" onClick={onDismiss} aria-label="Dismiss">
            ✕
          </button>
        </>
      ) : done ? (
        <>
          <span className="small">Results for "{done.text}" are ready.</span>
          <button className="btn btn-primary btn-sm" onClick={onView}>
            View
          </button>
          <button className="link-btn small" onClick={onDismiss} aria-label="Dismiss">
            ✕
          </button>
        </>
      ) : scoring ? (
        <span className="small">
          Checking each account's usual views for "{scoring}"… <span className="muted">scores update in about a minute</span>
        </span>
      ) : null}
    </div>
  )
}

import type { Format, Platform, Shot, Video } from '../types'
import { outlierScore } from './metrics'

// One video as the local API returns it (SearchVideo in backend/models.py).
interface LiveItem {
  id: string
  text: string
  url: string
  createTime: string | null
  // Null on Reddit, which shows no views.
  plays: number | null
  likes: number
  comments: number
  shares: number
  saves: number | null
  duration: number
  cover: string
  author: string
  // Null on Instagram, which doesn't give follower counts.
  followers: number | null
  // The account's usual views. Null when the API couldn't work it out, and missing on older saved searches.
  medianViews?: number | null
  music: string
  musicOriginal: boolean
  hashtags: string[]
  // Reddit only (backend/models.py): upvotes stand in for views, and medianUpvotes for medianViews.
  upvotes?: number | null
  community?: string | null
  medianUpvotes?: number | null
}

export interface LiveSearch {
  videos: Video[]
  formats: Format[]
  cached: boolean
  fetchedAt: number
  // TikTok, YouTube and X account medians arrive after the results; poll with cachedOnly until this is false.
  mediansPending: boolean
}

export async function checkLive(): Promise<boolean> {
  try {
    const r = await fetch('/api/health')
    if (!r.ok) return false
    return Boolean((await r.json()).live)
  } catch {
    return false
  }
}

// The first line of the caption, without hashtags: usually the hook.
function hookFrom(text: string): string {
  const line = text.split('\n').map((l) => l.replace(/#\S+/g, '').trim()).find(Boolean) ?? ''
  return line.length > 90 ? `${line.slice(0, 87).trimEnd()}…` : line
}

const daysSince = (iso: string | null) =>
  iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 999

const idPrefix: Record<Platform, string> = { tiktok: 'tt', instagram: 'ig', youtube: 'yt', reddit: 'rd', x: 'x' }
const noCaption: Record<Platform, string> = { tiktok: 'TikTok video', instagram: 'Instagram reel', youtube: 'YouTube Short', reddit: 'Reddit video', x: 'X video' }

function toVideo(item: LiveItem, query: string, platform: Platform): Video {
  return {
    id: `${idPrefix[platform]}-${item.id}`,
    platform,
    handle: platform === 'reddit' && item.community ? `r/${item.community}` : `@${item.author}`,
    hook: hookFrom(item.text) || noCaption[platform],
    // Reddit has no views: upvotes take their place, so the score maths and sorting stay as they are.
    views: platform === 'reddit' ? (item.upvotes ?? 0) : (item.plays ?? 0),
    followers: item.followers ?? 0,
    // Without the account's usual views, the score falls back to followers.
    medianViews: (platform === 'reddit' ? item.medianUpvotes : item.medianViews) ?? null,
    daysAgo: daysSince(item.createTime),
    lengthSec: Math.round(item.duration),
    shares: item.shares,
    saves: item.saves,
    formatId: `live-${item.id}`,
    keywords: [query.toLowerCase()],
    live: true,
    url: item.url,
    thumbnail: item.cover,
    caption: item.text,
    music: item.music,
    hashtags: item.hashtags,
    comments: platform === 'reddit' ? item.comments : undefined,
  }
}

// Live videos aren't sorted into hand-written formats, so each gets its own "format"
// built from what we actually know about it. Shot lists stay empty until we can read video frames.
function toFormat(item: LiveItem, v: Video): Format {
  const tags = item.hashtags.slice(0, 5).map((h) => `#${h}`)
  return {
    id: v.formatId,
    name: v.hook,
    short: v.hook,
    tags: [],
    audiences: [],
    summary: item.text,
    why: {
      hook: v.hook === noCaption[v.platform] ? 'No caption hook.' : `Caption opens with "${v.hook}".`,
      first3s: 'Save or plan this video to get the AI breakdown of its shots.',
      length: v.lengthSec ? `${v.lengthSec} seconds.` : 'Length not given.',
      format: tags.length ? `Tagged ${tags.join(' ')}.` : 'No hashtags.',
      sound: item.music ? `${item.musicOriginal ? 'Original sound' : 'Uses the sound'} "${item.music}".` : 'Unknown sound.',
    },
    shotList: [],
    props: [],
    needs: [],
    effort: 'medium',
    editorNotes: `Match the pacing and edit style of the reference: ${item.url}`,
  }
}

// The one platform a live search runs on: the only one picked, else TikTok.
export const livePlatform = (selected: Platform[]): Platform => (selected.length === 1 ? selected[0] : 'tiktok')

export async function searchLive(
  query: string,
  fresh = false,
  platform: Platform = 'tiktok',
  cachedOnly = false,
): Promise<LiveSearch> {
  const r = await fetch(
    `/api/search?q=${encodeURIComponent(query)}&platform=${platform}${fresh ? '&fresh=1' : ''}${cachedOnly ? '&cachedOnly=1' : ''}`,
  )
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? 'Search failed. Is the API running (npm run api)?')
  const videos: Video[] = []
  const formats: Format[] = []
  for (const item of body.videos as LiveItem[]) {
    const v = toVideo(item, query, platform)
    videos.push(v)
    formats.push(toFormat(item, v))
  }
  return { videos, formats, cached: Boolean(body.cached), fetchedAt: body.fetchedAt, mediansPending: Boolean(body.mediansPending) }
}

// The AI breakdown of one real video (Breakdown in backend/models.py).
export interface Breakdown {
  shotList: Shot[]
  why: Format['why']
  props: string[]
  editorNotes: string
  lines: { time: string; text: string; role: 'hook' | 'setup' | 'proof' | 'payoff' | 'cta' }[]
}

interface AnalyzeJob {
  job: string
  status: 'queued' | 'running' | 'done' | 'failed'
  progress: number
  step: string
  result?: Breakdown
  error?: string
}

// Starts a breakdown and polls until it's done. The first run of a video takes about a minute;
// asking again for the same link returns the saved result.
export async function analyzeVideo(url: string, onStep: (step: string) => void): Promise<Breakdown> {
  const r = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const started = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(started.error ?? 'Could not start the breakdown.')
  for (;;) {
    const res = await fetch(`/api/analyze/${started.job}`)
    const job = (await res.json().catch(() => ({}))) as Partial<AnalyzeJob>
    if (!res.ok) throw new Error(job.error ?? 'The breakdown was lost. Try again.')
    if (job.status === 'done' && job.result) return job.result
    if (job.status === 'failed') throw new Error(job.error ?? 'The breakdown failed.')
    onStep(job.step ?? '')
    await new Promise((done) => setTimeout(done, 2000))
  }
}

// The breakdown fills the same Format fields the sample data has.
export const applyBreakdown = (f: Format, b: Breakdown): Format => ({
  ...f,
  shotList: b.shotList,
  why: b.why,
  props: b.props,
  editorNotes: b.editorNotes,
})

// Clients and saved ideas are also kept by the API, so they survive a new browser.
// null means nothing has been saved there yet.
export async function loadList<T>(name: 'clients' | 'ideas'): Promise<T[] | null> {
  const r = await fetch(`/api/${name}`)
  if (!r.ok) throw new Error(`Could not load ${name}.`)
  return r.json()
}

export async function saveList<T>(name: 'clients' | 'ideas', items: T[]): Promise<void> {
  const r = await fetch(`/api/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  })
  if (!r.ok) throw new Error(`Could not save ${name}.`)
}

// The real videos and breakdowns that saved ideas point to. Without them, a saved idea opened
// in another browser has nothing to show.
export interface Library {
  videos: Video[]
  formats: Format[]
}

export async function loadLibrary(): Promise<Library | null> {
  const r = await fetch('/api/library')
  if (!r.ok) throw new Error('Could not load saved videos.')
  return r.json()
}

export async function saveLibrary(library: Library): Promise<void> {
  const r = await fetch('/api/library', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(library),
  })
  if (!r.ok) throw new Error('Could not save saved videos.')
}

// Sounds and hashtags shared by several accounts in the results: the live version of "formats that repeat".
export interface Pattern {
  kind: 'sound' | 'hashtag'
  label: string
  accounts: number
  avgScore: number
  videoIds: string[]
}

const genericTags = new Set(['fyp', 'foryou', 'foryoupage', 'fy', 'viral', 'trending', 'tiktok', 'xyzbca', 'explore', 'fypシ', 'fypage', 'trend'])

export function findPatterns(videos: Video[], query: string): Pattern[] {
  const queryWords = new Set(query.toLowerCase().split(/\s+/))
  const groups = new Map<string, { kind: Pattern['kind']; label: string; vids: Video[] }>()
  const add = (key: string, kind: Pattern['kind'], label: string, v: Video) => {
    const g = groups.get(key) ?? { kind, label, vids: [] }
    g.vids.push(v)
    groups.set(key, g)
  }
  for (const v of videos) {
    if (v.music && !/original sound/i.test(v.music)) add(`s:${v.music}`, 'sound', v.music, v)
    for (const h of new Set((v.hashtags ?? []).map((x) => x.toLowerCase()))) {
      if (!genericTags.has(h) && !queryWords.has(h)) add(`h:${h}`, 'hashtag', `#${h}`, v)
    }
  }
  return [...groups.values()]
    .map((g) => ({
      kind: g.kind,
      label: g.label,
      accounts: new Set(g.vids.map((v) => v.handle)).size,
      avgScore: g.vids.reduce((s, v) => s + outlierScore(v), 0) / g.vids.length,
      videoIds: g.vids.map((v) => v.id),
    }))
    .filter((p) => p.accounts >= 2)
    .sort((a, b) => b.accounts - a.accounts || b.avgScore - a.avgScore)
    .slice(0, 6)
}

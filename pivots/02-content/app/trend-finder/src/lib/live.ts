import type { Format, Video } from '../types'
import { outlierScore } from './metrics'

// One TikTok video as the local API returns it (see server/index.mjs).
interface LiveItem {
  id: string
  text: string
  url: string
  createTime: string | null
  plays: number
  likes: number
  comments: number
  shares: number
  saves: number | null
  duration: number
  cover: string
  author: string
  followers: number
  music: string
  musicOriginal: boolean
  hashtags: string[]
}

export interface LiveSearch {
  videos: Video[]
  formats: Format[]
  cached: boolean
  fetchedAt: number
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

function toVideo(item: LiveItem, query: string): Video {
  return {
    id: `tt-${item.id}`,
    platform: 'tiktok',
    handle: `@${item.author}`,
    hook: hookFrom(item.text) || 'TikTok video',
    views: item.plays,
    followers: item.followers,
    // We don't fetch each account's usual views yet, so the score falls back to followers.
    medianViews: null,
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
      hook: v.hook === 'TikTok video' ? 'No caption hook.' : `Caption opens with "${v.hook}".`,
      first3s: "Watch the video to see the opening shot. We can't read video frames yet.",
      length: `${v.lengthSec} seconds.`,
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

export async function searchLive(query: string): Promise<LiveSearch> {
  const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? 'Search failed. Is the API running (npm run api)?')
  const videos: Video[] = []
  const formats: Format[] = []
  for (const item of body.videos as LiveItem[]) {
    const v = toVideo(item, query)
    videos.push(v)
    formats.push(toFormat(item, v))
  }
  return { videos, formats, cached: Boolean(body.cached), fetchedAt: body.fetchedAt }
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

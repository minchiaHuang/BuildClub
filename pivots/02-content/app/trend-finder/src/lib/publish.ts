import { compact } from './metrics.ts'
import type { CutState } from './cut.ts'
import type { IdeaStatus } from '../types.ts'
import { formatDay } from './dates.ts'

// Publishing: posts of an approved finished video and the numbers that come back. Mirrors backend/publishing.py.
// Posting is simulated unless the server says otherwise (see getPublishMode); a simulated post is never "published".
export type PubPlatform = 'tiktok' | 'instagram' | 'youtube'
export const PUB_PLATFORMS: PubPlatform[] = ['tiktok', 'instagram', 'youtube']
export const PUB_PLATFORM_NAME: Record<PubPlatform, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube Shorts' }
export const MAX_CAPTION = 2200

export interface Post {
  id: string
  ideaId: string
  platform: PubPlatform
  scheduledAt: number | null
  status: 'draft' | 'publishing' | 'scheduled' | 'published' | 'failed'
  externalId: string | null
  error: string | null
  createdAt: number
  url: string | null
  publishedAt: number | null
  caption: string
}

export interface Snapshot {
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  followers: number | null
  // Seconds since 1970, as the server stores it.
  fetchedAt: number
}

export type BadgeKind = 'wait' | 'ok' | 'no'

// A post is simulated when the server runs the fake publisher or the post carries a fake id.
export const isSimulated = (post: Pick<Post, 'externalId'>, simulatedMode: boolean) =>
  simulatedMode || (post.externalId ?? '').startsWith('fake-')

// The badge word for a post: draft, queued, simulated, failed (or published when a real publisher sent it).
export function badgeOf(post: Pick<Post, 'status' | 'externalId'>, simulatedMode: boolean): { label: string; kind: BadgeKind } {
  const sim = isSimulated(post, simulatedMode)
  switch (post.status) {
    case 'failed':
      return { label: 'Failed', kind: 'no' }
    case 'draft':
      return { label: 'Draft', kind: 'wait' }
    case 'publishing':
      return { label: 'Sending', kind: 'wait' }
    case 'scheduled':
      return { label: sim ? 'Queued (simulated)' : 'Queued', kind: 'wait' }
    default:
      return sim ? { label: 'Simulated', kind: 'wait' } : { label: 'Published', kind: 'ok' }
  }
}

export const SIMULATED_NOTE = 'Simulated post: nothing was sent to the platform.'

// The one-line explanation under a post row.
export function postNote(post: Pick<Post, 'status' | 'externalId' | 'platform'>, simulatedMode: boolean): string | null {
  if (post.status === 'failed' || post.status === 'draft' || post.status === 'publishing') return null
  const name = PUB_PLATFORM_NAME[post.platform]
  if (isSimulated(post, simulatedMode)) return `Simulated post: nothing was sent to ${name}`
  return null
}

// --- Numbers typed in by hand ---

export const METRIC_FIELDS = ['views', 'likes', 'comments', 'shares', 'saves', 'followers'] as const
export type MetricField = (typeof METRIC_FIELDS)[number]
export const METRIC_LABEL: Record<MetricField, string> = {
  views: 'Views',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saves: 'Saves',
  followers: 'Followers (optional)',
}

export type MetricInputs = Partial<Record<MetricField, string>>
export type MetricValues = Partial<Record<MetricField, number>>

export interface MetricCheck {
  values: MetricValues
  // Field -> what is wrong with it.
  errors: Partial<Record<MetricField, string>>
  // Set when nothing was filled in.
  empty: boolean
}

// Whole numbers, 0 or more. A blank box is left out. "1,200" and "1 200" are accepted; "12.5", "-3" and "1e3" are not.
export function checkMetrics(inputs: MetricInputs): MetricCheck {
  const values: MetricValues = {}
  const errors: MetricCheck['errors'] = {}
  for (const f of METRIC_FIELDS) {
    const raw = (inputs[f] ?? '').trim()
    if (!raw) continue
    const clean = raw.replace(/[,\s]/g, '')
    if (!/^\d+$/.test(clean) || !Number.isSafeInteger(Number(clean))) {
      errors[f] = 'Use a whole number, 0 or more.'
      continue
    }
    values[f] = Number(clean)
  }
  return { values, errors, empty: Object.keys(values).length === 0 && Object.keys(errors).length === 0 }
}

// --- How earlier videos did, per topic ---

export interface TopicSummary {
  topic: string
  ideas: number
  measuredIdeas: number
  totalViews: number | null
  avgViews: number | null
  avgEngagementRate: number | null
}

export interface IdeaSummary {
  ideaId: string
  posts: number
  measuredPosts: number
  views: number | null
  engagementRate: number | null
}

export interface PublishSummary {
  ideas: IdeaSummary[]
  topics: TopicSummary[]
}

export const percent = (rate: number) => `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`

// "Your last 2 tofu videos: 12.4k views avg, 7.7% engagement". null when no video of the topic has numbers yet.
export function topicLine(t: TopicSummary): string | null {
  if (!t.measuredIdeas || t.avgViews === null) return null
  const subject = t.measuredIdeas === 1 ? `Your last ${t.topic} video` : `Your last ${t.measuredIdeas} ${t.topic} videos`
  const avg = t.measuredIdeas === 1 ? 'views' : 'views avg'
  const engagement = t.avgEngagementRate === null ? '' : `, ${percent(t.avgEngagementRate)} engagement`
  return `${subject}: ${compact(t.avgViews)} ${avg}${engagement}`
}

// The topics a search text speaks about: those named in it, best-measured first. No text lists all of them.
export function topicsFor(summary: PublishSummary | null, text: string, max = 3): TopicSummary[] {
  if (!summary) return []
  const words = text.toLowerCase().replace(/#/g, ' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const measured = summary.topics.filter((t) => topicLine(t) !== null)
  const hit = words.length ? measured.filter((t) => words.includes(t.topic) || words.some((w) => w.length > 3 && t.topic.includes(w))) : measured
  const ranked = [...hit].sort((a, b) => b.measuredIdeas - a.measuredIdeas || (b.avgViews ?? 0) - (a.avgViews ?? 0))
  // One video can sit under several hashtags (tofu, 豆腐) with the very same numbers: show those once.
  const seen = new Set<string>()
  return ranked
    .filter((t) => {
      const key = `${t.measuredIdeas}|${t.avgViews}|${t.avgEngagementRate}`
      return seen.has(key) ? false : (seen.add(key), true)
    })
    .slice(0, max)
}

// One finished video's result for its board card: "12.4k views · 7.7% engagement". null without numbers.
export function ideaResultLine(i: IdeaSummary | undefined): string | null {
  if (!i || i.views === null) return null
  return `${compact(i.views)} views${i.engagementRate === null ? '' : ` · ${percent(i.engagementRate)} engagement`}`
}

// --- API ---

async function send<T>(r: Response, fallback: string): Promise<T> {
  if (r.ok) return r.json()
  const body = await r.json().catch(() => null)
  throw new Error(body?.error ?? fallback)
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const ideaBase = (id: string) => `/api/ideas/${encodeURIComponent(id)}`

export async function getPublishMode(): Promise<{ mode: string; simulated: boolean }> {
  return send(await fetch('/api/publishing/mode'), "Couldn't check how posting works.")
}

export async function listPosts(ideaId: string): Promise<Post[]> {
  return send(await fetch(`${ideaBase(ideaId)}/publications`), "Couldn't load the posts.")
}

export async function publishIdea(ideaId: string, body: { caption: string; platforms: PubPlatform[]; scheduleAt?: number }): Promise<Post[]> {
  const r = await fetch(`${ideaBase(ideaId)}/publish`, json(body))
  // All platforms failing answers 502 with the posts (and their errors) in the body.
  if (r.status === 502) {
    const out = (await r.json().catch(() => null)) as { posts?: Post[]; error?: string } | null
    if (out?.posts) return out.posts
    throw new Error(out?.error ?? "Couldn't post.")
  }
  return (await send<{ posts: Post[] }>(r, "Couldn't post.")).posts
}

export async function retryPost(postId: string): Promise<Post> {
  const r = await fetch(`/api/publications/${encodeURIComponent(postId)}/publish`, { method: 'POST' })
  const body = await r.json().catch(() => null)
  if (body && 'id' in body) return body as Post
  throw new Error(body?.error ?? "Couldn't post.")
}

export async function saveMetrics(postId: string, values: MetricValues): Promise<void> {
  await send(await fetch(`/api/publications/${encodeURIComponent(postId)}/metrics`, json(values)), "Couldn't save the numbers.")
}

// The latest numbers of each post of the idea, by post id.
export async function latestByPost(ideaId: string): Promise<Record<string, Snapshot | null>> {
  const out = await send<{ variants: { publicationId: string; latest: Snapshot | null }[] }>(await fetch(`${ideaBase(ideaId)}/compare`), "Couldn't load the numbers.")
  return Object.fromEntries(out.variants.map((v) => [v.publicationId, v.latest]))
}

export async function getSummary(): Promise<PublishSummary> {
  return send(await fetch('/api/publishing/summary'), "Couldn't load the results.")
}

// --- Approval record ---

// "2 Nov 14:05" in local time, 24 hours.
export function dayTime(ms: number): string {
  const d = new Date(ms)
  return `${formatDay(ms)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "Approved by Annie · 2 Nov 14:05 · this version". null when the current video was not approved.
export function approvalLine(cut: Pick<CutState, 'output' | 'stale' | 'review'> | null, manager: string): string | null {
  const r = cut?.review
  if (!cut?.output || r?.status !== 'approved') return null
  const when = r.decidedAt ? ` · ${dayTime(r.decidedAt)}` : ''
  return cut.stale ? `Approved by ${manager}${when} · an older version, the video changed since` : `Approved by ${manager}${when} · this version`
}

// What is missing before a video can be posted, in plain words; null when it is ready.
export function missingApproval(status: IdeaStatus, cut: Pick<CutState, 'output' | 'stale' | 'review'> | null, manager: string): string | null {
  if (status !== 'approved') return `${manager} needs to approve the plan first, then the finished video.`
  if (!cut || !cut.output) return `Make the video first. ${manager} needs to approve the finished video before it can be posted.`
  if (cut.stale) return 'The takes or music changed after the video was made. Make it again.'
  const review = cut.review
  if (!review) return `${manager} needs to approve the finished video first. This version was not sent yet. Send it from "Make the video" above.`
  if (review.status === 'waiting') return `${manager} needs to approve the finished video first. It is waiting for them now.`
  if (review.status === 'rejected') return `${manager} sent the video back. Fix it, make it again and send it again.`
  return null
}


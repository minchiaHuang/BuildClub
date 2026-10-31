import { UNKNOWN_DAYS, compact } from './metrics.ts'
import type { Pattern } from './live.ts'
import type { Baseline, Denominator, Platform, Video } from '../types.ts'

export const HIT_MULTIPLE = 2
export const LIMITED_DAYS = 30
export const BASELINE_PLATFORMS: Platform[] = ['tiktok', 'instagram']
export const COHORT_PLATFORMS: Platform[] = ['tiktok']

export type Evidence = 'high' | 'medium' | 'limited'

export interface CohortRow {
  videoId: string
  handle: string
  followers: number
  multiple: number | null
  rough: boolean
  hit: boolean | null
}
export interface Cohort {
  rows: CohortRow[]
  accounts: number
  hits: number
  counted: number
}

export const EVIDENCE_TEXT: Record<Evidence, string> = {
  high: 'Evidence: high',
  medium: 'Evidence: medium',
  limited: 'Evidence: limited',
}

export const COPY = {
  noDetails: 'Baseline details not recorded',
  noPlatform: 'No baseline details for this platform yet',
  rough: 'Rough estimate (views ÷ followers)',
  roughShort: 'Rough',
  dateUnknown: 'Posting date unknown',
  tiktokOnly: 'Counts TikTok accounts only for now',
  oneOff: 'One-off',
  methodTitle: 'How we calculate this',
  methodSample: "Each account's baseline is only its latest 6 videos: a small sample.",
  tags: ["Doesn't fit the brand's tone", "Format doesn't suit this client", 'Too hard or costly to film', 'Did something similar recently', 'Other'],
  brand: 'Remake',
  hitRate: (hits: number, counted: number) => `Hit rate ${hits} / ${counted} · within this search's results`,
}

// One decimal below 100 (22.9×), whole numbers above. metrics.times rounds from 10 up, which would hide the .9.
export const times = (n: number) => `${n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1).replace(/\.0$/, '')}×`

// Same rule as the backend, so videos from old cache files get a denominator too.
export function denominatorOf(v: Video): Denominator | null {
  const d = v.baseline?.denominator
  if (d) return d
  return v.medianViews ? 'median' : v.followers > 0 ? 'followers' : null
}

export function multipleOf(v: Video): number | null {
  const d = denominatorOf(v)
  if (d === 'median') return v.medianViews ? v.views / v.medianViews : null
  if (d === 'followers') return v.followers > 0 ? v.views / v.followers : null
  return null
}

export function cohortOf(group: Video[]): Cohort {
  const newest = new Map<string, Video>()
  for (const v of group) {
    const cur = newest.get(v.handle)
    if (!cur || v.daysAgo < cur.daysAgo) newest.set(v.handle, v)
  }
  const rows: CohortRow[] = [...newest.values()].map((v) => {
    const multiple = multipleOf(v)
    const rough = denominatorOf(v) === 'followers'
    return {
      videoId: v.id,
      handle: v.handle,
      followers: v.followers,
      multiple,
      rough,
      hit: rough || multiple === null ? null : multiple >= HIT_MULTIPLE,
    }
  })
  // Counted rows first (best multiple first), rough ones last.
  rows.sort((a, b) => Number(a.rough) - Number(b.rough) || (b.multiple ?? -1) - (a.multiple ?? -1))
  const counted = rows.filter((r) => !r.rough && r.multiple !== null)
  return { rows, accounts: rows.length, hits: counted.filter((r) => r.hit).length, counted: counted.length }
}

export function cohortsByPattern(videos: Video[], patterns: Pattern[]): Map<string, Cohort> {
  const pool = videos.filter((v) => COHORT_PLATFORMS.includes(v.platform))
  const out = new Map<string, Cohort>()
  for (const p of patterns) {
    const ids = new Set(p.videoIds)
    out.set(p.label, cohortOf(pool.filter((v) => ids.has(v.id))))
  }
  return out
}

export function cohortsByVideo(videos: Video[], patterns: Pattern[]): Map<string, Cohort> {
  const byPattern = cohortsByPattern(videos, patterns)
  const out = new Map<string, Cohort>()
  for (const v of videos) {
    if (!COHORT_PLATFORMS.includes(v.platform)) continue
    const p = patterns.find((pt) => pt.videoIds.includes(v.id))
    const c = p && byPattern.get(p.label)
    if (c) out.set(v.id, c)
  }
  return out
}

export function evidenceOf(v: Video, cohort?: Cohort): Evidence | null {
  if (!BASELINE_PLATFORMS.includes(v.platform)) return null
  const d = denominatorOf(v)
  if (!d) return null
  const old = v.daysAgo < UNKNOWN_DAYS && v.daysAgo > LIMITED_DAYS
  if (d === 'followers' || v.baseline?.medianN == null || old) return 'limited'
  if (cohort && cohort.accounts >= 3 && cohort.hits >= 2) return 'high'
  return 'medium'
}

export function plainLine(v: Video, cohort?: Cohort): string {
  const m = multipleOf(v)
  if (m === null) return ''
  if (denominatorOf(v) === 'followers') return `Rough: ${times(m)} views ÷ followers`
  const n = v.baseline?.medianN
  let s = `${times(m)} this account's median${n ? ` (baseline: ${n} videos)` : ''}`
  if (cohort && cohort.accounts >= 3) s += `; ${cohort.accounts} accounts use this pattern, ${cohort.hits} also hit ${HIT_MULTIPLE}× or more`
  return s
}

const range = (b: Baseline | undefined) =>
  b && b.medianN && b.baselineFrom && b.baselineTo ? `${b.medianN} videos, ${b.baselineFrom} to ${b.baselineTo}` : null

export function formulaLine(v: Video): string {
  const m = multipleOf(v)
  const d = denominatorOf(v)
  if (m === null || !d) return ''
  if (d === 'followers') return `${compact(v.views)} views ÷ ${compact(v.followers)} followers = ${times(m)} · ${COPY.rough}`
  return `${compact(v.views)} views ÷ ${compact(v.medianViews ?? 0)} median (${range(v.baseline) ?? COPY.noDetails}) = ${times(m)}`
}

const pad = (n: number) => String(n).padStart(2, '0')
export function stamp(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fetchedLine(v: Video): string {
  const parts: string[] = []
  if (v.baseline?.medianFetchedAt) parts.push(`Median fetched ${stamp(v.baseline.medianFetchedAt)}`)
  if (v.fetchedAt) parts.push(`${parts.length ? 'this' : 'This'} search fetched ${stamp(v.fetchedAt)}`)
  return parts.join(' · ')
}

export function sourceLine(v: Video): string {
  const parts = [v.fetchedAt ? `Public page, fetched ${stamp(v.fetchedAt)}` : 'Public page']
  if (v.daysAgo >= UNKNOWN_DAYS) parts.push(COPY.dateUnknown)
  return parts.join(' · ')
}

// The three fixed limit lines; line 2 is Instagram only, and line 1 names only what is actually missing.
export function limitLines(v: Video): string[] {
  const lines = [`We can't see watch time or retention${v.saves === null ? ' or saves' : ''}`]
  if (v.platform === 'instagram') lines.push('Instagram views include paid (boosted) views')
  lines.push("These numbers don't mean a copy will go viral")
  return lines
}

export function followerBand(n: number): string {
  if (!(n > 0)) return '–'
  if (n < 10_000) return '<10k'
  if (n < 100_000) return '10k–100k'
  if (n < 1_000_000) return '100k–1M'
  return '1M+'
}

export function cachedLabel(fetchedAt: number, now: number): string {
  if (fetchedAt <= 0) return 'Cached'
  const days = Math.max(0, Math.floor((now - fetchedAt) / 86_400_000))
  return days === 0 ? 'Cached · fetched today' : `Cached · fetched ${days} ${days === 1 ? 'day' : 'days'} ago`
}

// The score poll brings the median and its details together; copy both so a card never keeps a stale denominator.
export function fillBaseline(v: Video, fresh: Video): Video {
  if (fresh.medianViews == null) return v
  return { ...v, medianViews: fresh.medianViews, baseline: fresh.baseline }
}

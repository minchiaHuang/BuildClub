import type { Client, Format, Platform, Video } from '../types'

export const outlierScore = (v: Video) => v.views / v.medianViews
export const viewsPerFollower = (v: Video) => v.views / v.followers
// Shares + saves per 100 views. Instagram hides saves, so it counts shares only there.
export const shareSaveRate = (v: Video) => ((v.shares + (v.saves ?? 0)) / v.views) * 100
export const viewsPerDay = (v: Video) => v.views / Math.max(v.daysAgo, 1)

export function compact(n: number): string {
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (n >= 1_000) return `${trim(n / 1_000)}k`
  return String(Math.round(n))
}
const trim = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1)).replace(/\.0$/, '')

export const times = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1).replace(/\.0$/, '')}×`

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export const ago =(days: number) => (days <= 1 ? 'today' : `${days} days ago`)

export type TrendStage = 'early' | 'rising' | 'everywhere' | 'one-off'

export interface FormatTrend {
  format: Format
  counts: Record<Platform, number>
  stage: TrendStage
  // Platform the format is big on but hasn't reached yet (for "early").
  leader?: Platform
  lagger?: Platform
  newestDays: number
}

const otherPlatform = (p: Platform): Platform => (p === 'tiktok' ? 'instagram' : 'tiktok')

// How we label a format, from how many accounts used it on each platform.
export function formatTrend(format: Format, pool: Video[]): FormatTrend {
  const used = pool.filter((v) => v.formatId === format.id)
  const counts = {
    tiktok: used.filter((v) => v.platform === 'tiktok').length,
    instagram: used.filter((v) => v.platform === 'instagram').length,
  }
  const newestDays = Math.min(...used.map((v) => v.daysAgo))
  const total = counts.tiktok + counts.instagram

  if (total < 3) return { format, counts, stage: 'one-off', newestDays }
  for (const p of ['tiktok', 'instagram'] as Platform[]) {
    if (counts[p] >= 3 && counts[otherPlatform(p)] <= 1) {
      return { format, counts, stage: 'early', leader: p, lagger: otherPlatform(p), newestDays }
    }
  }
  if (counts.tiktok >= 4 && counts.instagram >= 4) return { format, counts, stage: 'everywhere', newestDays }
  return { format, counts, stage: 'rising', newestDays }
}

export function stageText(t: FormatTrend): string {
  if (t.stage === 'early' && t.leader && t.lagger)
    return `Big on ${platformName[t.leader]}, not yet on ${platformName[t.lagger]}`
  if (t.stage === 'rising') return 'Growing on both platforms'
  if (t.stage === 'everywhere') return 'On every feed. Probably too late'
  return 'Only one or two videos. Could be luck'
}

export const stageOrder: Record<TrendStage, number> = { early: 0, rising: 1, everywhere: 2, 'one-off': 3 }

export const platformName: Record<Platform, string> = { tiktok: 'TikTok', instagram: 'Instagram' }

export function clientFit(format: Format, client: Client) {
  const blockers = format.needs.filter((n) => client.cannot.includes(n))
  if (blockers.length) return { ok: false, text: `Hard for ${client.name}: needs ${blockers.join(' and ').toLowerCase()}.` }
  const needs = format.needs.join(' and ').toLowerCase()
  const effort = { easy: 'Easy to film', medium: 'Doable', hard: 'Takes planning' }[format.effort]
  return { ok: true, text: `${effort} for ${client.name}. Needs ${needs}.` }
}

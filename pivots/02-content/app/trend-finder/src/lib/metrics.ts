import type { Client, Format, Platform, Video } from '../types'

export const outlierScore = (v: Video) => v.views / Math.max(v.medianViews ?? v.followers, 1)
// Plain-English label for a score, so people don't have to read the number.
export type Tier = 'breakout' | 'strong' | 'normal'
export const tierOf = (score: number): Tier => (score >= 100 ? 'breakout' : score >= 10 ? 'strong' : 'normal')
export const tierName: Record<Tier, string> = { breakout: 'Breakout', strong: 'Strong', normal: 'Normal' }

// The score in words, e.g. "77 times more views than followers".
export function scoreLine(v: Video): string {
  const score = outlierScore(v)
  const byFollowers = v.medianViews === null
  if (score < 1.5) return byFollowers ? 'About as many views as followers' : 'About its usual views'
  const n = score >= 10 ? Math.round(score).toLocaleString() : score.toFixed(1).replace(/\.0$/, '')
  return byFollowers ? `${n} times more views than followers` : `${n} times its usual views`
}

export const viewsPerFollower = (v: Video) => v.views / Math.max(v.followers, 1)
// Shares + saves per 100 views. Instagram hides saves, so it counts shares only there.
export const shareSaveRate = (v: Video) => ((v.shares + (v.saves ?? 0)) / Math.max(v.views, 1)) * 100
export const viewsPerDay = (v: Video) => v.views / Math.max(v.daysAgo, 1)

export function compact(n: number): string {
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (n >= 1_000) return `${trim(n / 1_000)}k`
  return String(Math.round(n))
}
const trim = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1)).replace(/\.0$/, '')

export const times = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1).replace(/\.0$/, '')}×`

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export const ago = (days: number) => (days <= 1 ? 'today' : `${days} days ago`)
// Short form for tight spaces: 5d, 3w, 4mo, 2y.
export const agoShort = (days: number) =>
  days < 1
    ? 'today'
    : days < 14
      ? `${days}d`
      : days < 60
        ? `${Math.round(days / 7)}w`
        : days < 730
          ? `${Math.round(days / 30)}mo`
          : `${Math.round(days / 365)}y`

export type TrendStage = 'early' | 'rising' | 'everywhere' | 'one-off'

export interface FormatTrend {
  format: Format
  // TikTok accounts that used the format.
  accounts: number
  stage: TrendStage
  newestDays: number
}

// How we label a format, from how many TikTok accounts used it and how recently.
// Few accounts, all new = early. Many accounts, still posting = rising. No new posts in 2 weeks = peaked.
export function formatTrend(format: Format, pool: Video[]): FormatTrend {
  const used = pool.filter((v) => v.formatId === format.id && v.platform === 'tiktok')
  const accounts = new Set(used.map((v) => v.handle)).size
  const newestDays = Math.min(...used.map((v) => v.daysAgo))
  const oldestDays = Math.max(...used.map((v) => v.daysAgo))

  if (accounts < 3) return { format, accounts, stage: 'one-off', newestDays }
  if (newestDays > 14) return { format, accounts, stage: 'everywhere', newestDays }
  if (accounts < 5 && oldestDays <= 14) return { format, accounts, stage: 'early', newestDays }
  return { format, accounts, stage: 'rising', newestDays }
}

export function stageText(t: FormatTrend): string {
  if (t.stage === 'early') return `Just started: ${t.accounts} accounts in the last 2 weeks`
  if (t.stage === 'rising') return `Spreading: ${t.accounts} accounts, still new posts`
  if (t.stage === 'everywhere') return `No new posts in ${agoShort(t.newestDays)}. Probably too late`
  return 'Only one or two accounts. Could be luck'
}

export const stageOrder: Record<TrendStage, number> = { early: 0, rising: 1, everywhere: 2, 'one-off': 3 }

export const platformName: Record<Platform, string> = { tiktok: 'TikTok', instagram: 'Instagram' }

export function clientFit(format: Format, client: Client) {
  if (format.needs.length === 0) return { ok: true, text: `We can't check this one for ${client.name} yet. Watch it and decide.` }
  const blockers = format.needs.filter((n) => client.cannot.includes(n))
  if (blockers.length) return { ok: false, text: `Hard for ${client.name}: needs ${blockers.join(' and ').toLowerCase()}.` }
  const needs = format.needs.join(' and ').toLowerCase()
  const effort = { easy: 'Easy to film', medium: 'Doable', hard: 'Takes planning' }[format.effort]
  return { ok: true, text: `${effort} for ${client.name}. Needs ${needs}.` }
}

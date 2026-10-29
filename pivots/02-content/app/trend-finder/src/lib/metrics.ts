import type { Client, Format, Platform, Video } from '../types'

// A Reddit post whose subreddit has no usual upvotes yet has no score (0), so it sorts after the scored ones
// instead of beating them on raw upvotes.
export const outlierScore = (v: Video) =>
  v.platform === 'reddit' && v.medianViews === null ? 0 : v.views / Math.max(v.medianViews ?? v.followers, 1)
// Live Instagram results have neither the account's usual views nor its followers, so there is
// nothing to compare against: show views only, no × score. (outlierScore is then just views, which still sorts.)
// Reddit shows no views, so its posts are compared by upvotes (stored in `views`).
export const viewsWord = (v: Video) => (v.platform === 'reddit' ? 'upvotes' : 'views')
export const hasScore = (v: Video) => v.medianViews !== null || v.followers > 0
// Plain-English label for a score, so people don't have to read the number.
export type Tier = 'breakout' | 'strong' | 'normal'
export const tierOf = (score: number): Tier => (score >= 100 ? 'breakout' : score >= 10 ? 'strong' : 'normal')
export const tierName: Record<Tier, string> = { breakout: 'Breakout', strong: 'Strong', normal: 'Normal' }

// The score in words, e.g. "77 times more views than followers".
export function scoreLine(v: Video): string {
  if (v.platform === 'reddit') {
    if (!hasScore(v)) return `${compact(v.views)} upvotes. No usual upvotes for the subreddit yet`
    const score = outlierScore(v)
    if (score < 1.5) return 'About its subreddit’s usual upvotes'
    return `${score >= 10 ? Math.round(score).toLocaleString() : score.toFixed(1).replace(/\.0$/, '')} times its subreddit’s usual upvotes`
  }
  if (!hasScore(v)) return `${compact(v.views)} views. No follower count to compare with`
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

export const times = (n: number) => `${n >= 10 ? Math.round(n).toLocaleString() : n.toFixed(1).replace(/\.0$/, '')}×`

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// daysAgo for a video whose posting date we don't know (YouTube search results have none).
export const UNKNOWN_DAYS = 999
export const hasDate = (v: Video) => v.daysAgo < UNKNOWN_DAYS

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

export const platformName: Record<Platform, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', reddit: 'Reddit', x: 'X' }

// Platforms whose search failed with the very same sentence share one line: "TikTok and Instagram: <sentence>".
export function groupFailures(failed: { platform: Platform; message: string }[]): { platforms: Platform[]; message: string }[] {
  const groups: { platforms: Platform[]; message: string }[] = []
  for (const f of failed) {
    const g = groups.find((x) => x.message === f.message)
    if (g) g.platforms.push(f.platform)
    else groups.push({ platforms: [f.platform], message: f.message })
  }
  return groups
}
export function platformList(platforms: Platform[]): string {
  const names = platforms.map((p) => platformName[p])
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '')
}

export function clientFit(format: Format, client: Client) {
  if (!format.needsKnown && format.needs.length === 0) return { ok: true, text: `We can't check this one for ${client.name} yet. Watch it and decide.` }
  const blockers = format.needs.filter((n) => client.cannot.includes(n))
  if (blockers.length) return { ok: false, text: `Hard for ${client.name}: needs ${blockers.join(' and ').toLowerCase()}.` }
  const needs = format.needs.length ? format.needs.join(' and ').toLowerCase() : 'nothing special'
  const effort = { easy: 'Easy to film', medium: 'Doable', hard: 'Takes planning' }[format.effort]
  return { ok: true, text: `${effort} for ${client.name}. Needs ${needs}.` }
}

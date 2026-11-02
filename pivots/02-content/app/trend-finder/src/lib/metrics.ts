import type { Client, Format, Platform, Video } from '../types'
import { t } from './i18n.ts'
import { needLabel } from './needs.ts'

// The client's rule: views over followers, on every platform. Only when the follower count is unknown or 0
// (e.g. Reddit, which has no followers) does it fall back to the account's usual views (subreddit's usual upvotes).
// With neither there is nothing to compare against, so the score is 0 and the screens show views only, no × score.
export const byFollowers = (v: Video) => v.platform !== 'reddit' && v.followers > 0
export const outlierScore = (v: Video) =>
  !hasScore(v) ? 0 : byFollowers(v) ? v.views / v.followers : v.views / Math.max(v.medianViews ?? 0, 1)
// What the score was divided by: the followers, or the usual views when followers are unknown.
export const scoreBase = (v: Video) => (byFollowers(v) ? v.followers : (v.medianViews ?? 0))
// Secondary: views over the account's usual views, when known (shown in the breakdown next to the main score).
export const usualMultiple = (v: Video) => ((v.medianViews ?? 0) > 0 ? v.views / (v.medianViews as number) : null)
// Reddit shows no views, so its posts are compared by upvotes (stored in `views`).
export const viewsWord = (v: Video) => (v.platform === 'reddit' ? t('home.metrics.upvotes') : t('home.metrics.views'))
// Live Instagram results have neither the account's usual views nor its followers, and some accounts report 0
// followers: there is nothing to compare against, so show views only, no × score.
export const hasScore = (v: Video) => (v.medianViews ?? 0) > 0 || (v.platform !== 'reddit' && v.followers > 0)
// Average score over the videos that have one (0 when none do).
export const meanScore = (vids: Video[]) => {
  const scored = vids.filter(hasScore)
  return scored.length ? scored.reduce((s, v) => s + outlierScore(v), 0) / scored.length : 0
}
// Plain-English label for a score, so people don't have to read the number.
export type Tier = 'breakout' | 'strong' | 'normal'
export const tierOf = (score: number): Tier => (score >= 100 ? 'breakout' : score >= 10 ? 'strong' : 'normal')
// Getters, so the label follows the language on show.
export const tierName: Record<Tier, string> = {
  get breakout() {
    return t('home.metrics.tier.breakout')
  },
  get strong() {
    return t('home.metrics.tier.strong')
  },
  get normal() {
    return t('home.metrics.tier.normal')
  },
}

// The score in words, e.g. "77 times more views than followers".
export function scoreLine(v: Video): string {
  if (v.platform === 'reddit') {
    if (!hasScore(v)) return t('home.metrics.score.redditNone', { views: compact(v.views) })
    const score = outlierScore(v)
    if (score < 1.5) return t('home.metrics.score.redditAbout')
    return t('home.metrics.score.redditTimes', { n: score >= 10 ? Math.round(score).toLocaleString() : score.toFixed(1).replace(/\.0$/, '') })
  }
  if (!hasScore(v)) return t('home.metrics.score.noFollowers', { views: compact(v.views) })
  const score = outlierScore(v)
  const followers = byFollowers(v)
  if (score < 1.5) return followers ? t('home.metrics.score.aboutFollowers') : t('home.metrics.score.aboutUsual')
  const n = score >= 10 ? Math.round(score).toLocaleString() : score.toFixed(1).replace(/\.0$/, '')
  return followers ? t('home.metrics.score.moreThanFollowers', { n }) : t('home.metrics.score.timesUsual', { n })
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

export const ago = (days: number) => (days <= 1 ? t('home.metrics.today') : t('home.metrics.daysAgo', { n: days }))
// Short form for tight spaces: 5d, 3w, 4mo, 2y.
export const agoShort = (days: number) =>
  days < 1
    ? t('home.metrics.today')
    : days < 14
      ? t('home.metrics.short.days', { n: days })
      : days < 60
        ? t('home.metrics.short.weeks', { n: Math.round(days / 7) })
        : days < 730
          ? t('home.metrics.short.months', { n: Math.round(days / 30) })
          : t('home.metrics.short.years', { n: Math.round(days / 365) })

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

export function stageText(trend: FormatTrend): string {
  if (trend.stage === 'early') return t('home.metrics.stage.early', { n: trend.accounts })
  if (trend.stage === 'rising') return t('home.metrics.stage.rising', { n: trend.accounts })
  if (trend.stage === 'everywhere') return t('home.metrics.stage.everywhere', { ago: agoShort(trend.newestDays) })
  return t('home.metrics.stage.oneOff')
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
  return names.length > 1
    ? t('home.list.last', { list: names.slice(0, -1).join(t('home.list.sep')), last: names[names.length - 1] })
    : (names[0] ?? '')
}

export function clientFit(format: Format, client: Client) {
  if (!format.needsKnown && format.needs.length === 0) return { ok: true, text: t('home.metrics.fit.unknown', { name: client.name }) }
  const blockers = format.needs.filter((n) => client.cannot.includes(n))
  if (blockers.length) return { ok: false, text: t('home.metrics.fit.hard', { name: client.name, needs: blockers.join(t('home.list.and')).toLowerCase() }) }
  const needs = format.needs.length ? format.needs.map(needLabel).join(t('home.list.and')).toLowerCase() : t('home.metrics.fit.nothing')
  const effort = { easy: t('home.metrics.fit.easy'), medium: t('home.metrics.fit.medium'), hard: t('home.metrics.fit.hardEffort') }[format.effort]
  return { ok: true, text: t('home.metrics.fit.ok', { effort, name: client.name, needs }) }
}

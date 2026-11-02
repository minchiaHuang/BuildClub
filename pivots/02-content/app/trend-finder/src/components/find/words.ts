import type { Platform, Video } from '../../types'
import type { FormatTrend } from '../../lib/metrics'
import { byFollowers, compact, outlierScore, platformName } from '../../lib/metrics'
import { t, tp } from '../../lib/i18n'

// Plain-English sentences for the Find ideas pages. No tags or badges: every number says what it is,
// so an agency owner who has never seen the app can read it straight away.

// "62" for big scores, "3.4" for small ones.
export const timesNumber = (n: number) => (n >= 10 ? Math.round(n).toLocaleString() : n.toFixed(1).replace(/\.0$/, ''))

// How far a video beat the account's usual views (or its follower count when we don't know the usual).
// "62 times more views than this account usually gets".
export function beatUsual(v: Video): string {
  const score = outlierScore(v)
  const followers = byFollowers(v)
  if (score < 1.5) return followers ? t('find.beat.followersAbout') : t('find.beat.usualAbout')
  return followers
    ? t('find.beat.followersTimes', { x: timesNumber(score) })
    : t('find.beat.usualTimes', { x: timesNumber(score) })
}

// The same idea for a group of videos (an average score), e.g. for a sound many accounts used.
export function beatUsualAverage(score: number, byFollowers: boolean): string {
  if (score < 1.5) return byFollowers ? t('find.beatAvg.followersAbout') : t('find.beatAvg.usualAbout')
  return byFollowers ? t('find.beatAvg.followersTimes', { x: timesNumber(score) }) : t('find.beatAvg.usualTimes', { x: timesNumber(score) })
}

// "today", "yesterday", "5 days", "3 weeks", "4 months": the span without "ago".
export function daysSpan(days: number): string {
  if (days <= 1) return days < 1 ? t('find.time.today') : t('find.time.yesterday')
  if (days < 14) return t('find.time.nDays', { n: days })
  if (days < 60) return t('find.time.nWeeks', { n: Math.round(days / 7) })
  if (days < 730) return t('find.time.nMonths', { n: Math.round(days / 30) })
  return t('find.time.nYears', { n: Math.round(days / 365) })
}

// "today", "5 days ago", "3 weeks ago", "4 months ago".
export function daysAgoWords(days: number): string {
  return days <= 1 ? daysSpan(days) : t('find.time.ago', { span: daysSpan(days) })
}

// "today", "5 days ago": days only, never weeks.
export function agoDays(days: number): string {
  return days <= 1 ? t('find.time.today') : t('find.time.ago', { span: t('find.time.nDays', { n: days }) })
}

// "views" ("upvotes" on Reddit).
export const viewsLabel = (v: Video) => (v.platform === 'reddit' ? t('find.upvotes') : t('find.views'))

// "TikTok and Instagram" (the metrics.ts platformList in the active language).
export function platformsText(platforms: Platform[]): string {
  const names = platforms.map((p) => platformName[p])
  return names.length > 1
    ? t('find.platformList.and', { list: names.slice(0, -1).join(t('find.platformList.sep')), last: names[names.length - 1] })
    : (names[0] ?? '')
}

// Is the idea catching on? One sentence, lead-in first. Replaces the Early / Rising / Peaked / One-off pills.
export function spreadSentence(trend: FormatTrend): string {
  if (trend.stage === 'early') return t('find.spread.early', { accounts: trend.accounts })
  if (trend.stage === 'rising') return t('find.spread.rising', { accounts: trend.accounts })
  if (trend.stage === 'everywhere') return t('find.spread.everywhere', { accounts: trend.accounts, span: daysSpan(trend.newestDays) })
  return tp('find.spread.oneOff', trend.accounts)
}

// One-line verdict for a video someone pasted ("Find more like this").
export function spreadVerdict(trend: FormatTrend): string {
  return t(({ early: 'find.verdict.early', rising: 'find.verdict.rising', everywhere: 'find.verdict.everywhere', 'one-off': 'find.verdict.oneOff' } as const)[trend.stage])
}

// "1.2M views · 12k followers"
export const viewsAndFollowers = (v: Video) => t('find.viewsAndFollowers', { views: compact(v.views), followers: compact(v.followers) })

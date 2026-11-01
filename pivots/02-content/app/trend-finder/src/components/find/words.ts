import type { Video } from '../../types'
import type { FormatTrend } from '../../lib/metrics'
import { compact, outlierScore } from '../../lib/metrics'

// Plain-English sentences for the Find ideas pages. No tags or badges: every number says what it is,
// so an agency owner who has never seen the app can read it straight away.

// "62" for big scores, "3.4" for small ones.
export const timesNumber = (n: number) => (n >= 10 ? Math.round(n).toLocaleString() : n.toFixed(1).replace(/\.0$/, ''))

// How far a video beat the account's usual views (or its follower count when we don't know the usual).
// "62 times more views than this account usually gets".
export function beatUsual(v: Video): string {
  const score = outlierScore(v)
  const byFollowers = v.medianViews === null
  if (score < 1.5) return byFollowers ? 'About as many views as the account has followers' : 'About the views this account usually gets'
  return byFollowers
    ? `${timesNumber(score)} times more views than the account has followers`
    : `${timesNumber(score)} times more views than this account usually gets`
}

// The same idea for a group of videos (an average score), e.g. for a sound many accounts used.
export function beatUsualAverage(score: number, byFollowers: boolean): string {
  if (score < 1.5) return byFollowers ? 'about as many views as followers' : 'about their usual views'
  return byFollowers ? `${timesNumber(score)} times more views than followers` : `${timesNumber(score)} times their usual views`
}

// "today", "5 days ago", "3 weeks ago", "4 months ago".
export function daysAgoWords(days: number): string {
  if (days <= 1) return days < 1 ? 'today' : 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  if (days < 730) return `${Math.round(days / 30)} months ago`
  return `${Math.round(days / 365)} years ago`
}

// Is the idea catching on? One sentence, lead-in first. Replaces the Early / Rising / Peaked / One-off pills.
export function spreadSentence(t: FormatTrend): string {
  if (t.stage === 'early') return `Just starting to spread: ${t.accounts} accounts posted this in the last 2 weeks`
  if (t.stage === 'rising') return `Spreading now: ${t.accounts} accounts have posted this, and new ones keep coming`
  if (t.stage === 'everywhere') return `Probably too late: ${t.accounts} accounts posted this, but nobody new for ${daysAgoWords(t.newestDays).replace(/ ago$/, '')}`
  return `Not proven yet: only ${t.accounts === 1 ? 'one account has' : `${t.accounts} accounts have`} posted this, so it could be luck`
}

// One-line verdict for a video someone pasted ("Find more like this").
export function spreadVerdict(t: FormatTrend): string {
  return { early: 'Worth copying now.', rising: 'Worth copying soon.', everywhere: 'Probably too late to copy.', 'one-off': 'Not proven yet.' }[t.stage]
}

// "1.2M views · 12k followers"
export const viewsAndFollowers = (v: Video) => `${compact(v.views)} views · ${compact(v.followers)} followers`

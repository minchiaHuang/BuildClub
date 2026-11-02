import type { Client, Format, IdeaStatus, SavedIdea, Video } from '../types'
import { formats as sampleFormats, videos as sampleVideos } from '../data/sample'
import type { Pulse } from './clientChips'
import { sampleFitsClient } from './clientChips'
import { clientFit, compact, formatTrend, outlierScore, stageOrder } from './metrics'
import { t, tp } from './i18n'
import { dateLocale } from './dates'
import { beatUsual, beatUsualAverage } from '../components/find/words'
import type { TrendStage } from './metrics'
import { parseQuery } from './parseQuery'

// Everything on the two Homes (one client, all clients) is worked out here from data the app already has:
// the sample formats and videos (or the live daily trend check), each client's ideas and their statuses, and
// client memory (every approval and send-back). Nothing is invented. Anything that would need data we don't
// collect yet (how posted videos did) is a placeholder card in the UI, never a number.

// ---------- Names ----------

// A plan as people say it: the kind of video it copies, plus the TikTok video it copies, so two plans of the
// same kind (e.g. two "Crispy tofu ASMR" plans) can be told apart.
export interface PlanName {
  name: string
  copies?: string
}

export function planName(idea: SavedIdea, videoById: Map<string, Video>, formatById: Map<string, Format>): PlanName {
  const video = videoById.get(idea.videoId)
  if (!video) return { name: t('home.plan.removedVideo') }
  if (video.live) return { name: video.hook, copies: video.handle }
  const f = formatById.get(video.formatId)
  return { name: f?.name ?? video.hook, copies: t('home.plan.copiesBy', { hook: video.hook, handle: video.handle }) }
}

// Lookup maps from the sample data, for screens App doesn't hand them to.
export const sampleVideoById = new Map(sampleVideos.map((v) => [v.id, v]))
export const sampleFormatById = new Map(sampleFormats.map((f) => [f.id, f]))

export const possessive = (name: string) => (/s$/i.test(name) ? t('home.possessiveS', { name }) : t('home.possessive', { name }))

// ---------- What should <client> film next? ----------

export interface FilmPick {
  key: string
  name: string
  // The TikTok video that goes on the shortlist.
  video: Video
  proof: string
  // Plain sentence about how the trend is doing, e.g. "Right now it's still growing."
  trend: string
  reason: string
}

const trendPhrase = (stage: TrendStage): string =>
  ({
    early: t('home.film.trend.early'),
    rising: t('home.film.trend.rising'),
    everywhere: t('home.film.trend.everywhere'),
    'one-off': t('home.film.trend.oneOff'),
  })[stage]

const blocked = (f: Format, c: Client) => f.needs.some((n) => c.cannot.includes(n))

const mineOf = (ideas: SavedIdea[], clientId: string) => ideas.filter((i) => i.clientId === clientId)

// Kinds of video (sample) that already have a plan for this client, at any step. These aren't recommended
// again, so a kind never shows as "film next" while it's also waiting for approval or approved.
export function plannedFormatIds(ideas: SavedIdea[], clientId: string, videoById: Map<string, Video>): Set<string> {
  return new Set(
    mineOf(ideas, clientId)
      .map((i) => videoById.get(i.videoId))
      .filter((v): v is Video => !!v && !v.live)
      .map((v) => v.formatId),
  )
}

export function filmNext(x: {
  client: Client
  live: boolean
  pulse: Pulse | undefined
  ideas: SavedIdea[]
  videoById: Map<string, Video>
}): FilmPick[] {
  const { client } = x
  const plannedVideos = new Set(mineOf(x.ideas, client.id).map((i) => i.videoId))
  const byScore = (a: Video, b: Video) => outlierScore(b) - outlierScore(a)

  if (x.live) {
    if (!x.pulse) return []
    return [...x.pulse.patterns]
      .sort((a, b) => b.accounts - a.accounts)
      // A sound or hashtag with any of its videos already planned for this client counts as planned.
      .filter((p) => !p.videoIds.some((id) => plannedVideos.has(id)))
      .map((p): FilmPick | null => {
        const vids = p.videoIds.map((id) => x.videoById.get(id)).filter((v): v is Video => !!v).sort(byScore)
        if (!vids.length) return null
        return {
          key: p.label,
          name: p.label,
          video: vids[0],
          proof: t('home.film.proofLive', { accounts: p.accounts, beat: beatUsualAverage(p.avgScore, false), views: compact(vids[0].views) }),
          trend: p.kind === 'sound' ? t('home.film.trendSound') : t('home.film.trendHashtag'),
          reason: t('home.film.reasonLive', { topic: x.pulse!.topic, name: client.name }),
        }
      })
      .filter((p): p is FilmPick => p !== null)
      .slice(0, 3)
  }

  if (!sampleFitsClient(client)) return []
  const planned = plannedFormatIds(x.ideas, client.id, x.videoById)
  const audience = parseQuery(client.audience, sampleFormats).audience
  return sampleFormats
    .filter((f) => !blocked(f, client) && !planned.has(f.id))
    .map((f) => formatTrend(f, sampleVideos))
    .sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage])
    .map((tr): FilmPick | null => {
      const vids = sampleVideos.filter((v) => v.formatId === tr.format.id).sort(byScore)
      if (!vids.length) return null
      const fit = clientFit(tr.format, client).text
      const why = audience && tr.format.audiences.includes(audience) ? t('home.film.worksFor', { audience }) : ''
      return {
        key: tr.format.id,
        name: tr.format.name,
        video: vids[0],
        proof: tp('home.film.proofSample', tr.accounts, { views: compact(vids[0].views), beat: `${beatUsual(vids[0]).charAt(0).toLowerCase()}${beatUsual(vids[0]).slice(1)}` }),
        trend: trendPhrase(tr.stage),
        reason: [why, fit].filter(Boolean).join(' '),
      }
    })
    .filter((p): p is FilmPick => p !== null)
    .slice(0, 3)
}

// ---------- Where the ideas are ----------

// A shortlisted idea has its shots planned once someone has written them (ShortlistBoard uses the same rule).
const hasShots = (i: SavedIdea) => (i.shots?.length ?? 0) > 0

export interface StepRow {
  key: string
  count: number
  text: string
  // The Plans column this row opens.
  status: IdeaStatus
}

export function ideaSteps(ideas: SavedIdea[]): StepRow[] {
  const count = (f: (i: SavedIdea) => boolean) => ideas.filter(f).length
  return [
    { key: 'no-shots', status: 'saved', count: count((i) => i.status === 'saved' && !hasShots(i)), text: t('home.steps.noShots') },
    { key: 'shots', status: 'saved', count: count((i) => i.status === 'saved' && hasShots(i)), text: t('home.steps.shots') },
    { key: 'waiting', status: 'waiting', count: count((i) => i.status === 'waiting'), text: t('home.steps.waiting') },
    { key: 'approved', status: 'approved', count: count((i) => i.status === 'approved'), text: t('home.steps.approved') },
    { key: 'rejected', status: 'rejected', count: count((i) => i.status === 'rejected'), text: t('home.steps.rejected') },
  ]
}

// ---------- Approvals so far ----------

export interface SentBackReason {
  key: string
  ideaId: string
  reason: string
  at: number
}

export interface DecisionStats {
  // Every decision in client memory (one plan can be decided more than once).
  decided: number
  approved: number
  withChanges: number
  sentBack: number
  // Average time from "sent for approval" to the decision, over the plans that have both times.
  avgDecideMs: number | null
  timed: number
  reasons: SentBackReason[]
}

export function decisionStats(clients: Client[], ideas: SavedIdea[]): DecisionStats {
  const events = clients.flatMap((c) => c.memory ?? [])
  const kind = (k: string) => events.filter((e) => e.kind === k).length
  const withChanges = kind('approved-with-changes')
  const ids = new Set(clients.map((c) => c.id))
  const gaps = ideas
    .filter((i) => ids.has(i.clientId) && i.sentAt)
    .map((i) => {
      const last = events.filter((e) => e.ideaId === i.id && e.at >= i.sentAt!).sort((a, b) => a.at - b.at)[0]
      const decidedAt = last?.at ?? i.approvedAt
      return decidedAt && decidedAt >= i.sentAt! ? decidedAt - i.sentAt! : null
    })
    .filter((g): g is number => g !== null)
  return {
    decided: events.length,
    approved: kind('approved') + withChanges,
    withChanges,
    sentBack: kind('sent-back'),
    avgDecideMs: gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null,
    timed: gaps.length,
    reasons: events
      .filter((e) => e.kind === 'sent-back')
      .sort((a, b) => b.at - a.at)
      .map((e) => ({ key: `${e.ideaId}-${e.at}`, ideaId: e.ideaId, reason: e.reason?.trim() || t('home.decisions.noReason'), at: e.at })),
  }
}

// "2 days", "5 hours", "under an hour".
export function duration(ms: number): string {
  const h = ms / 3_600_000
  if (h < 1) return t('home.duration.underHour')
  if (h < 24) return tp('home.count.hour', Math.round(h))
  return tp('home.count.day', Math.round(h / 24))
}

// ---------- What gets approved most ----------

export interface KindRow {
  key: string
  name: string
  count: number
  // Clients it was approved for (All clients Home).
  clients: string[]
}

// Approved plans grouped by the kind of video they copy, most first. Live plans copy one TikTok video each,
// so they group by that video.
export function approvedMost(
  ideas: SavedIdea[],
  clients: Client[],
  videoById: Map<string, Video>,
  formatById: Map<string, Format>,
): KindRow[] {
  const rows = new Map<string, KindRow>()
  for (const i of ideas.filter((x) => x.status === 'approved')) {
    const v = videoById.get(i.videoId)
    if (!v) continue
    const key = v.live ? v.id : v.formatId
    const name = v.live ? v.hook : (formatById.get(v.formatId)?.name ?? v.hook)
    const row = rows.get(key) ?? { key, name, count: 0, clients: [] }
    row.count += 1
    const client = clients.find((c) => c.id === i.clientId)?.name
    if (client && !row.clients.includes(client)) row.clients.push(client)
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// ---------- Dates ----------

export function monthLeft(now = new Date()): { days: number; month: string } {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return { days: last - now.getDate(), month: now.toLocaleDateString(dateLocale(), { month: 'long' }) }
}

export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })

export function dueText(iso: string, now = Date.now()): string {
  const d = Math.round((new Date(`${iso}T00:00`).getTime() - new Date(new Date(now).toDateString()).getTime()) / 86_400_000)
  if (d < 0) return t('home.due.was', { date: shortDate(iso) })
  if (d === 0) return t('home.due.today')
  if (d === 1) return t('home.due.tomorrow')
  return t('home.due.on', { date: shortDate(iso) })
}

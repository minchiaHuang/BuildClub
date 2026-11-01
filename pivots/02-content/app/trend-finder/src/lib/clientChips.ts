import type { Client, Format, SavedIdea, Video } from '../types'
import type { Pattern } from './live'
import { formatTrend, outlierScore, stageOrder, tierOf } from './metrics'
import { parseQuery } from './parseQuery'
import { beatUsualAverage, spreadSentence, timesNumber } from '../components/find/words'

// One suggestion chip on the search page. `value` is what gets searched when it's clicked.
export interface ClientChip {
  label: string
  value: string
  // Why this search is worth trying, as a plain sentence shown under it
  // ("6 accounts used this sound lately").
  hint?: string
  hot?: boolean
}

export interface ChipGroup {
  id: 'trending' | 'starter' | 'audience' | 'saved' | 'ideas'
  title: string
  chips: ClientChip[]
}

// The daily live trend check for one client: what TikTok returned for the client's main topic.
export interface Pulse {
  topic: string
  fetchedAt: number
  patterns: Pattern[]
  breakouts: { hook: string; score: number }[]
}

export const clientTopic = (c: Client) => (c.topics?.[0] ?? c.examples[0] ?? c.niche).trim()

// The sample data only covers tofu, so sample trends are only shown for a tofu client.
export const sampleFitsClient = (c: Client) =>
  /tofu/i.test(`${c.niche} ${(c.topics ?? []).join(' ')} ${c.examples.join(' ')}`)

export function pulseFrom(topic: string, videos: Video[], patterns: Pattern[]): Pulse {
  const breakouts = videos
    .filter((v) => v.daysAgo <= 30 && tierOf(outlierScore(v)) === 'breakout' && v.hook !== 'TikTok video')
    .sort((a, b) => outlierScore(b) - outlierScore(a))
    .slice(0, 2)
    .map((v) => ({ hook: v.hook, score: Math.round(outlierScore(v)) }))
  return { topic, fetchedAt: Date.now(), patterns, breakouts }
}

const searchable = (label: string) => label.replace(/^#/, '').replace(/ · .*$/, '').trim()

interface Input {
  client: Client
  live: boolean
  pulse: Pulse | undefined
  ideas: SavedIdea[]
  videoById: Map<string, Video>
  formatById: Map<string, Format>
  sampleFormats: Format[]
  sampleVideos: Video[]
}

export function buildChipGroups(x: Input): ChipGroup[] {
  const { client } = x
  const groups: ChipGroup[] = []
  const sampleFits = sampleFitsClient(client)

  // Formats and videos already sent or approved for this client drop out of "Trending now",
  // so the chips always point at something new.
  const sentVideos = x.ideas
    .filter((i) => i.clientId === client.id && (i.status === 'waiting' || i.status === 'approved'))
    .map((i) => x.videoById.get(i.videoId))
    .filter((v): v is Video => Boolean(v))
  const sentFormats = new Set(sentVideos.map((v) => v.formatId))
  const sentHooks = new Set(sentVideos.map((v) => v.hook))

  // 1. Trending now
  if (x.live && x.pulse) {
    const chips: ClientChip[] = [
      ...x.pulse.patterns.slice(0, 4).map((p) => ({
        label: p.label,
        value: searchable(p.label),
        hint: `${p.accounts} accounts used this ${p.kind} lately. Their videos got ${beatUsualAverage(p.avgScore, true)}`,
        hot: p.accounts >= 3,
      })),
      ...x.pulse.breakouts.filter((b) => !sentHooks.has(b.hook)).map((b) => ({
        label: `"${b.hook}"`,
        value: b.hook,
        hint: `One video got ${timesNumber(b.score)} times more views than the account has followers`,
        hot: true,
      })),
    ]
    if (chips.length) groups.push({ id: 'trending', title: `Catching on around "${x.pulse.topic}"`, chips })
  } else if (!x.live && sampleFits) {
    const unused = x.sampleFormats
      .map((f) => formatTrend(f, x.sampleVideos))
      .filter((t) => !t.format.needs.some((n) => client.cannot.includes(n)))
      .filter((t) => !sentFormats.has(t.format.id))
      // Only formats that are actually spreading count as trending. If none are left, the search box
      // shows the client's starter searches instead.
      .filter((t) => t.stage === 'early' || t.stage === 'rising')
      .sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage])
    const chips = unused.slice(0, 5).map((t) => ({
      label: t.format.short,
      value: t.format.short,
      hint: spreadSentence(t),
      hot: t.stage === 'early',
    }))
    if (chips.length) groups.push({ id: 'trending', title: 'Catching on now', chips })
  }

  // 2. Fits the client's audience
  const audience = parseQuery(client.audience, x.sampleFormats).audience
  if (!x.live && sampleFits && audience) {
    const chips = x.sampleFormats
      .filter((f) => f.audiences.includes(audience) && !f.needs.some((n) => client.cannot.includes(n)))
      .slice(0, 3)
      .map((f) => ({ label: `${f.short} for ${audience}`, value: `${f.short} for ${audience}`, hint: `Videos like this tend to work for ${audience}` }))
    if (chips.length) groups.push({ id: 'audience', title: `Searches that fit ${client.audience.toLowerCase()}`, chips })
  } else {
    // Live (or no sample data): the client's own starter searches, framed around their audience.
    const used = new Set(groups.flatMap((g) => g.chips.map((c) => c.value.toLowerCase())))
    const chips = client.examples
      .filter((e) => !used.has(e.toLowerCase()))
      .slice(0, 4)
      .map((e) => ({ label: e, value: e, hint: `A starting search from ${client.name}'s brief` }))
    if (chips.length) groups.push({ id: 'audience', title: `Searches that fit ${client.audience.toLowerCase()}`, chips })
  }

  // 3. More like what this client already saved or approved
  const seen = new Set<string>()
  const saved = x.ideas
    .filter((i) => i.clientId === client.id && i.status !== 'rejected')
    .sort((a, b) => (a.status === 'approved' ? -1 : 0) - (b.status === 'approved' ? -1 : 0))
    .map((i) => {
      const v = x.videoById.get(i.videoId)
      const f = v && x.formatById.get(v.formatId)
      if (!v || !f) return null
      const value = v.live ? v.hook : f.short
      if (seen.has(value)) return null
      seen.add(value)
      const hint =
        i.status === 'approved'
          ? 'You approved a plan like this'
          : i.status === 'waiting'
            ? 'A plan like this is waiting for your approval'
            : `You saved a video like this for ${client.name}`
      return { label: `More like "${v.live ? v.hook : f.short}"`, value, hint }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .slice(0, 3)
  if (saved.length) groups.push({ id: 'saved', title: 'More like your saved ideas', chips: saved })

  return groups
}

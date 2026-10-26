import type { Format, Platform, Video } from '../types'

// What we understood from the search box. Shown back to the user as chips they can remove.
export interface Interpretation {
  text: string
  keywords: string[]
  topics: { formatId: string; word: string }[]
  audience: string | null
  days: number | null
  platforms: Platform[] | null
  maxLength: number | null
  isQuestion: boolean
  // Set when the search is "find more like this video" (a pasted link or a screenshot).
  source: MediaSource | null
}

export interface MediaSource {
  kind: 'link' | 'image'
  label: string
  platform: Platform | null
  previewUrl?: string
}

const urlPattern = /https?:\/\/\S+/i

// MOCK: a real version would fetch the video (or read the screenshot) and have AI describe it.
// Here we guess the format from words in the link or file name, and fall back to the crispy ASMR format
// so the demo always lands on a strong example.
export function interpretMedia(
  text: string,
  image: { name: string; url: string } | null,
  formats: Format[],
): Interpretation | null {
  const url = text.match(urlPattern)?.[0]
  if (!url && !image) return null

  // A screenshot wins over a link if both are present.
  const haystack = (image ? image.name : url ?? '').toLowerCase().replace(/[-_/.]/g, ' ')
  const guess =
    formats.find((f) => f.tags.some((t) => haystack.includes(t))) ?? formats.find((f) => f.id === 'crispy-asmr') ?? formats[0]

  const platform: Platform | null = url && !image
    ? /tiktok\.com/i.test(url)
      ? 'tiktok'
      : /instagram\.com/i.test(url)
        ? 'instagram'
        : null
    : null

  const source: MediaSource = image
    ? { kind: 'image', label: image.name, platform: null, previewUrl: image.url }
    : { kind: 'link', label: platform ? `${platform === 'tiktok' ? 'TikTok' : 'Instagram'} link` : 'video link', platform }

  return {
    text: image ? image.name : url!,
    keywords: [],
    topics: [{ formatId: guess.id, word: 'this video' }],
    audience: null,
    days: null,
    platforms: null,
    maxLength: null,
    isQuestion: false,
    source,
  }
}

// Rule-based for now. A real AI call can return the same shape later without changing the screens.

const timeRules: [RegExp, number][] = [
  [/\b(today|this week|past week|last week|7 days|seven days|right now)\b/, 7],
  [/\b(this month|past month|last month|30 days|lately|recently)\b/, 30],
  [/\b(3 months|three months|90 days|this quarter|last quarter)\b/, 90],
]

const lengthRules: [RegExp, number][] = [
  [/\b(under|less than|below) (15|fifteen) ?(s|sec|secs|seconds)?\b/, 15],
  [/\b(under|less than|below) (30|thirty) ?(s|sec|secs|seconds)?\b/, 30],
  [/\b(under|less than|below) (a minute|one minute|1 minute|60 ?(s|sec|secs|seconds)?)\b/, 60],
  [/\bshort\b/, 15],
]

const platformRules: [RegExp, Platform][] = [
  [/\b(tiktok|tik tok|tiktoks)\b/, 'tiktok'],
  [/\b(instagram|insta|ig|reels?)\b/, 'instagram'],
]

const audienceRules: [RegExp, string][] = [
  [/\b(busy )?(mums?|moms?|mothers|parents)\b/, 'busy mums'],
  [/\b(uni |university |college )?students?\b|\buni\b/, 'students'],
  [/\b(kids|children|families|family)\b/, 'families'],
  [/\b(young )?professionals?\b|\boffice workers?\b|\bbusy people\b/, 'young professionals'],
  [/\b(gym|protein|fitness|healthy|health)\b/, 'health-conscious eaters'],
]

const stopwords = new Set(
  `what why how which when who whom is are was were does do did should can could would will the a an for to of in on
  with and or but that this these those my our your their me us i it its about video videos content post posts trend trends
  trending viral working work works worked blowing up right now best top ideas idea people get getting make making recipe
  recipes like be doing going using use there any some more most so than at from as by just really still good great new
  popular performing perform well find show give me tell vs versus`.split(/\s+/),
)

const questionStart = /^(why|what|how|which|when|who|is|are|does|do|should|can|could|will)\b/

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function parseQuery(text: string, formats: Format[]): Interpretation {
  let s = ` ${text.toLowerCase().replace(/[“”"!,.;:()]/g, ' ').replace(/\s+/g, ' ')} `
  const isQuestion = text.trim().endsWith('?') || questionStart.test(text.trim().toLowerCase())
  s = s.replace(/\?/g, ' ')

  const take = (re: RegExp) => {
    const m = s.match(re)
    if (m) s = s.replace(re, ' ')
    return m
  }

  let days: number | null = null
  for (const [re, d] of timeRules) if (days === null && take(re)) days = d

  let maxLength: number | null = null
  for (const [re, len] of lengthRules) if (maxLength === null && take(re)) maxLength = len

  const platforms: Platform[] = []
  for (const [re, p] of platformRules) if (take(new RegExp(re.source, 'g'))) platforms.push(p)

  let audience: string | null = null
  for (const [re, a] of audienceRules) if (audience === null && take(re)) audience = a

  // Longest tags first, so "taste test" wins over "test".
  const tagList = formats
    .flatMap((f) => f.tags.map((tag) => ({ formatId: f.id, tag })))
    .sort((a, b) => b.tag.length - a.tag.length)
  const topics: Interpretation['topics'] = []
  for (const { formatId, tag } of tagList) {
    const re = new RegExp(`\\b${escape(tag)}(s|es)?\\b`)
    const m = s.match(re)
    if (!m) continue
    s = s.replace(re, ' ')
    if (!topics.some((t) => t.formatId === formatId)) topics.push({ formatId, word: m[0].trim() })
  }

  const keywords = [
    ...new Set(
      s
        .split(' ')
        .map((w) => w.replace(/[^a-z0-9-]/g, ''))
        .filter((w) => w.length > 1 && !stopwords.has(w)),
    ),
  ]

  return {
    text,
    keywords,
    topics,
    audience,
    days,
    platforms: platforms.length ? platforms : null,
    maxLength,
    isQuestion,
    source: null,
  }
}

export function matchesKeyword(v: Video, format: Format | undefined, keyword: string): boolean {
  const k = keyword.replace(/s$/, '')
  return (
    v.keywords.some((w) => w === keyword || w === k) ||
    v.hook.toLowerCase().includes(k) ||
    Boolean(format && (format.name.toLowerCase().includes(k) || format.tags.some((t) => t === k)))
  )
}

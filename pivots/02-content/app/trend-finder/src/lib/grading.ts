import { t, tp } from './i18n.ts'

// Colour grade and burned-in subtitles for the cut. Mirrors backend/grading.py and backend/subtitles.py.

export interface GradePreset {
  id: string
  label: string
}

export type SubSize = 'S' | 'M' | 'L'
export type SubPosition = 'bottom' | 'middle'

export interface SubtitleStyle {
  size: SubSize
  position: SubPosition
  box: boolean
}

// What "Make the video" was asked to do besides joining the takes.
export interface CutOptions {
  grade: string
  burnSubtitles: boolean
  subtitleStyle: SubtitleStyle
}

export interface Cue {
  id: number
  start: number
  end: number
  text: string
}

export const DEFAULT_STYLE: SubtitleStyle = { size: 'M', position: 'bottom', box: true }
export const DEFAULT_OPTIONS: CutOptions = { grade: 'none', burnSubtitles: false, subtitleStyle: DEFAULT_STYLE }
export const MAX_CUE_TEXT = 200

// True when nothing was chosen, so the request can stay exactly as it was before grades and subtitles.
export function isDefaultOptions(o: CutOptions): boolean {
  return !optionsDiffer(o, DEFAULT_OPTIONS)
}

// Whether a video made with `madeWith` would come out different with `now`. The subtitle style only matters
// while subtitles are burned in. Unknown (null) is "not different": nothing is claimed.
export function optionsDiffer(madeWith: CutOptions | null, now: CutOptions): boolean {
  if (!madeWith) return false
  if (madeWith.grade !== now.grade || madeWith.burnSubtitles !== now.burnSubtitles) return true
  if (!now.burnSubtitles) return false
  const a = madeWith.subtitleStyle
  const b = now.subtitleStyle
  return a.size !== b.size || a.position !== b.position || a.box !== b.box
}

// 3.24 -> "0:03.2", 75.96 -> "1:16.0" (tenths of a second, rounded; negative or non-finite counts as 0).
export function formatCueTime(sec: number): string {
  const tenths = Number.isFinite(sec) && sec > 0 ? Math.round(sec * 10) : 0
  const whole = Math.floor(tenths / 10)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${tenths % 10}`
}

// The cue showing at time t (start inclusive, end exclusive), or null.
export function cueAt(cues: Cue[], t: number): Cue | null {
  return cues.find((c) => t >= c.start && t < c.end) ?? null
}

// Whether the edited texts differ from the saved ones.
export function cuesChanged(saved: Cue[], drafts: Record<number, string>): boolean {
  return saved.some((c) => drafts[c.id] !== undefined && drafts[c.id] !== c.text)
}

const base = (ideaId: string) => `/api/ideas/${encodeURIComponent(ideaId)}/cut`

export const srtUrl = (ideaId: string) => `${base(ideaId)}/subtitles.srt`
export const previewUrl = (ideaId: string, preset: string, t = 0.5) =>
  `/api/ideas/${encodeURIComponent(ideaId)}/cut/grade-preview?preset=${encodeURIComponent(preset)}&t=${t}`

async function body<T>(r: Response, fallback: string): Promise<T> {
  if (r.ok) return r.json()
  const b = await r.json().catch(() => null)
  throw new Error(b?.error ?? fallback)
}

export async function getGrades(): Promise<GradePreset[]> {
  const res = await body<{ presets: GradePreset[] }>(await fetch('/api/cut/grades'), t('cut.err.grades'))
  return res.presets
}

// The cues of the last video; null when none were made yet (the server answers 404).
export async function getCues(ideaId: string): Promise<{ cues: Cue[]; edited: boolean } | null> {
  const r = await fetch(`${base(ideaId)}/subtitles`)
  if (r.status === 404) return null
  return body(r, t('cut.err.cuesLoad'))
}

export async function putCues(ideaId: string, cues: { id: number; text: string }[]): Promise<{ cues: Cue[]; edited: boolean }> {
  const r = await fetch(`${base(ideaId)}/subtitles`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cues: cues.map((c) => ({ id: c.id, text: c.text })) }),
  })
  return body(r, t('cut.err.cuesSave'))
}

// ---- platform safe zones (preview only, never burned in) -----------------------------------------------------
// Areas of a 1080x1920 frame that a platform's own buttons and text cover, in pixels. APPROXIMATE: platforms
// publish no single exact figure and third-party guides disagree (TikTok top 130-220, bottom 320-480, right 120-140;
// Reels top 108, bottom 320, right 120). Values here follow the organic-Reels figures cited by several guides and a
// middle TikTok figure. Sources, accessed 2026-11-02: https://www.lilachbullock.com/instagram-reels-safe-zone/,
// https://www.revid.ai/tiktok-safe-zone, https://vidova.ai/blog/instagram-reels-tiktok-youtube-shorts-safe-zones,
// https://www.markstudios.com/tools/safe-zone-checker. Check the platform's own file before relying on them.
export type ZonePlatform = 'tiktok' | 'reels'
export const FRAME_H = 1920
export const FRAME_W = 1080
export const BURN_BOTTOM_EDGE = 1460 // bottom of the text block for "bottom" (backend/subtitles.py BOTTOM_EDGE)

export interface SafeZone {
  label: string
  top: number
  bottom: number
  right: number
}

export const SAFE_ZONES: Record<ZonePlatform, SafeZone> = {
  tiktok: { label: 'TikTok', top: 130, bottom: 480, right: 140 },
  reels: { label: 'Reels', top: 108, bottom: 320, right: 120 },
}

// A short sentence when the chosen subtitle position falls inside an area the platform covers; null when it doesn't.
export function zoneWarning(platform: ZonePlatform, style: SubtitleStyle): string | null {
  const z = SAFE_ZONES[platform]
  if (style.position === 'bottom' && BURN_BOTTOM_EDGE > FRAME_H - z.bottom) {
    return t('cut.zone.warning', { platform: z.label })
  }
  return null
}

// ---- what the auto-cut did ------------------------------------------------------------------------------------
export interface Trim {
  shot: number
  kind: 'pause' | 'filler'
  start: number
  end: number
}
export interface AutoCut {
  originalSec: number | null
  trims: Trim[]
}

const secs = (n: number) => t('cut.secs', { v: (Math.round(n * 10) / 10).toFixed(1) })

// "2 pauses (1.4 s), 1 filler (0.4 s)" for a list of trims; "" when empty.
export function trimPhrase(trims: Trim[]): string {
  const part = (kind: Trim['kind'], base: 'cut.trim.pause' | 'cut.trim.filler') => {
    const found = trims.filter((x) => x.kind === kind)
    return found.length ? t('cut.trim.withTotal', { what: tp(base, found.length), total: secs(found.reduce((a, x) => a + (x.end - x.start), 0)) }) : ''
  }
  return [part('pause', 'cut.trim.pause'), part('filler', 'cut.trim.filler')].filter(Boolean).join(t('cut.trim.sep'))
}

// "Removed 4 pauses (3.2 s), 2 fillers (0.6 s) · Final length 18.4 s, was 24.1 s"
export function autoCutLine(a: AutoCut, finalSec: number): string {
  const removed = trimPhrase(a.trims)
  const first = removed ? t('cut.autocut.removed', { what: removed }) : t('cut.autocut.nothing')
  const length = a.originalSec ? t('cut.autocut.finalWas', { final: secs(finalSec), was: secs(a.originalSec) }) : t('cut.autocut.final', { final: secs(finalSec) })
  return `${first} · ${length}`
}

// Per shot (1-based) lines for the details list; shots with nothing removed are left out.
export function autoCutByShot(trims: Trim[]): { shot: number; text: string }[] {
  const shots = [...new Set(trims.map((t) => t.shot))].sort((a, b) => a - b)
  return shots.map((shot) => ({ shot: shot + 1, text: trimPhrase(trims.filter((t) => t.shot === shot)) }))
}

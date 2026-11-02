import type { Shot } from '../types'
import { t } from './i18n.ts'

export type Purpose = 'hook' | 'body' | 'cta'

// Same rule as backend/storyboard.py: the first shot hooks, the last one asks, the rest show.
export function purposeFor(index: number, total: number): Purpose {
  return index === 0 ? 'hook' : index === total - 1 ? 'cta' : 'body'
}

export const purposeLabel = (p: Purpose): string => t(`plan.sb.purpose.${p}`)

// ---- merging what the generate routes return into the plan's shots -------------------------------
// The routes never save anything. The page merges their answer into the shots it holds now (which may have
// changed while the request ran) and saves the result through the normal ideas save.

export interface WrittenShot {
  line?: string
  options?: string[]
  purpose?: Purpose
}

// The whole-plan script. Edited lines stay as they are unless `force`. Everything else on a shot is kept.
export function mergeScript(shots: Shot[], written: WrittenShot[], force = false): Shot[] {
  return shots.map((s, i) => {
    const w = written[i]
    if (!w || (s.edited && !force)) return s
    return { ...s, line: w.line ?? s.line, options: w.options ?? s.options, purpose: w.purpose ?? s.purpose, edited: false }
  })
}

// One shot's new line. Its own edited flag is cleared because the user asked for this line.
export function mergeShotScript(shots: Shot[], index: number, w: WrittenShot): Shot[] {
  return shots.map((s, i) =>
    i === index ? { ...s, line: w.line ?? s.line, options: w.options ?? s.options, purpose: w.purpose ?? s.purpose, edited: false } : s,
  )
}

// A new frame replaces the old one, and its colours are read again once it loads.
export function mergeFrame(shots: Shot[], index: number, frameImage: string): Shot[] {
  return shots.map((s, i) => (i === index ? { ...s, frameImage, palette: undefined } : s))
}

// Typing in the line, or picking one of the options, is the user's own choice: protect it from rewrites.
export function editLine(shots: Shot[], index: number, line: string): Shot[] {
  return shots.map((s, i) => (i === index ? { ...s, line, edited: true } : s))
}

export function setPalette(shots: Shot[], index: number, palette: string[]): Shot[] {
  return shots.map((s, i) => (i === index ? { ...s, palette } : s))
}

// ---- palette from pixels -------------------------------------------------------------------------

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
export const toHex = (r: number, g: number, b: number): string => `#${hex2(r)}${hex2(g)}${hex2(b)}`

// The main colours of an image from its RGBA bytes (canvas getImageData().data). Pixels are grouped in
// 16 levels per channel, the biggest groups win, and a group too close to a colour already picked is skipped
// so the five swatches look different. Mostly transparent pixels are ignored.
export function extractPalette(rgba: ArrayLike<number>, count = 5, minDistance = 60): string[] {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue
    const r = rgba[i]
    const g = rgba[i + 1]
    const b = rgba[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bin = bins.get(key)
    if (bin) {
      bin.n += 1
      bin.r += r
      bin.g += g
      bin.b += b
    } else bins.set(key, { n: 1, r, g, b })
  }
  const ranked = [...bins.entries()].sort((a, b) => b[1].n - a[1].n || a[0] - b[0])
  const picked: [number, number, number][] = []
  for (const [, bin] of ranked) {
    const c: [number, number, number] = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n]
    if (picked.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < minDistance)) continue
    picked.push(c)
    if (picked.length === count) break
  }
  return picked.map((c) => toHex(c[0], c[1], c[2]))
}

// Reads the palette from a loaded <img> through a small canvas. Needs a same-origin image (the frame
// route is); a cross-origin one taints the canvas, and then there is simply no palette.
export function paletteFromImage(img: HTMLImageElement, count = 5): string[] {
  try {
    const w = 120
    const h = Math.max(1, Math.round((w * (img.naturalHeight || 640)) / (img.naturalWidth || 360)))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return []
    ctx.drawImage(img, 0, 0, w, h)
    return extractPalette(ctx.getImageData(0, 0, w, h).data, count)
  } catch {
    return []
  }
}

// ---- the generate routes -------------------------------------------------------------------------

// The server says the line was edited and it was not told to replace it.
export class EditedLine extends Error {}

const base = (ideaId: string) => `/api/ideas/${encodeURIComponent(ideaId)}`

async function post<T>(url: string, body: unknown, fallback: string): Promise<T> {
  let r: Response
  try {
    r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error(fallback)
  }
  if (r.ok) return r.json()
  const data = await r.json().catch(() => null)
  const message = typeof data?.error === 'string' ? data.error : fallback
  if (r.status === 409 && /edited/i.test(message)) throw new EditedLine(message)
  throw new Error(message)
}

export async function writeScript(ideaId: string, force = false): Promise<{ source: string; shots: WrittenShot[] }> {
  return post(`${base(ideaId)}/script`, { force }, t('plan.sb.err.write'))
}

export async function writeShotScript(
  ideaId: string,
  index: number,
  force = false,
): Promise<WrittenShot & { source: string; index: number }> {
  return post(`${base(ideaId)}/shots/${index}/script`, { force }, t('plan.sb.err.rewrite'))
}

export async function makeFrame(
  ideaId: string,
  index: number,
  draft: { line?: string; purpose?: Purpose },
): Promise<{ index: number; frameImage: string }> {
  return post(`${base(ideaId)}/shots/${index}/frame`, draft, t('plan.sb.err.frame'))
}

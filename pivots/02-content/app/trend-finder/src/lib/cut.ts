import type { IdeaStatus } from '../types'
import type { AutoCut, CutOptions } from './grading'
import { t } from './i18n.ts'

// The cut of an approved plan: its chosen takes joined into one publishable 9:16 MP4. Mirrors backend/renders.py.
export interface CutReview {
  status: 'waiting' | 'approved' | 'rejected'
  sentAt: number
  decidedAt?: number
  // Why the approver sent it back.
  reason?: string
}

export interface CutState {
  status: 'none' | 'queued' | 'running' | 'done' | 'failed'
  progress: number
  step: string
  error?: string
  speed: number
  // The finished video was made from other takes or music than are chosen now.
  stale: boolean
  music: { name: string; size: number } | null
  // The last successful video; can be present while a new cut is queued, running or failed.
  output?: { url: string; size: number; durationSec: number }
  // Where the video stands with the approver; null when it was never sent or was replaced since.
  review: CutReview | null
  // The grade and subtitle options of the latest "Make the video" request.
  options?: CutOptions
  // What the auto-cut removed from the last video; absent for videos made before it was recorded.
  autoCut?: AutoCut
}

// Same limits and copy as backend/renders.py.
export const MAX_MUSIC_BYTES = 30 * 1024 * 1024
export const SPEEDS = [1, 1.1, 1.25]

type MusicType = 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/x-wav'

// The upload's Content-Type. Browsers leave file.type empty or report non-canonical audio types
// (audio/x-m4a, audio/mp3, audio/wave ...), so the extension decides then. Non-audio types are refused.
export function musicType(file: { name: string; type: string }): MusicType | null {
  if (file.type === 'audio/mpeg' || file.type === 'audio/mp4' || file.type === 'audio/wav' || file.type === 'audio/x-wav') return file.type
  if (file.type && !file.type.startsWith('audio/')) return null
  const ext = file.name.toLowerCase().split('.').pop()
  return ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : ext === 'wav' ? 'audio/wav' : null
}

// The reason a music file can't be uploaded, checked before sending it; null when it can.
export function checkMusic(file: { name: string; type: string; size: number }): string | null {
  if (!musicType(file)) return t('cut.music.notAudio')
  if (file.size > MAX_MUSIC_BYTES) return t('cut.music.tooBig')
  return null
}

// A cut can start when the plan is approved, every shot has a chosen take and none is being made.
export function canStartCut(a: { status: IdeaStatus; shotsDone: number; shotsTotal: number; active: boolean }): boolean {
  return a.status === 'approved' && a.shotsTotal > 0 && a.shotsDone >= a.shotsTotal && !a.active
}

// 75 -> "1:15"
export function formatDuration(sec: number): string {
  const total = Math.round(sec)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const base = (ideaId: string) => `/api/ideas/${encodeURIComponent(ideaId)}/cut`

async function send<T>(r: Response, fallback: string): Promise<T> {
  if (r.ok) return r.json()
  const body = await r.json().catch(() => null)
  throw new Error(body?.error ?? fallback)
}

export async function getCut(ideaId: string, shotCount?: number): Promise<CutState> {
  const q = shotCount === undefined ? '' : `?shots=${shotCount}`
  return send(await fetch(`${base(ideaId)}${q}`), t('cut.err.load'))
}

export async function putMusic(ideaId: string, file: File): Promise<CutState> {
  const r = await fetch(`${base(ideaId)}/music`, {
    method: 'PUT',
    body: file,
    headers: {
      'content-type': musicType(file) ?? '',
      'x-filename': encodeURIComponent(file.name),
      'x-license-confirmed': 'yes',
    },
  })
  return send(r, t('cut.err.putMusic'))
}

export async function deleteMusic(ideaId: string): Promise<CutState> {
  return send(await fetch(`${base(ideaId)}/music`, { method: 'DELETE' }), t('cut.err.deleteMusic'))
}

// `extra` (grade, burnSubtitles, subtitleStyle) is added only when something was chosen.
export async function startCut(ideaId: string, shotCount: number, speed: number, extra?: Record<string, unknown>): Promise<CutState> {
  const r = await fetch(base(ideaId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ shotCount, speed, ...extra }),
  })
  return send(r, t('cut.err.start'))
}

// Sends the finished video to the approver. Failures carry the server's reason.
export async function sendCutForReview(ideaId: string): Promise<CutState> {
  return send(await fetch(`${base(ideaId)}/review`, { method: 'POST' }), t('cut.err.sendVideo'))
}

// The status line for a sent video; the reason is shown separately. null when it was never sent.
export function reviewLine(r: CutReview | null, manager: string, day: (ms: number) => string): string | null {
  if (!r) return null
  if (r.status === 'waiting') return t('cut.review.waiting', { name: manager, day: day(r.sentAt) })
  const when = day(r.decidedAt ?? r.sentAt)
  return t(r.status === 'approved' ? 'cut.review.approved' : 'cut.review.sentBack', { name: manager, when })
}

// Resolves after ms, or early when the signal aborts.
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const done = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done)
  })
}

// Polls the cut, passing every state to onState, until it is done or failed; both resolve with that final state
// (failed does not throw; its reason is state.error). Aborting the signal stops the polling with no further
// fetches and resolves with null, so an unmounted component needs no catch. A failed request still rejects.
export async function pollCut(
  ideaId: string,
  onState: (state: CutState) => void,
  { signal, intervalMs = 2000 }: { signal?: AbortSignal; intervalMs?: number } = {},
): Promise<CutState | null> {
  while (!signal?.aborted) {
    const state = await getCut(ideaId)
    if (signal?.aborted) return null
    onState(state)
    if (state.status === 'done' || state.status === 'failed') return state
    await sleep(intervalMs, signal)
  }
  return null
}

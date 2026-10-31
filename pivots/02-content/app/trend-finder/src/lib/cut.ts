import type { IdeaStatus } from '../types'

// The cut of an approved plan: its chosen takes joined into one publishable 9:16 MP4. Mirrors backend/renders.py.
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
}

// Same limits and copy as backend/renders.py.
export const MAX_MUSIC_BYTES = 30 * 1024 * 1024
export const SPEEDS = [1, 1.1, 1.25]
const TOO_BIG = 'The music file is over the 30 MB limit.'
const NOT_AUDIO = 'Upload an .mp3, .m4a or .wav audio file.'

type MusicType = 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/x-wav'

// The upload's Content-Type. Some browsers leave file.type empty, so the extension decides then.
export function musicType(file: { name: string; type: string }): MusicType | null {
  if (file.type === 'audio/mpeg' || file.type === 'audio/mp4' || file.type === 'audio/wav' || file.type === 'audio/x-wav') return file.type
  if (file.type) return null
  const ext = file.name.toLowerCase().split('.').pop()
  return ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : ext === 'wav' ? 'audio/wav' : null
}

// The reason a music file can't be uploaded, checked before sending it; null when it can.
export function checkMusic(file: { name: string; type: string; size: number }): string | null {
  if (!musicType(file)) return NOT_AUDIO
  if (file.size > MAX_MUSIC_BYTES) return TOO_BIG
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

export async function getCut(ideaId: string): Promise<CutState> {
  return send(await fetch(base(ideaId)), "Couldn't load the cut.")
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
  return send(r, "Couldn't upload the music.")
}

export async function deleteMusic(ideaId: string): Promise<CutState> {
  return send(await fetch(`${base(ideaId)}/music`, { method: 'DELETE' }), "Couldn't remove the music.")
}

export async function startCut(ideaId: string, shotCount: number, speed: number): Promise<CutState> {
  const r = await fetch(base(ideaId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ shotCount, speed }),
  })
  return send(r, "Couldn't start the cut.")
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

import type { IdeaStatus } from '../types'
import { t } from './i18n.ts'

// One uploaded video for a shot (0-based index) of an approved plan. One take per shot is chosen.
export interface Take {
  id: string
  ideaId: string
  shot: number
  name: string
  size: number
  chosen: boolean
  createdAt: number
  url: string
}

// Same limits and copy as backend/takes.py.
export const MAX_TAKE_BYTES = 200 * 1024 * 1024

type VideoType = 'video/mp4' | 'video/quicktime'

// The upload's Content-Type. Some browsers leave file.type empty, so the extension decides then.
export function videoType(file: { name: string; type: string }): VideoType | null {
  if (file.type === 'video/mp4' || file.type === 'video/quicktime') return file.type
  if (file.type) return null
  const ext = file.name.toLowerCase().split('.').pop()
  return ext === 'mp4' ? 'video/mp4' : ext === 'mov' ? 'video/quicktime' : null
}

// The reason a file can't be uploaded, checked before sending it; null when it can.
export function checkFile(file: { name: string; type: string; size: number }): string | null {
  if (!videoType(file)) return t('plan.takes.notVideo')
  if (file.size > MAX_TAKE_BYTES) return t('plan.takes.tooBig')
  return null
}

// 1536 -> "1.5 KB", 52428800 -> "50 MB"
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let u = 0
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024
    u += 1
  }
  return `${u === 0 ? n : Number(n.toFixed(1))} ${units[u]}`
}

// Takes grouped per current shot; takes of shots since removed are left out (they stay stored).
export function takesByShot(takes: Take[], shotCount: number): Take[][] {
  const groups: Take[][] = Array.from({ length: shotCount }, () => [])
  for (const t of takes) if (t.shot >= 0 && t.shot < shotCount) groups[t.shot].push(t)
  return groups
}

// How many of the current shots have a chosen take.
export function checklistProgress(shotCount: number, takes: Take[]): { done: number; total: number } {
  const done = takesByShot(takes, shotCount).filter((g) => g.some((t) => t.chosen)).length
  return { done, total: shotCount }
}

// Takes can be added, chosen or deleted only while the plan is approved; reopened plans keep them read-only.
export const canEdit = (status: IdeaStatus): boolean => status === 'approved'

const base = (ideaId: string) => `/api/ideas/${encodeURIComponent(ideaId)}`

async function send<T>(r: Response, fallback: string): Promise<T> {
  if (r.ok) return r.json()
  const body = await r.json().catch(() => null)
  throw new Error(body?.error ?? fallback)
}

export async function listTakes(ideaId: string): Promise<Take[]> {
  return send(await fetch(`${base(ideaId)}/takes`), t('plan.takes.err.load'))
}

export async function uploadTake(ideaId: string, shot: number, file: File): Promise<Take> {
  const r = await fetch(`${base(ideaId)}/shots/${shot}/takes`, {
    method: 'POST',
    body: file,
    headers: { 'content-type': videoType(file) ?? '', 'x-filename': encodeURIComponent(file.name) },
  })
  return send(r, t('plan.takes.err.upload'))
}

export async function chooseTake(ideaId: string, takeId: string): Promise<Take[]> {
  return send(await fetch(`${base(ideaId)}/takes/${encodeURIComponent(takeId)}/choose`, { method: 'POST' }), t('plan.takes.err.choose'))
}

export async function deleteTake(ideaId: string, takeId: string): Promise<Take[]> {
  return send(await fetch(`${base(ideaId)}/takes/${encodeURIComponent(takeId)}`, { method: 'DELETE' }), t('plan.takes.err.delete'))
}

// Shared logic for TikTok's Embed Player (https://developers.tiktok.com/doc/embed-player):
// URL building, the postMessage protocol, and a tiny store so only one hover preview is mounted at a time.

export const TIKTOK_ORIGIN = 'https://www.tiktok.com'
// If the player has not said it is ready this long after its page loaded, TikTok most likely served its
// plain-text "overload-protect triggered" page (rate limit), which sends no messages at all.
export const READY_TIMEOUT_MS = 6000

export type PlayerCommand = 'play' | 'pause' | 'mute' | 'unMute'
export interface PlayerMessage {
  type: string
  value: unknown
}

export function tiktokVideoId(url?: string): string | undefined {
  return url?.match(/\/video\/(\d+)/)?.[1]
}

// Hover preview: muted, no controls, loops. Big player: TikTok's own controls and volume button, no autoplay.
export function playerUrl(id: string, mode: 'preview' | 'full'): string {
  const common = 'music_info=0&description=0&rel=0'
  return mode === 'preview'
    ? `${TIKTOK_ORIGIN}/player/v1/${id}?autoplay=1&muted=1&controls=0&loop=1&${common}`
    : `${TIKTOK_ORIGIN}/player/v1/${id}?controls=1&volume_control=1&autoplay=0&${common}`
}

// Reads a window `message` event from the player; null for anything else (other origins, other widgets).
export function parsePlayerMessage(origin: string, data: unknown): PlayerMessage | null {
  if (origin !== TIKTOK_ORIGIN || typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (d['x-tiktok-player'] !== true || typeof d.type !== 'string') return null
  return { type: d.type, value: d.value }
}

// True when a message is a failure: an explicit player error.
export const isPlayerError = (m: PlayerMessage) => m.type === 'onPlayerError'

export const commandMessage = (type: PlayerCommand) => ({ type, 'x-tiktok-player': true })

export function sendCommand(frame: HTMLIFrameElement | null, type: PlayerCommand) {
  frame?.contentWindow?.postMessage(commandMessage(type), '*')
}

// ---- One hover preview at a time, and previews that failed (not retried until reload) ----
let activeId: string | null = null
const failedIds = new Set<string>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const subscribePreviews = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const getActivePreview = () => activeId
export const isPreviewFailed = (id: string) => failedIds.has(id)

export function setActivePreview(id: string | null) {
  if (activeId === id) return
  activeId = id
  emit()
}
// Clears the slot only if `id` still holds it (a tile that unmounts must not evict a newer preview).
export function releasePreview(id: string) {
  if (activeId === id) setActivePreview(null)
}
export function markPreviewFailed(id: string) {
  failedIds.add(id)
  if (activeId === id) activeId = null
  emit()
}

// Channel summaries: the API decodes a whole channel in the background (minutes), the page polls it.
// Shapes follow channel-decoder's analysis.json and ChannelJob in backend/models.py.

export type ChannelPlatform = 'youtube' | 'tiktok' | 'instagram'

export interface ChannelVideo {
  id: string
  url: string
  handle: string
  platform: string
  posted: string | null
  duration: number | null
  caption: string | null
  plays: number | null
  likes: number | null
  likes_per_1k: number | null
  // Views divided by the channel's median views.
  multiple: number | null
  thumbnail: string | null
  format: string | null
  topic: string | null
  hook_type: string | null
  why_it_works: string | null
  steal_this: string | null
}

export interface ChannelFormat {
  format: string | null
  count: number
  median_plays: number | null
  median_likes_per_1k: number | null
  vs_median: number | null
  top_video_ids: string[]
}

export interface ChannelSummary {
  handle: string
  platform: string
  snapshot: string
  videos_decoded: number
  formatted: number
  n_formats: number
  median_views: number | null
}

export interface ChannelResult {
  summary: ChannelSummary
  videos: ChannelVideo[]
  formats: ChannelFormat[]
}

export interface ChannelProgress {
  status: 'queued' | 'running' | 'done' | 'failed'
  step: string
  steps: string[]
  stepIndex: number
  done: number
  total: number
}

interface ChannelJob extends ChannelProgress {
  job: string
  result?: ChannelResult
  error?: string
}

const LAST = 'trend-finder.channel.last'

// The channel being decoded, so coming back to the page picks the job up again.
export function lastChannel(): { job: string; platform: ChannelPlatform; handle: string } | null {
  try {
    return JSON.parse(sessionStorage.getItem(LAST) ?? 'null')
  } catch {
    return null
  }
}

const remember = (job: string, platform: ChannelPlatform, handle: string) => {
  try {
    sessionStorage.setItem(LAST, JSON.stringify({ job, platform, handle }))
  } catch {
    // Private windows can refuse storage; the page works without it.
  }
}

const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((done, fail) => {
    const t = setTimeout(done, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      fail(new DOMException('Stopped', 'AbortError'))
    })
  })

export async function pollChannel(job: string, onProgress: (p: ChannelProgress) => void, signal?: AbortSignal): Promise<ChannelResult> {
  for (;;) {
    const res = await fetch(`/api/channel/${job}`, { signal })
    const body = (await res.json().catch(() => ({}))) as Partial<ChannelJob> & { error?: string }
    if (!res.ok) throw new Error(body.error ?? 'The channel summary was lost. Try again.')
    if (body.status === 'done' && body.result) return body.result
    if (body.status === 'failed') throw new Error(body.error ?? 'The channel summary failed.')
    onProgress({
      status: body.status ?? 'queued',
      step: body.step ?? '',
      steps: body.steps ?? [],
      stepIndex: body.stepIndex ?? 0,
      done: body.done ?? 0,
      total: body.total ?? 0,
    })
    await pause(3000, signal)
  }
}

export async function analyzeChannel(
  platform: ChannelPlatform,
  handle: string,
  maxVideos: number,
  onProgress: (p: ChannelProgress) => void,
  signal?: AbortSignal,
): Promise<ChannelResult> {
  const r = await fetch('/api/channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, handle, maxVideos }),
    signal,
  })
  const started = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error([started.error ?? 'Could not start the channel summary.', started.detail].filter(Boolean).join(' '))
  remember(started.job, platform, handle)
  return pollChannel(started.job, onProgress, signal)
}

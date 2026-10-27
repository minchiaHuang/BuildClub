import { useEffect, useRef, useState } from 'react'
import { analyzeChannel, lastChannel, pollChannel } from '../lib/channel'
import type { ChannelFormat, ChannelPlatform, ChannelProgress, ChannelResult, ChannelVideo } from '../lib/channel'
import { compact, plural, times } from '../lib/metrics'

const platforms: { id: ChannelPlatform; name: string; hint: string }[] = [
  { id: 'youtube', name: 'YouTube', hint: '@name or youtube.com/@name' },
  { id: 'tiktok', name: 'TikTok', hint: '@name or tiktok.com/@name' },
  { id: 'instagram', name: 'Instagram (not tested yet)', hint: '@name or instagram.com/name' },
]

const TOP_VIDEOS = 12

function Cover({ video }: { video: ChannelVideo }) {
  const [broken, setBroken] = useState(false)
  const image = video.thumbnail && !broken
  return (
    <a className={`thumb ${image ? 'thumb-img' : ''}`} href={video.url} target="_blank" rel="noreferrer" aria-label="Open the video">
      {image && <img src={video.thumbnail ?? ''} alt="" loading="lazy" onError={() => setBroken(true)} />}
      {video.duration ? <span className="thumb-len">{Math.round(video.duration)}s</span> : null}
    </a>
  )
}

// "2.4× the channel's median", or nothing when there is no median to compare with.
const vsMedian = (n: number | null) => (n === null ? null : n < 1.15 && n > 0.87 ? 'about its median' : `${times(n)} its median`)

function FormatCard({ format, videos }: { format: ChannelFormat; videos: Map<string, ChannelVideo> }) {
  const top = format.top_video_ids.map((id) => videos.get(id)).filter((v): v is ChannelVideo => Boolean(v))
  return (
    <article className="chan-format">
      <h3>{format.format ?? 'No clear format'}</h3>
      <dl className="chan-facts">
        <div>
          <dt>Videos</dt>
          <dd>{format.count}</dd>
        </div>
        <div>
          <dt>Median views</dt>
          <dd>{format.median_plays === null ? '–' : compact(format.median_plays)}</dd>
        </div>
        <div>
          <dt>Vs channel median</dt>
          <dd>{format.vs_median === null ? '–' : times(format.vs_median)}</dd>
        </div>
      </dl>
      <div className="chan-top3">
        {top.map((v) => (
          <figure key={v.id}>
            <Cover video={v} />
            <figcaption className="small muted">{v.plays === null ? '' : `${compact(v.plays)} views`}</figcaption>
          </figure>
        ))}
      </div>
    </article>
  )
}

function VideoCard({ video, median }: { video: ChannelVideo; median: number | null }) {
  const compare = vsMedian(video.multiple)
  return (
    <article className="chan-video">
      <Cover video={video} />
      <div className="chan-video-body">
        <div className="tile-compare">
          <span className="cmp-to">{video.plays === null ? '–' : compact(video.plays)}</span>
          <span className="small muted">views{median !== null && compare ? ` · ${compare}` : ''}</span>
        </div>
        {video.format && <span className="pill chan-format-pill">{video.format}</span>}
        <p className="tile-hook">{video.caption || 'No caption'}</p>
        {video.why_it_works && (
          <p className="small">
            <strong>Why it works.</strong> {video.why_it_works}
          </p>
        )}
        {video.steal_this && (
          <p className="small">
            <strong>Steal this.</strong> {video.steal_this}
          </p>
        )}
      </div>
    </article>
  )
}

function Progress({ p }: { p: ChannelProgress }) {
  const counted = p.total > 0
  return (
    <div className="chan-progress" role="status" aria-live="polite">
      <ol>
        {p.steps.map((s, i) => (
          <li key={s} className={i < p.stepIndex ? 'step-done' : i === p.stepIndex ? 'step-now' : ''} aria-current={i === p.stepIndex ? 'step' : undefined}>
            <span className="step-mark" aria-hidden="true">
              {i < p.stepIndex ? '✓' : i + 1}
            </span>
            {s}
            {i === p.stepIndex && counted ? <span className="muted"> · {p.done} of {p.total} videos</span> : null}
          </li>
        ))}
      </ol>
      {counted && (
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
        </div>
      )}
      <p className="small muted">
        {p.status === 'queued' ? 'Waiting for the channel before this one to finish. ' : ''}A channel of 50 videos takes 10 to 15 minutes. You can leave this page and come back.
      </p>
    </div>
  )
}

function Summary({ result }: { result: ChannelResult }) {
  const [all, setAll] = useState(false)
  const { summary, videos, formats } = result
  const byId = new Map(videos.map((v) => [v.id, v]))
  const ranked = [...videos].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))
  const shown = all ? ranked : ranked.slice(0, TOP_VIDEOS)
  const named = formats.filter((f) => f.format && f.format !== 'no clear format')
  return (
    <div className="chan-result">
      <p className="chan-summary">
        <strong>@{summary.handle}</strong> · {plural(summary.videos_decoded, 'video')} decoded
        {summary.median_views !== null && <> · usually {compact(summary.median_views)} views</>}
        {summary.n_formats > 0 && (
          <>
            {' '}
            · {plural(summary.n_formats, 'format')} cover {summary.formatted} of them
          </>
        )}
      </p>

      {named.length > 0 && (
        <section className="chan-section">
          <h2 className="sub-head">Formats it uses</h2>
          <div className="chan-formats">
            {named.map((f) => (
              <FormatCard key={f.format} format={f} videos={byId} />
            ))}
          </div>
        </section>
      )}

      <section className="chan-section">
        <h2 className="sub-head">Top videos</h2>
        <div className="chan-videos">
          {shown.map((v) => (
            <VideoCard key={v.id} video={v} median={summary.median_views} />
          ))}
        </div>
        {ranked.length > TOP_VIDEOS && (
          <button className="btn btn-ghost" onClick={() => setAll((a) => !a)}>
            {all ? `Show the top ${TOP_VIDEOS}` : `Show all ${ranked.length} videos`}
          </button>
        )}
      </section>
    </div>
  )
}

export function ChannelScreen() {
  const [platform, setPlatform] = useState<ChannelPlatform>('youtube')
  const [handle, setHandle] = useState('')
  const [maxVideos, setMaxVideos] = useState(50)
  const [progress, setProgress] = useState<ChannelProgress | null>(null)
  const [result, setResult] = useState<ChannelResult | null>(null)
  const [error, setError] = useState('')
  const running = useRef<AbortController | null>(null)

  const track = (run: (signal: AbortSignal) => Promise<ChannelResult>) => {
    running.current?.abort()
    const control = new AbortController()
    running.current = control
    setError('')
    setResult(null)
    setProgress({ status: 'queued', step: '', steps: [], stepIndex: 0, done: 0, total: 0 })
    run(control.signal)
      .then(setResult)
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message))
      .finally(() => !control.signal.aborted && setProgress(null))
  }

  // Coming back to the page picks up the channel that was being decoded.
  useEffect(() => {
    const last = lastChannel()
    if (last) {
      setPlatform(last.platform)
      setHandle(last.handle)
      track((signal) => pollChannel(last.job, setProgress, signal))
    }
    return () => running.current?.abort()
  }, [])

  const busy = progress !== null
  const hint = platforms.find((p) => p.id === platform)?.hint ?? ''

  return (
    <section className="channel">
      <header className="page-head">
        <span className="eyebrow">Channel</span>
        <h1>Decode a channel</h1>
        <p className="muted">
          Enter a channel and see the formats it keeps using, why they work, and its best videos. It reads the newest videos, so it takes
          a few minutes and costs a few cents.
        </p>
      </header>

      <form
        className="chan-form"
        onSubmit={(e) => {
          e.preventDefault()
          track((signal) => analyzeChannel(platform, handle, maxVideos, setProgress, signal))
        }}
      >
        <fieldset className="chip-group" disabled={busy}>
          <legend className="field-label">Platform</legend>
          {platforms.map((p) => (
            <label key={p.id} className={`chip ${platform === p.id ? 'chip-on' : ''}`}>
              <input type="radio" name="channel-platform" className="sr-only" checked={platform === p.id} onChange={() => setPlatform(p.id)} />
              {p.name}
            </label>
          ))}
        </fieldset>
        <div className="chan-row">
          <label className="field chan-handle">
            <span className="field-label">Channel</span>
            <input id="channel-handle" value={handle} placeholder={hint} disabled={busy} onChange={(e) => setHandle(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Videos</span>
            <select value={maxVideos} disabled={busy} onChange={(e) => setMaxVideos(Number(e.target.value))}>
              <option value={50}>Newest 50</option>
              <option value={100}>Newest 100 (slower)</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy || !handle.trim()}>
            Decode channel
          </button>
        </div>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {progress && <Progress p={progress} />}
      {result && <Summary result={result} />}
    </section>
  )
}

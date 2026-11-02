import { useEffect, useRef, useState } from 'react'
import { analyzeChannel, lastChannel, pollChannel } from '../lib/channel'
import type { ChannelFormat, ChannelPlatform, ChannelProgress, ChannelResult, ChannelVideo } from '../lib/channel'
import { compact, times } from '../lib/metrics'
import { t, tp } from '../lib/i18n'

const platformList = (): { id: ChannelPlatform; name: string; hint: string }[] => [
  { id: 'youtube', name: 'YouTube', hint: t('home.channel.hintYoutube') },
  { id: 'tiktok', name: 'TikTok', hint: t('home.channel.hintTiktok') },
  { id: 'instagram', name: t('home.channel.instagramName'), hint: t('home.channel.hintInstagram') },
]

const TOP_VIDEOS = 12

function Cover({ video }: { video: ChannelVideo }) {
  const [broken, setBroken] = useState(false)
  const image = video.thumbnail && !broken
  return (
    <a className={`thumb ${image ? 'thumb-img' : ''}`} href={video.url} target="_blank" rel="noreferrer" aria-label={t('home.channel.openVideo')}>
      {image && <img src={video.thumbnail ?? ''} alt="" loading="lazy" onError={() => setBroken(true)} />}
      {video.duration ? <span className="thumb-len">{t('home.channel.secs', { n: Math.round(video.duration) })}</span> : null}
    </a>
  )
}

// "2.4× the channel's median", or nothing when there is no median to compare with.
const vsMedian = (n: number | null) => (n === null ? null : n < 1.15 && n > 0.87 ? t('home.channel.aboutMedian') : t('home.channel.timesMedian', { x: times(n) }))

function FormatCard({ format, videos }: { format: ChannelFormat; videos: Map<string, ChannelVideo> }) {
  const top = format.top_video_ids.map((id) => videos.get(id)).filter((v): v is ChannelVideo => Boolean(v))
  return (
    <article className="chan-format">
      <h3>{format.format ?? t('home.channel.noFormat')}</h3>
      <dl className="chan-facts">
        <div>
          <dt>{t('home.channel.videos')}</dt>
          <dd>{format.count}</dd>
        </div>
        <div>
          <dt>{t('home.channel.medianViews')}</dt>
          <dd>{format.median_plays === null ? '–' : compact(format.median_plays)}</dd>
        </div>
        <div>
          <dt>{t('home.channel.vsMedian')}</dt>
          <dd>{format.vs_median === null ? '–' : times(format.vs_median)}</dd>
        </div>
      </dl>
      <div className="chan-top3">
        {top.map((v) => (
          <figure key={v.id}>
            <Cover video={v} />
            <figcaption className="small muted">{v.plays === null ? '' : t('home.channel.viewsOf', { views: compact(v.plays) })}</figcaption>
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
          <span className="small muted">{t('home.channel.views')}{median !== null && compare ? ` · ${compare}` : ''}</span>
        </div>
        {video.format && <span className="pill chan-format-pill">{video.format}</span>}
        <p className="tile-hook">{video.caption || t('home.channel.noCaption')}</p>
        {video.why_it_works && (
          <p className="small">
            <strong>{t('home.channel.whyWorks')}</strong> {video.why_it_works}
          </p>
        )}
        {video.steal_this && (
          <p className="small">
            <strong>{t('home.channel.stealThis')}</strong> {video.steal_this}
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
            {i === p.stepIndex && counted ? <span className="muted"> · {t('home.channel.doneOf', { done: p.done, total: p.total })}</span> : null}
          </li>
        ))}
      </ol>
      {counted && (
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
        </div>
      )}
      <p className="small muted">
        {p.status === 'queued' ? t('home.channel.queued') : ''}{t('home.channel.takes')}
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
        <strong>@{summary.handle}</strong> · {t('home.channel.decoded', { videos: tp('home.count.video', summary.videos_decoded) })}
        {summary.median_views !== null && <> · {t('home.channel.usually', { views: compact(summary.median_views) })}</>}
        {summary.n_formats > 0 && (
          <>
            {' '}
            · {t('home.channel.formatsCover', { formats: tp('home.count.format', summary.n_formats), formatted: summary.formatted })}
          </>
        )}
      </p>

      {named.length > 0 && (
        <section className="chan-section">
          <h2 className="sub-head">{t('home.channel.formatsUses')}</h2>
          <div className="chan-formats">
            {named.map((f) => (
              <FormatCard key={f.format} format={f} videos={byId} />
            ))}
          </div>
        </section>
      )}

      <section className="chan-section">
        <h2 className="sub-head">{t('home.channel.topVideos')}</h2>
        <div className="chan-videos">
          {shown.map((v) => (
            <VideoCard key={v.id} video={v} median={summary.median_views} />
          ))}
        </div>
        {ranked.length > TOP_VIDEOS && (
          <button className="btn btn-ghost" onClick={() => setAll((a) => !a)}>
            {all ? t('home.channel.showTop', { n: TOP_VIDEOS }) : t('home.channel.showAll', { n: ranked.length })}
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
  const platforms = platformList()
  const hint = platforms.find((p) => p.id === platform)?.hint ?? ''

  return (
    <section className="channel">
      <header className="page-head">
        <span className="eyebrow">{t('home.channel.eyebrow')}</span>
        <h1>{t('home.channel.title')}</h1>
        <p className="muted">{t('home.channel.intro')}</p>
      </header>

      <form
        className="chan-form"
        onSubmit={(e) => {
          e.preventDefault()
          track((signal) => analyzeChannel(platform, handle, maxVideos, setProgress, signal))
        }}
      >
        <fieldset className="chip-group" disabled={busy}>
          <legend className="field-label">{t('home.channel.platform')}</legend>
          {platforms.map((p) => (
            <label key={p.id} className={`cchip ${platform === p.id ? 'cchip-on' : ''}`}>
              <input type="radio" name="channel-platform" className="sr-only" checked={platform === p.id} onChange={() => setPlatform(p.id)} />
              {p.name}
            </label>
          ))}
        </fieldset>
        <div className="chan-row">
          <label className="field chan-handle">
            <span className="field-label">{t('home.channel.channelField')}</span>
            <input id="channel-handle" value={handle} placeholder={hint} disabled={busy} onChange={(e) => setHandle(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">{t('home.channel.videosField')}</span>
            <select value={maxVideos} disabled={busy} onChange={(e) => setMaxVideos(Number(e.target.value))}>
              <option value={50}>{t('home.channel.newest50')}</option>
              <option value={100}>{t('home.channel.newest100')}</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy || !handle.trim()}>
            {t('home.channel.analyse')}
          </button>
        </div>
        <p className="small muted chan-quota">{t('home.channel.quota')}</p>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {progress && <Progress p={progress} />}
      {result && <Summary result={result} />}
      {!result && !progress && !error && (
        <div className="empty">
          <p>{t('home.channel.empty')}</p>
        </div>
      )}
    </section>
  )
}

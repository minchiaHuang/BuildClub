import type { Video } from '../types'
import { platformName } from '../lib/metrics'
import { Thumb } from './Thumb'

// TikTok's public embed player needs the numeric video id from the video's link.
const tiktokId = (url?: string) => url?.match(/\/video\/(\d+)/)?.[1]
const youtubeId = (url?: string) => url?.match(/\/shorts\/([\w-]+)/)?.[1]

// Public player for a live video, or undefined where there is none we can embed (Instagram, Reddit, X).
function embedSrc(video: Video): string | undefined {
  if (!video.live) return undefined
  if (video.platform === 'tiktok') {
    const id = tiktokId(video.url)
    return id && `https://www.tiktok.com/embed/v2/${id}`
  }
  if (video.platform === 'youtube') {
    const id = youtubeId(video.url)
    return id && `https://www.youtube.com/embed/${id}`
  }
}

// Large, watchable video for the "Best to copy" card: the real TikTok or YouTube player for live results,
// a large cover for other live videos and for sample data (which has no real video behind it).
export function BestVideo({ video, onOpen }: { video: Video; onOpen?: () => void }) {
  const src = embedSrc(video)
  if (src) {
    return (
      <div className="best-video">
        <iframe
          src={src}
          title={`${platformName[video.platform]} video: ${video.hook}`}
          allow="encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }
  const inner = (
    <>
      <Thumb video={video} large />
      <span className="best-play" aria-hidden="true">
        ▶
      </span>
      {!video.live ? (
        <span className="best-video-note">Sample video: no playback</span>
      ) : (
        onOpen && <span className="best-video-note">Open to watch on {platformName[video.platform]}</span>
      )}
    </>
  )
  // Without onOpen (plan page) the cover links straight to the video; the page's own "Watch on" link is the text label.
  return onOpen ? (
    <button className="best-video best-video-sample" onClick={onOpen} aria-label={`Open breakdown: ${video.hook}`}>
      {inner}
    </button>
  ) : video.live && video.url ? (
    <a className="best-video best-video-sample" href={video.url} target="_blank" rel="noreferrer" aria-label={`Watch on ${platformName[video.platform]}`}>
      {inner}
    </a>
  ) : (
    <div className="best-video best-video-sample">{inner}</div>
  )
}

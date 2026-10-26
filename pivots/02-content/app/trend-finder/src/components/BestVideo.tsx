import type { Video } from '../types'
import { Thumb } from './Thumb'

// TikTok's public embed player needs the numeric video id from the video's link.
const tiktokId = (url?: string) => url?.match(/\/video\/(\d+)/)?.[1]

// Large, watchable video for the "Best to copy" card: the real TikTok player for live results,
// a large cover for sample data (which has no real video behind it).
export function BestVideo({ video, onOpen }: { video: Video; onOpen?: () => void }) {
  const id = video.live && video.platform === 'tiktok' ? tiktokId(video.url) : undefined
  if (id) {
    return (
      <div className="best-video">
        <iframe
          src={`https://www.tiktok.com/embed/v2/${id}`}
          title={`TikTok video: ${video.hook}`}
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
      <span className="best-video-note">Sample video: no playback</span>
    </>
  )
  return onOpen ? (
    <button className="best-video best-video-sample" onClick={onOpen} aria-label={`Open breakdown: ${video.hook}`}>
      {inner}
    </button>
  ) : (
    <div className="best-video best-video-sample">{inner}</div>
  )
}

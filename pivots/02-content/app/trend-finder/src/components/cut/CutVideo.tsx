import { useState } from 'react'
import type { Cue, SubtitleStyle, ZonePlatform } from '../../lib/grading'
import { cueAt } from '../../lib/grading'
import { SubtitleOverlay } from './SubtitleOverlay'
import { SafeZoneLayer } from './SafeZones'

interface Props {
  url: string
  // When both are set, the cue under the playhead is drawn over the video.
  cues: Cue[] | null
  previewStyle: SubtitleStyle | null
  // Preview-only areas the platform's own buttons and text cover; null = hidden.
  zone?: ZonePlatform | null
}

// The finished video, with an optional live preview of the subtitles on top (the video itself is not changed).
export function CutVideo({ url, cues, previewStyle, zone = null }: Props) {
  const [time, setTime] = useState(0)
  const cue = cues && previewStyle ? cueAt(cues, time) : null
  return (
    <div className="gr-player">
      <video
        key={url}
        controls
        playsInline
        preload="metadata"
        src={url}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onSeeked={(e) => setTime(e.currentTarget.currentTime)}
      />
      {zone && <SafeZoneLayer platform={zone} />}
      {previewStyle && cues && <SubtitleOverlay text={cue?.text ?? null} style={previewStyle} />}
    </div>
  )
}

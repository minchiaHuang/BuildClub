import { useState } from 'react'

interface Props {
  // The frame's URL; empty until one is made.
  src?: string
  alt: string
  // A frame is being made.
  busy?: boolean
  // Why the last attempt to make one failed. Retry makes it again.
  error?: string
  onRetry?: () => void
  // Called with the loaded <img>, so the caller can read its colours.
  onLoaded?: (img: HTMLImageElement) => void
}

// One storyboard frame in a fixed 9:16 box, so cards do not jump as frames arrive.
// States, each with words: empty, loading, error with retry, ready.
export function FrameImage({ src, alt, busy, error, onRetry, onLoaded }: Props) {
  // The image failed to load. Remembered per src, so a new frame starts clean without an effect.
  const [failed, setFailed] = useState<{ src: string; attempt: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const loadFailed = !!src && failed?.src === src

  if (busy) {
    return (
      <div className="sb-frame is-loading" role="status">
        <span className="sb-frame-msg">Making the frame…</span>
      </div>
    )
  }
  if (error || loadFailed) {
    return (
      <div className="sb-frame is-error" role="alert">
        <span className="sb-frame-msg">{error ?? "Couldn't load the frame."}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (error && onRetry) onRetry()
            else {
              setFailed(null)
              setAttempt((a) => a + 1)
            }
          }}
        >
          Try again
        </button>
      </div>
    )
  }
  if (!src) {
    return (
      <div className="sb-frame is-empty">
        <span className="sb-frame-msg">No frame yet</span>
      </div>
    )
  }
  return (
    <div className="sb-frame is-ready">
      <img
        key={attempt}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={(e) => onLoaded?.(e.currentTarget)}
        onError={() => setFailed({ src, attempt })}
      />
    </div>
  )
}

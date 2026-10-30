import { useEffect, useState } from 'react'

// Live searches run a real scrape per platform, which usually takes 20–60 seconds (cached repeats are instant).
// `title` names the platforms, or the step when a pasted link or screenshot is being read.
export function LiveLoading({ query, title }: { query: string; title?: string }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="phone-wrap" role="status" aria-live="polite">
      <div className="reading reading-live">
        {/* Shimmer placeholders: the shape of the results that are on their way. */}
        <div className="skeleton-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-tile">
              <span className="skeleton skeleton-thumb" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line skeleton-line-short" />
            </div>
          ))}
        </div>
        <strong>{title ?? `Searching TikTok for "${query}"…`}</strong>
        <ol className="reading-steps">
          <li className={seconds < 3 ? 'now' : 'done'}>
            <span className="reading-dot" aria-hidden="true">{seconds < 3 ? '' : '✓'}</span>
            Sending the search
          </li>
          <li className={seconds < 3 ? '' : 'now'}>
            <span className="reading-dot" aria-hidden="true" />
            Collecting videos, views and followers
          </li>
        </ol>
        <span className="small muted">
          {seconds}s · New searches usually take 20–60 seconds. Repeat searches load instantly.
        </span>
      </div>
    </div>
  )
}

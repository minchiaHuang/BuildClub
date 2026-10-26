import { useEffect, useState } from 'react'
import type { MediaSource } from '../lib/parseQuery'

const steps = ['Getting the video', 'Reading key frames and captions', 'Matching the format against trending videos']

// MOCK: a short "working" moment for the demo. Nothing is fetched or analysed.
export function ReadingOverlay({ source, onDone }: { source: MediaSource; onDone: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= steps.length) {
      onDone()
      return
    }
    const id = setTimeout(() => setStep((s) => s + 1), 650)
    return () => clearTimeout(id)
  }, [step, onDone])

  return (
    <div className="phone-wrap" role="status" aria-live="polite">
      <div className="reading">
        {source.previewUrl ? (
          <img className="reading-preview" src={source.previewUrl} alt="Your screenshot" />
        ) : (
          <div className="reading-preview reading-link">{source.label}</div>
        )}
        <strong>Reading this video…</strong>
        <ol className="reading-steps">
          {steps.map((s, i) => (
            <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
              <span className="reading-dot" aria-hidden="true">
                {i < step ? '✓' : ''}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

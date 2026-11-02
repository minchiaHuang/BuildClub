import { useEffect, useState } from 'react'
import type { MediaSource } from '../lib/parseQuery'
import { t } from '../lib/i18n'

const stepKeys = ['find.reading.step1', 'find.reading.step2', 'find.reading.step3'] as const

// MOCK: a short "working" moment for the demo. Nothing is fetched or analysed.
export function ReadingOverlay({ source, onDone }: { source: MediaSource; onDone: () => void }) {
  const [step, setStep] = useState(0)
  const steps = stepKeys.map((k) => t(k))

  useEffect(() => {
    if (step >= stepKeys.length) {
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
          <img className="reading-preview" src={source.previewUrl} alt={t('find.screenshot')} />
        ) : (
          <div className="reading-preview reading-link">{source.label}</div>
        )}
        <strong>{t('find.reading.title')}</strong>
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

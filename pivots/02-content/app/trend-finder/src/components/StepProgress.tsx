import { STEPS, STEP_LABEL } from '../lib/steps.ts'
import type { Step } from '../lib/steps.ts'
import { t } from '../lib/i18n.ts'

interface Props {
  step: Step
  // 'bar': six segments with the current step named (cards). 'full': every step named (a video page).
  variant?: 'bar' | 'full'
}

// Where a video is in its six steps. Done steps are filled, the current one is marked, the rest are empty; the
// current step is always written out, so colour never carries it alone.
export function StepProgress({ step, variant = 'bar' }: Props) {
  const at = STEPS.indexOf(step)
  return (
    <div className={`step-progress step-progress-${variant}`} role="group" aria-label={t('home.progress.step', { n: at + 1, total: STEPS.length, label: STEP_LABEL[step] })}>
      <ol className="step-progress-track">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`step-progress-seg${i < at ? ' is-done' : i === at ? ' is-current' : ''}`}
            aria-current={i === at ? 'step' : undefined}
          >
            {variant === 'full' && <span className="step-progress-name">{STEP_LABEL[s]}</span>}
          </li>
        ))}
      </ol>
      {variant === 'bar' && (
        <span className="step-progress-label">
          {STEP_LABEL[step]} <span className="muted">· {t('home.progress.of', { n: at + 1, total: STEPS.length })}</span>
        </span>
      )}
    </div>
  )
}

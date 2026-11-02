import type { AutoCut } from '../../lib/grading'
import { t } from '../../lib/i18n'
import { autoCutByShot, autoCutLine } from '../../lib/grading'

// What "Make the video" cut out on its own, so the shorter video isn't a surprise.
export function AutoCutNote({ autoCut, finalSec }: { autoCut: AutoCut; finalSec: number }) {
  const shots = autoCutByShot(autoCut.trims)
  return (
    <div className="gr-autocut small">
      <p>{autoCutLine(autoCut, finalSec)}</p>
      {shots.length > 0 && (
        <details>
          <summary>{t('cut.autocut.byShot')}</summary>
          <ul>
            {shots.map((s) => (
              <li key={s.shot}>
                {t('cut.autocut.shotLine', { shot: s.shot, text: s.text })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

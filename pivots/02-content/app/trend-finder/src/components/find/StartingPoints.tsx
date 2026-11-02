import type { ChipGroup } from '../../lib/clientChips'
import type { PulseInfo } from '../ClientChips'
import { checkedWhen } from './checked'
import { t } from '../../lib/i18n'

interface Props {
  clientName: string
  groups: ChipGroup[]
  // Used when there is nothing else to suggest yet.
  clientExamples: string[]
  pulse: PulseInfo
  onPick: (value: string) => void
  onRefresh: () => void
}

// Find ideas, before searching: a few searches worth trying for this client, each with one plain
// sentence saying why. Picking one runs that search straight away.
export function StartingPoints({ clientName, groups, clientExamples, pulse, onPick, onRefresh }: Props) {
  const shown: ChipGroup[] = groups.length
    ? groups
    : clientExamples.length
      ? [
          {
            id: 'starter',
            title: t('find.starter.title', { client: clientName }),
            chips: clientExamples.slice(0, 5).map((e) => ({ label: e, value: e, hint: t('find.start.hint', { client: clientName }) })),
          },
        ]
      : []
  const waitingForTrends = pulse.live && pulse.loading && !groups.some((g) => g.id === 'trending')

  return (
    <section className="find-start" aria-labelledby="find-start-title">
      <div className="find-start-head">
        <h2 id="find-start-title">{t('find.start.title', { client: clientName })}</h2>
        <p className="find-start-sub">{t('find.start.sub')}</p>
      </div>

      {pulse.live && (
        <p className="find-start-pulse" role="status">
          {pulse.loading ? (
            <>{t('find.start.checking', { client: clientName })}</>
          ) : pulse.error ? (
            <>{t('find.start.error', { error: pulse.error })}</>
          ) : pulse.fetchedAt ? (
            <>{t('find.start.checked', { topic: pulse.topic ?? '', when: checkedWhen(pulse.fetchedAt) })}</>
          ) : (
            <>{t('find.start.notChecked', { client: clientName })}</>
          )}
          {!pulse.loading && (
            <button type="button" className="link-btn" onClick={onRefresh}>
              {t('find.start.again')}
            </button>
          )}
        </p>
      )}

      <div className="find-start-grid">
        {waitingForTrends && (
          <div className="find-start-card" aria-hidden="true">
            <span className="field-label">{t('find.start.catching')}</span>
            <ul className="find-start-list">
              {[0, 1, 2].map((i) => (
                <li key={i} className="find-start-skeleton" />
              ))}
            </ul>
          </div>
        )}
        {shown.map((g) => (
          <div key={g.id} className="find-start-card">
            <h3 className="field-label">{g.title}</h3>
            <ul className="find-start-list">
              {g.chips.map((c) => (
                <li key={`${g.id}-${c.label}`}>
                  <button type="button" className="find-start-item" onClick={() => onPick(c.value)}>
                    <span className="find-start-text">
                      <span className="find-start-label">{c.label}</span>
                      {c.hint && <span className="find-start-why">{c.hint}</span>}
                    </span>
                    <span className="find-start-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

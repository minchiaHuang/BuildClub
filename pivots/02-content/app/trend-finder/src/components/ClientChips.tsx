import type { ChipGroup } from '../lib/clientChips'
import { PlatformLogo } from './PlatformToggles'
import { checkedWhen } from './find/checked'
import { t } from '../lib/i18n'

export interface PulseInfo {
  live: boolean
  loading: boolean
  fetchedAt?: number
  topic: string
  error: string | null
}

interface Props {
  clientName: string
  groups: ChipGroup[]
  pulse: PulseInfo
  onPick: (value: string) => void
  onRefresh: () => void
  extra?: React.ReactNode
}


// Client-specific search ideas as one compact row inside the search card (used when a screen doesn't
// hide them). Each is a plain search button; why it's suggested shows on hover. Find ideas shows the
// fuller version, with a sentence per search, in find/StartingPoints.
export function ClientChips({ clientName, groups, pulse, onPick, onRefresh, extra }: Props) {
  return (
    <div className="client-chips">
      {pulse.live && (
        <div className="pulse-bar">
          <PlatformLogo platform="tiktok" size={14} />
          {pulse.loading ? (
            <span>
              {t('home.clientChips.checking', { name: clientName })} <span className="muted">{t('home.clientChips.checkingTime')}</span>
            </span>
          ) : pulse.error ? (
            <span className="pulse-error">{t('home.clientChips.error', { error: pulse.error })}</span>
          ) : !pulse.topic ? (
            // Nothing to look up: a refresh would only be refused.
            <span className="muted">{t('home.clientChips.noTopic', { name: clientName })}</span>
          ) : pulse.fetchedAt ? (
            <span className="muted">{t('home.clientChips.checked', { topic: pulse.topic, when: checkedWhen(pulse.fetchedAt) })}</span>
          ) : (
            <span className="muted">{t('home.clientChips.notChecked', { name: clientName })}</span>
          )}
          {!pulse.loading && pulse.topic && (
            <button type="button" className="link-btn" onClick={onRefresh}>
              {t('home.clientChips.checkAgain')}
            </button>
          )}
        </div>
      )}

      {pulse.loading && !groups.some((g) => g.id === 'trending') && (
        <div className="chip-group" aria-hidden="true">
          <span className="chip-group-title">{t('home.clientChips.catching')}</span>
          <div className="chip-row">
            {[90, 120, 80].map((w) => (
              <span key={w} className="cchip cchip-skeleton" style={{ width: w }} />
            ))}
          </div>
        </div>
      )}

      {groups.filter((g) => g.chips.length > 0).map((g) => (
        <div key={g.id} className="chip-group">
          <span className="chip-group-title">{g.title}</span>
          <div className="chip-row">
            {g.chips.map((c) => (
              <button
                key={`${g.id}-${c.label}`}
                type="button"
                className={`cchip cchip-${g.id}`}
                title={c.hint}
                onClick={() => onPick(c.value)}
              >
                {g.id === 'trending' && (
                  <svg className="cchip-trend" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
                  </svg>
                )}
                <span className="cchip-label">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {extra}
    </div>
  )
}

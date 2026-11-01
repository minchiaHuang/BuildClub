import type { ChipGroup } from '../../lib/clientChips'
import type { PulseInfo } from '../ClientChips'
import { checkedWhen } from './checked'

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
            title: `Searches that fit ${clientName}`,
            chips: clientExamples.slice(0, 5).map((e) => ({ label: e, value: e, hint: `A starting search from ${clientName}'s brief` })),
          },
        ]
      : []
  const waitingForTrends = pulse.live && pulse.loading && !groups.some((g) => g.id === 'trending')

  return (
    <section className="find-start" aria-labelledby="find-start-title">
      <div className="find-start-head">
        <h2 id="find-start-title">Where to start for {clientName}</h2>
        <p className="find-start-sub">Pick one to search it now, or type your own search above.</p>
      </div>

      {pulse.live && (
        <p className="find-start-pulse" role="status">
          {pulse.loading ? (
            <>Checking what's catching on for {clientName} on TikTok. This takes about 30 seconds and runs once a day.</>
          ) : pulse.error ? (
            <>We couldn't check TikTok just now: {pulse.error}</>
          ) : pulse.fetchedAt ? (
            <>We checked TikTok for "{pulse.topic}" {checkedWhen(pulse.fetchedAt)}.</>
          ) : (
            <>We haven't checked TikTok for {clientName} yet.</>
          )}
          {!pulse.loading && (
            <button type="button" className="link-btn" onClick={onRefresh}>
              Check again
            </button>
          )}
        </p>
      )}

      <div className="find-start-grid">
        {waitingForTrends && (
          <div className="find-start-card" aria-hidden="true">
            <span className="field-label">Catching on now</span>
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

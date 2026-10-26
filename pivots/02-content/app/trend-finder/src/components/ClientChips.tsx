import type { ChipGroup } from '../lib/clientChips'
import { PlatformLogo } from './PlatformToggles'

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

function updated(ts: number) {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`
}

// Client-specific search ideas under the search box: what's trending for them, what fits their audience,
// and more like what they've already saved.
export function ClientChips({ clientName, groups, pulse, onPick, onRefresh, extra }: Props) {
  return (
    <div className="client-chips">
      {pulse.live && (
        <div className="pulse-bar">
          <PlatformLogo platform="tiktok" size={14} />
          {pulse.loading ? (
            <span>
              Checking what's trending for {clientName}… <span className="muted">(about 30 seconds, once a day)</span>
            </span>
          ) : pulse.error ? (
            <span className="pulse-error">Couldn't check trends: {pulse.error}</span>
          ) : pulse.fetchedAt ? (
            <span className="muted">
              Trends from TikTok for "{pulse.topic}" · updated {updated(pulse.fetchedAt)}
            </span>
          ) : (
            <span className="muted">Trends for {clientName} haven't been checked yet.</span>
          )}
          {!pulse.loading && (
            <button type="button" className="link-btn" onClick={onRefresh}>
              ↻ Refresh
            </button>
          )}
        </div>
      )}

      {pulse.loading && !groups.some((g) => g.id === 'trending') && (
        <div className="chip-group" aria-hidden="true">
          <span className="chip-group-title">Trending now</span>
          <div className="chip-row">
            {[90, 120, 80].map((w) => (
              <span key={w} className="cchip cchip-skeleton" style={{ width: w }} />
            ))}
          </div>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.id} className="chip-group">
          <span className="chip-group-title">{g.title}</span>
          <div className="chip-row">
            {g.chips.map((c) => (
              <button
                key={`${g.id}-${c.label}`}
                type="button"
                className={`cchip cchip-${g.id} ${c.hot ? 'cchip-hot' : ''}`}
                onClick={() => onPick(c.value)}
              >
                <span className="cchip-label">{c.label}</span>
                {c.hint && <span className="cchip-hint">{c.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      {extra}
    </div>
  )
}

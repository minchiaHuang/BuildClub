import type { Query } from '../state'
import type { PulseInfo } from './ClientChips'
import type { ChipGroup } from '../lib/clientChips'
import { ErrorText } from './ErrorText'
import { SearchBox } from './SearchBox'
// The Altitude hero holds the search box.
import { AltitudeHero } from './themes/AltitudeHero'
import { StartingPoints } from './find/StartingPoints'
import { TopicResults } from './publish/TopicResults'
import { t } from '../lib/i18n'

interface Props {
  query: Query
  setQuery: (q: Query) => void
  onSearch: (text: string) => void
  onImage?: (file: File) => void
  clientName: string
  // Live mode searches real TikTok videos; otherwise the sample tofu data.
  live: boolean
  clientExamples: string[]
  error: string | null
  // Client-specific starting points: catching on now, fits the audience, more like saved ideas.
  chipGroups: ChipGroup[]
  pulse: PulseInfo
  onRefreshPulse: () => void
  // Videos sent or approved for this client this month, and the monthly target.
  planned: number
  target: number
  // The last search that had results, to offer a way back.
  lastSearch: string | null
  onBackToResults: () => void
}

// Find ideas, before searching. The first thing staff see after picking a client:
// the search card on top, then a few searches worth trying for this client.
export function SearchScreen(props: Props) {
  const { query, setQuery, onSearch, clientName, live, error } = props
  return (
    <section className="search-screen find-page">
      <AltitudeHero clientName={clientName}>
        <SearchBox
          inputId="keyword"
          value={query.keyword}
          onValueChange={(text) => setQuery({ ...query, keyword: text })}
          onSearch={onSearch}
          onImage={props.onImage}
          platforms={query.platforms}
          onPlatformsChange={(platforms) => setQuery({ ...query, platforms })}
          live={live}
          clientName={clientName}
          clientExamples={props.clientExamples}
          chipGroups={props.chipGroups}
          pulse={props.pulse}
          onRefreshPulse={props.onRefreshPulse}
          autoFocus
          hideChips
        />
      </AltitudeHero>

      {(props.planned > 0 || props.lastSearch) && (
        <div className="find-status">
          {props.planned > 0 && (
            <span className="progress-line">
              <span>
                <strong>{t('find.search.approvedCount', { planned: props.planned, target: props.target })}</strong>
                {t('find.search.approvedFor', { client: clientName })}
              </span>
              <span className="progress-mini" aria-hidden="true">
                <span style={{ width: `${Math.min(props.planned / props.target, 1) * 100}%` }} />
              </span>
            </span>
          )}
          {props.lastSearch && (
            <button type="button" className="link-btn" onClick={props.onBackToResults}>
              {t('find.search.back', { q: props.lastSearch })}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          <ErrorText text={error} onSearch={props.onSearch} />
        </p>
      )}

      <TopicResults text={query.keyword} />

      <StartingPoints
        clientName={clientName}
        groups={props.chipGroups}
        clientExamples={props.clientExamples}
        pulse={props.pulse}
        onPick={(value) => {
          setQuery({ ...query, keyword: value })
          onSearch(value)
        }}
        onRefresh={props.onRefreshPulse}
      />

      <p className="hint find-hint">
        {live
          ? t('find.search.hintLive')
          : t('find.search.hintDemo')}
      </p>
    </section>
  )
}

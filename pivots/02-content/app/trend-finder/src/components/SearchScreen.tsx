import type { Query } from '../state'
import type { PulseInfo } from './ClientChips'
import type { ChipGroup } from '../lib/clientChips'
import { SearchBox } from './SearchBox'

interface Props {
  query: Query
  setQuery: (q: Query) => void
  onSearch: (text: string) => void
  clientName: string
  // Live mode searches real TikTok videos; otherwise the sample tofu data.
  live: boolean
  clientExamples: string[]
  error: string | null
  // Client-specific chips: trending now, fits the audience, more like saved ideas.
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

export function SearchScreen(props: Props) {
  const { query, setQuery, onSearch, clientName, live, error } = props
  return (
    <section className="search-screen">
      <div className="search-intro">
        <span className="eyebrow">{clientName} · Search</span>
        {props.planned > 0 && (
          <span className="progress-line">
            <strong>
              {props.planned} of {props.target}
            </strong>{' '}
            videos planned for {clientName} this month
            <span className="progress-mini" aria-hidden="true">
              <span style={{ width: `${Math.min(props.planned / props.target, 1) * 100}%` }} />
            </span>
          </span>
        )}
        <h1>Find videos that are working right now</h1>
        <p className="lede">
          {live
            ? 'Type what this client is about. We search TikTok live, rank videos by how far they beat the account’s size, and show which sounds and hashtags keep coming up.'
            : 'Type a niche or ask a question in plain words. We search TikTok, rank videos from small accounts with big views, and show which formats are spreading.'}
        </p>
      </div>

      <SearchBox
        inputId="keyword"
        value={query.keyword}
        onValueChange={(text) => setQuery({ ...query, keyword: text })}
        onSearch={onSearch}
        platforms={query.platforms}
        onPlatformsChange={(platforms) => setQuery({ ...query, platforms })}
        live={live}
        clientName={clientName}
        clientExamples={props.clientExamples}
        chipGroups={props.chipGroups}
        pulse={props.pulse}
        onRefreshPulse={props.onRefreshPulse}
        autoFocus
      />

      {props.lastSearch && (
        <button type="button" className="link-btn back-results" onClick={props.onBackToResults}>
          ← Back to results for "{props.lastSearch}"
        </button>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">
        {live
          ? 'Live TikTok search. Each new search costs a few cents of Apify credit; repeats within 24 hours are free.'
          : 'Sample data covers one niche for now: tofu.'}
      </p>
    </section>
  )
}
